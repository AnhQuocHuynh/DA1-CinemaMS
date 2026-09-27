using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MassTransit;
using MediatR;
using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;
using PaymentService.Application.IntegrationEvents;

namespace PaymentService.Application.Features.Payments.Commands;

public record InitiatePaymentCommand(
    long OrderId,
    long UserId,
    decimal Amount,
    string Currency,
    PaymentMethod PaymentMethod,
    string CancelUrl,
    string SuccessUrl
) : IRequest<PaymentInitiationResult>;

public class InitiatePaymentCommandValidator : AbstractValidator<InitiatePaymentCommand>
{
    public InitiatePaymentCommandValidator()
    {
        RuleFor(x => x.OrderId).GreaterThan(0);
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty();
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
        // Duplicate-order protection
        var existingPayment = await _paymentRepository.GetByOrderIdAsync(request.OrderId, cancellationToken);
        if (existingPayment != null && existingPayment.Status != PaymentStatus.FAILED)
        {
            throw new InvalidPaymentStateException($"A payment for Order {request.OrderId} already exists and is not in a failed state.");
        }

        // Create payment entity (generates SagaId internally)
        var payment = new Payment(
            request.OrderId,
            request.UserId,
            request.Amount,
            request.Currency,
            request.PaymentMethod
        );

        await _paymentRepository.AddAsync(payment, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken); // Flush to DB to get payment.Id

        // Transaction log
        await _transactionLogRepository.AddAsync(
            new TransactionLog(payment.Id, "INITIATE", request.ToString(), null, null),
            cancellationToken
        );

        PaymentInitiationResult result;
        if (request.PaymentMethod == PaymentMethod.CASH)
        {
            // Cash: no external gateway call now — admin confirms via POST /api/payments/cash/confirm
            // which publishes CashPaymentConfirmed → saga transitions to Completed
            result = new PaymentInitiationResult(true, request.SuccessUrl, null);
        }
        else
        {
            // Delegate to gateway synchronously (Stripe/PayPal need to return a redirect URL)
            var gateway = _gatewayFactory.GetGateway(request.PaymentMethod);
            var gatewayRequest = new PaymentRequest(payment.Id, payment.Amount, payment.Currency, request.CancelUrl, request.SuccessUrl);
            result = await gateway.InitiateAsync(gatewayRequest);
        }

        // Publish PaymentInitiated via EF Core Outbox → triggers saga state machine
        // This is stored atomically with the payment record in the same DB transaction
        await _publishEndpoint.Publish(new PaymentInitiated
        {
            CorrelationId = payment.SagaId,
            PaymentId = payment.Id,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString()
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return result;
    }
}
