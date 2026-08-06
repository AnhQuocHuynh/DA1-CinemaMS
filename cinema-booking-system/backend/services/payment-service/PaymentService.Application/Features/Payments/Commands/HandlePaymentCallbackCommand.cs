using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MassTransit;
using MediatR;
using PaymentService.Application.Contracts;
using PaymentService.Application.Exceptions;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Payments.Commands;

public record HandlePaymentCallbackCommand(
    PaymentMethod PaymentMethod,
    IDictionary<string, string> Parameters
) : IRequest<bool>;

public class HandlePaymentCallbackCommandHandler : IRequestHandler<HandlePaymentCallbackCommand, bool>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly ITransactionLogRepository _transactionLogRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPaymentGatewayFactory _gatewayFactory;
    private readonly IPublishEndpoint _publishEndpoint;

    public HandlePaymentCallbackCommandHandler(
        IPaymentRepository paymentRepository,
        ITransactionLogRepository transactionLogRepository,
        IUnitOfWork unitOfWork,
        IPaymentGatewayFactory gatewayFactory,
        IPublishEndpoint publishEndpoint)
    {
        _paymentRepository = paymentRepository;
        _transactionLogRepository = transactionLogRepository;
        _unitOfWork = unitOfWork;
        _gatewayFactory = gatewayFactory;
        _publishEndpoint = publishEndpoint;
    }

    public async Task<bool> Handle(HandlePaymentCallbackCommand request, CancellationToken cancellationToken)
    {
        var gateway = _gatewayFactory.GetGateway(request.PaymentMethod);

        // 1. Verify gateway signature (Stripe HMAC, etc.) — must happen synchronously with raw body
        var result = await gateway.VerifyCallbackAsync(request.Parameters);

        if (!result.IsSuccess)
        {
            // Verification failed: reject the webhook (invalid signature)
            throw new PaymentGatewayException(result.ErrorMessage ?? "Payment verification failed.");
        }

        // 2. Resolve payment entity to get its SagaId (saga correlation key)
        if (!request.Parameters.TryGetValue("paymentId", out var paymentIdStr) || !long.TryParse(paymentIdStr, out var paymentId))
        {
            throw new PaymentGatewayException("Payment ID not found in callback parameters.");
        }

        var payment = await _paymentRepository.GetByIdAsync(paymentId, cancellationToken);
        if (payment == null)
            throw new PaymentNotFoundException(paymentId);

        // 3. Audit log
        await _transactionLogRepository.AddAsync(
            new TransactionLog(payment.Id, "CALLBACK",
                request.Parameters.ToString(),
                result.RawResponse,
                result.IsSuccess ? 200 : 400),
            cancellationToken);

        // 4. Publish GatewayCallbackReceived → saga drives domain state change + downstream events
        //    Published via EF Core Outbox — atomic with the transaction log write above
        await _publishEndpoint.Publish(new GatewayCallbackReceived
        {
            CorrelationId = payment.SagaId,
            PaymentMethod = request.PaymentMethod.ToString(),
            IsSuccess = result.IsSuccess,
            TransactionId = result.TransactionId,
            ErrorMessage = result.ErrorMessage,
            RawResponse = result.RawResponse
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}
