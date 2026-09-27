using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MassTransit;
using MediatR;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;
using PaymentService.Application.IntegrationEvents;

namespace PaymentService.Application.Features.Payments.Commands;

/// <summary>
/// Admin command: manually confirm a CASH payment that has been collected at the counter.
/// Publishes CashPaymentConfirmed → saga transitions Pending → Completed → publishes PaymentCompleted.
/// </summary>
public record ConfirmCashPaymentCommand(long PaymentId, long AdminUserId) : IRequest<PaymentDto>;

public class ConfirmCashPaymentCommandHandler : IRequestHandler<ConfirmCashPaymentCommand, PaymentDto>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly ITransactionLogRepository _transactionLogRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPublishEndpoint _publishEndpoint;

    public ConfirmCashPaymentCommandHandler(
        IPaymentRepository paymentRepository,
        ITransactionLogRepository transactionLogRepository,
        IUnitOfWork unitOfWork,
        IPublishEndpoint publishEndpoint)
    {
        _paymentRepository = paymentRepository;
        _transactionLogRepository = transactionLogRepository;
        _unitOfWork = unitOfWork;
        _publishEndpoint = publishEndpoint;
    }

    public async Task<PaymentDto> Handle(ConfirmCashPaymentCommand request, CancellationToken cancellationToken)
    {
        var payment = await _paymentRepository.GetByIdAsync(request.PaymentId, cancellationToken);
        if (payment == null)
            throw new PaymentNotFoundException(request.PaymentId);

        if (payment.PaymentMethod != PaymentMethod.CASH)
            throw new InvalidPaymentStateException(
                $"Payment {request.PaymentId} is not a cash payment (method: {payment.PaymentMethod}).");

        if (payment.Status != PaymentStatus.PENDING)
        {
            // Idempotent: already confirmed — return current state
            return MapToDto(payment);
        }

        // Audit log
        await _transactionLogRepository.AddAsync(
            new TransactionLog(payment.Id, "CASH_CONFIRM", null,
                $"Admin confirmed cash payment. AdminId={request.AdminUserId}", 200),
            cancellationToken);

        // Publish CashPaymentConfirmed → saga transitions Pending → Completed
        // Saga will call payment.Complete() + publish PaymentCompleted (via outbox)
        await _publishEndpoint.Publish(new CashPaymentConfirmed
        {
            CorrelationId = payment.SagaId,
            PaymentId = payment.Id,
            AdminUserId = request.AdminUserId
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return MapToDto(payment);
    }

    private static PaymentDto MapToDto(Payment payment) => new(
        payment.Id,
        payment.OrderId,
        payment.UserId,
        payment.TransactionId,
        payment.Amount,
        payment.Currency,
        payment.PaymentMethod,
        payment.Status,
        payment.PaidAt,
        payment.CreatedAt,
        payment.Refunds.Select(r => new RefundDto(r.Id, r.PaymentId, r.Amount, r.Reason, r.Status, r.ProcessedAt, r.CreatedAt))
    );
}
