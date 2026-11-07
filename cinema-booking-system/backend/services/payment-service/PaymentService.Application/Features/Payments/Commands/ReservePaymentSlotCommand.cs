using System.Threading;
using System.Threading.Tasks;
using MassTransit;
using MediatR;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Payments.Commands;

public record ReservePaymentSlotCommand(
    long OrderId,
    long UserId,
    decimal Amount,
    string Currency
) : IRequest;

public class ReservePaymentSlotCommandHandler : IRequestHandler<ReservePaymentSlotCommand>
{
    private readonly IPaymentRepository _repo;
    private readonly IUnitOfWork _uow;
    private readonly IPublishEndpoint _publishEndpoint;

    public ReservePaymentSlotCommandHandler(
        IPaymentRepository repo,
        IUnitOfWork uow,
        IPublishEndpoint publishEndpoint)
    {
        _repo = repo;
        _uow = uow;
        _publishEndpoint = publishEndpoint;
    }

    public async Task Handle(ReservePaymentSlotCommand request, CancellationToken ct)
    {
        // Idempotency: skip if a non-failed payment already exists for this order
        var existing = await _repo.GetByOrderIdAsync(request.OrderId, ct);
        if (existing != null && existing.Status != PaymentStatus.FAILED)
            return;

        var payment = new Payment(
            request.OrderId,
            request.UserId,
            request.Amount,
            request.Currency
        );

        await _repo.AddAsync(payment, ct);
        await _uow.SaveChangesAsync(ct);

        // Publish OrderSlotReserved via outbox to initiate the saga in Created state with expiry timer
        await _publishEndpoint.Publish(new OrderSlotReserved
        {
            CorrelationId = payment.SagaId,
            PaymentId = payment.Id,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency
        }, ct);

        await _uow.SaveChangesAsync(ct);
    }
}
