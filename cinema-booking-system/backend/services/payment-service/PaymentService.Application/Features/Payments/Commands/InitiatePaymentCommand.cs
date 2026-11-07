using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MassTransit;
using MediatR;
using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Payments.Commands;

public record InitiatePaymentCommand(
    long OrderId,
    long UserId,
    PaymentMethod PaymentMethod,
    string CancelUrl,
    string SuccessUrl,
    bool IsStaffOrAdmin = false
) : IRequest<PaymentInitiationResult>;

public class InitiatePaymentCommandValidator : AbstractValidator<InitiatePaymentCommand>
{
    public InitiatePaymentCommandValidator()
    {
        RuleFor(x => x.OrderId).GreaterThan(0);
        RuleFor(x => x.UserId).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PaymentMethod).IsInEnum();
        RuleFor(x => x.CancelUrl).NotEmpty();
        RuleFor(x => x.SuccessUrl).NotEmpty();
    }
}

public class InitiatePaymentCommandHandler : IRequestHandler<InitiatePaymentCommand, PaymentInitiationResult>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly ITransactionLogRepository _transactionLogRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPaymentGatewayFactory _gatewayFactory;
    private readonly IPublishEndpoint _publishEndpoint;

    public InitiatePaymentCommandHandler(
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

    public async Task<PaymentInitiationResult> Handle(InitiatePaymentCommand request, CancellationToken cancellationToken)
    {
        // Role check: CASH is restricted to staff/admin only
        if (request.PaymentMethod == PaymentMethod.CASH && !request.IsStaffOrAdmin)
        {
            throw new ForbiddenAccessException(
                "Cash payment method is restricted to staff counter bookings only.");
        }

        // Race-condition guard: poll until payment slot appears from order.created event
        var payment = await PollForPaymentSlotAsync(request.OrderId, cancellationToken);

        if (payment == null)
        {
            throw new PaymentNotFoundException(
                $"Payment slot for order {request.OrderId} not ready yet. " +
                "The order created event is still being processed. Please retry in a moment.");
        }

        // Ownership check: staff/admin can process payment for any order (walk-in userId=0 or member order)
        if (payment.UserId != request.UserId && !request.IsStaffOrAdmin)
        {
            throw new UnauthorizedAccessException("Payment does not belong to this user.");
        }

        switch (payment.Status)
        {
            case PaymentStatus.CREATED:
            case PaymentStatus.FAILED:
            {
                PaymentInitiationResult result;
                if (request.PaymentMethod == PaymentMethod.CASH)
                {
                    var txnId = $"CASH-{payment.OrderId}-{DateTime.UtcNow:yyyyMMddHHmmss}";
                    payment.Initiate(PaymentMethod.CASH, txnId);
                    payment.Complete(txnId, $"Cash collected at counter by staff user ID {request.UserId}");

                    await _transactionLogRepository.AddAsync(
                        new TransactionLog(payment.Id, "CASH_COLLECTED", request.ToString(), $"StaffId={request.UserId}", 200),
                        cancellationToken
                    );

                    await _publishEndpoint.Publish(new PaymentInitiated
                    {
                        CorrelationId = payment.SagaId,
                        PaymentId = payment.Id,
                        OrderId = payment.OrderId,
                        UserId = payment.UserId,
                        Amount = payment.Amount,
                        Currency = payment.Currency,
                        PaymentMethod = request.PaymentMethod.ToString(),
                        TransactionId = txnId
                    }, cancellationToken);

                    await _unitOfWork.SaveChangesAsync(cancellationToken);

                    return new PaymentInitiationResult(true, request.SuccessUrl, null, txnId);
                }
                else
                {
                    var gateway = _gatewayFactory.GetGateway(request.PaymentMethod);
                    var gatewayRequest = new PaymentRequest(payment.Id, payment.Amount, payment.Currency, request.CancelUrl, request.SuccessUrl);
                    result = await gateway.InitiateAsync(gatewayRequest);

                    if (!result.IsSuccess)
                        return result;

                    payment.Initiate(request.PaymentMethod, result.GatewaySessionId);

                    await _transactionLogRepository.AddAsync(
                        new TransactionLog(payment.Id, "INITIATE", request.ToString(), null, null),
                        cancellationToken
                    );

                    await _publishEndpoint.Publish(new PaymentInitiated
                    {
                        CorrelationId = payment.SagaId,
                        PaymentId = payment.Id,
                        OrderId = payment.OrderId,
                        UserId = payment.UserId,
                        Amount = payment.Amount,
                        Currency = payment.Currency,
                        PaymentMethod = request.PaymentMethod.ToString()
                    }, cancellationToken);

                    await _unitOfWork.SaveChangesAsync(cancellationToken);

                    return result;
                }
            }

            case PaymentStatus.PENDING:
            {
                if (request.PaymentMethod == PaymentMethod.CASH)
                {
                    var txnId = payment.TransactionId ?? $"CASH-{payment.OrderId}-{DateTime.UtcNow:yyyyMMddHHmmss}";
                    payment.Complete(txnId, $"Cash collected at counter by staff user ID {request.UserId}");
                    await _unitOfWork.SaveChangesAsync(cancellationToken);
                    return new PaymentInitiationResult(true, request.SuccessUrl, null, txnId);
                }

                // Idempotency: response was lost, user is retrying
                if (payment.GatewaySessionId != null && payment.PaymentMethod.HasValue)
                {
                    var existingGateway = _gatewayFactory.GetGateway(payment.PaymentMethod.Value);
                    var existingUrl = await existingGateway.GetExistingSessionUrlAsync(payment.GatewaySessionId, cancellationToken);
                    return new PaymentInitiationResult(true, existingUrl, null, payment.GatewaySessionId);
                }

                return new PaymentInitiationResult(true, request.SuccessUrl, null);
            }

            case PaymentStatus.COMPLETED:
                return new PaymentInitiationResult(true, request.SuccessUrl, null, payment.TransactionId);

            case PaymentStatus.EXPIRED:
                throw new InvalidPaymentStateException(
                    $"Payment for order {request.OrderId} has expired. Please start a new booking.");

            default:
                throw new InvalidPaymentStateException(
                    $"Unexpected payment status {payment.Status} for order {request.OrderId}.");
        }
    }

    private async Task<Payment?> PollForPaymentSlotAsync(long orderId, CancellationToken ct)
    {
        int[] delays = [500, 1000, 2000, 3000];
        foreach (var delay in delays)
        {
            var payment = await _paymentRepository.GetByOrderIdAsync(orderId, ct);
            if (payment != null) return payment;
            await Task.Delay(delay, ct);
        }
        return await _paymentRepository.GetByOrderIdAsync(orderId, ct);
    }
}
