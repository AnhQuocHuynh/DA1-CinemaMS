using MassTransit;
using Microsoft.Extensions.Logging;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Infrastructure.Sagas;

/// <summary>
/// MassTransit State Machine Saga for the Payment lifecycle.
///
/// State transitions:
///   Initial ──[PaymentInitiated]──► Pending
///   Pending ──[GatewayCallbackReceived (success)]──► Completed
///   Pending ──[GatewayCallbackReceived (failure)]──► Failed
///   Pending ──[CashPaymentConfirmed]──────────────► Completed
///   Completed ──[RefundRequested]─────────────────► Refunded
///
/// The saga is persisted in PostgreSQL via EF Core (payment_saga_states table).
/// All integration event publishing happens inside saga transitions, protected by
/// the EF Core transactional outbox — events are only dispatched after the DB commit.
/// </summary>
public class PaymentStateMachine : MassTransitStateMachine<PaymentSagaState>
{
    private readonly ILogger<PaymentStateMachine> _logger;

    // ── States ─────────────────────────────────────────────────────────────────
    public State Pending { get; private set; } = null!;
    public State Completed { get; private set; } = null!;
    public State Failed { get; private set; } = null!;
    public State Refunded { get; private set; } = null!;

    // ── Events ─────────────────────────────────────────────────────────────────
    public Event<PaymentInitiated> PaymentInitiatedEvent { get; private set; } = null!;
    public Event<GatewayCallbackReceived> GatewayCallbackReceivedEvent { get; private set; } = null!;
    public Event<CashPaymentConfirmed> CashPaymentConfirmedEvent { get; private set; } = null!;
    public Event<RefundRequested> RefundRequestedEvent { get; private set; } = null!;

    public PaymentStateMachine(ILogger<PaymentStateMachine> logger)
    {
        _logger = logger;

        // ── State column mapping ────────────────────────────────────────────────
        InstanceState(s => s.CurrentState);

        // ── Event correlation definitions (MassTransit v8 syntax) ──────────────
        // All events carry CorrelationId (= Payment.SagaId) as the saga key
        Event(() => PaymentInitiatedEvent, x => x.CorrelateById(m => m.Message.CorrelationId));
        Event(() => GatewayCallbackReceivedEvent, x => x.CorrelateById(m => m.Message.CorrelationId));
        Event(() => CashPaymentConfirmedEvent, x => x.CorrelateById(m => m.Message.CorrelationId));
        Event(() => RefundRequestedEvent, x => x.CorrelateById(m => m.Message.CorrelationId));

        // ── Transitions ─────────────────────────────────────────────────────────

        // Initial → Pending on PaymentInitiated
        Initially(
            When(PaymentInitiatedEvent)
                .Then(OnPaymentInitiated)
                .TransitionTo(Pending));

        // Pending → Completed (gateway success) or Failed (gateway failure)
        During(Pending,
            When(GatewayCallbackReceivedEvent, ctx => ctx.Message.IsSuccess)
                .ThenAsync(OnPaymentSucceeded)
                .PublishAsync(ctx => ctx.Init<PaymentCompleted>(new PaymentCompleted
                {
                    CorrelationId = ctx.Saga.CorrelationId,
                    PaymentId = ctx.Saga.PaymentId,
                    OrderId = ctx.Saga.OrderId,
                    UserId = ctx.Saga.UserId,
                    Amount = ctx.Saga.Amount,
                    TransactionId = ctx.Saga.TransactionId ?? string.Empty,
                    PaymentMethod = ctx.Saga.PaymentMethod,
                    PaidAt = ctx.Saga.CompletedAt ?? DateTime.UtcNow
                }))
                .TransitionTo(Completed),

            When(GatewayCallbackReceivedEvent, ctx => !ctx.Message.IsSuccess)
                .ThenAsync(OnPaymentFailed)
                .PublishAsync(ctx => ctx.Init<PaymentFailed>(new PaymentFailed
                {
                    CorrelationId = ctx.Saga.CorrelationId,
                    PaymentId = ctx.Saga.PaymentId,
                    OrderId = ctx.Saga.OrderId,
                    UserId = ctx.Saga.UserId,
                    Reason = ctx.Saga.FailureReason ?? "Unknown failure"
                }))
                .TransitionTo(Failed),

            When(CashPaymentConfirmedEvent)
                .ThenAsync(OnCashPaymentConfirmed)
                .PublishAsync(ctx => ctx.Init<PaymentCompleted>(new PaymentCompleted
                {
                    CorrelationId = ctx.Saga.CorrelationId,
                    PaymentId = ctx.Saga.PaymentId,
                    OrderId = ctx.Saga.OrderId,
                    UserId = ctx.Saga.UserId,
                    Amount = ctx.Saga.Amount,
                    TransactionId = ctx.Saga.TransactionId ?? string.Empty,
                    PaymentMethod = ctx.Saga.PaymentMethod,
                    PaidAt = ctx.Saga.CompletedAt ?? DateTime.UtcNow
                }))
                .TransitionTo(Completed));

        // Completed → Refunded
        During(Completed,
            When(RefundRequestedEvent)
                .ThenAsync(OnRefundRequested)
                .PublishAsync(ctx => ctx.Init<PaymentRefunded>(new PaymentRefunded
                {
                    CorrelationId = ctx.Saga.CorrelationId,
                    PaymentId = ctx.Saga.PaymentId,
                    OrderId = ctx.Saga.OrderId,
                    UserId = ctx.Saga.UserId,
                    RefundAmount = ctx.Message.Amount,
                    Reason = ctx.Message.Reason
                }))
                .TransitionTo(Refunded));
    }

    // ── Handlers ───────────────────────────────────────────────────────────────

    private void OnPaymentInitiated(BehaviorContext<PaymentSagaState, PaymentInitiated> ctx)
    {
        var msg = ctx.Message;
        ctx.Saga.PaymentId = msg.PaymentId;
        ctx.Saga.OrderId = msg.OrderId;
        ctx.Saga.UserId = msg.UserId;
        ctx.Saga.Amount = msg.Amount;
        ctx.Saga.Currency = msg.Currency;
        ctx.Saga.PaymentMethod = msg.PaymentMethod;
        ctx.Saga.CreatedAt = DateTime.UtcNow;

        _logger.LogInformation(
            "Saga {CorrelationId}: PaymentInitiated — PaymentId={PaymentId}, OrderId={OrderId}, Method={Method}",
            ctx.Saga.CorrelationId, msg.PaymentId, msg.OrderId, msg.PaymentMethod);
    }

    private async Task OnPaymentSucceeded(BehaviorContext<PaymentSagaState, GatewayCallbackReceived> ctx)
    {
        var msg = ctx.Message;
        ctx.Saga.TransactionId = msg.TransactionId;
        ctx.Saga.CompletedAt = DateTime.UtcNow;

        // Update domain Payment entity (via service locator — avoids constructor injection issues in saga)
        var repository = ctx.GetPayload<IServiceProvider>()
            .GetService(typeof(IPaymentRepository)) as IPaymentRepository;

        if (repository != null)
        {
            var payment = await repository.GetByIdAsync(ctx.Saga.PaymentId);
            if (payment != null && payment.Status == PaymentStatus.PENDING)
                payment.Complete(msg.TransactionId ?? "N/A", msg.RawResponse);
        }

        _logger.LogInformation(
            "Saga {CorrelationId}: Payment {PaymentId} completed. TransactionId={TxId}",
            ctx.Saga.CorrelationId, ctx.Saga.PaymentId, msg.TransactionId);
    }

    private async Task OnPaymentFailed(BehaviorContext<PaymentSagaState, GatewayCallbackReceived> ctx)
    {
        var msg = ctx.Message;
        ctx.Saga.FailureReason = msg.ErrorMessage;
        ctx.Saga.CompletedAt = DateTime.UtcNow;

        var repository = ctx.GetPayload<IServiceProvider>()
            .GetService(typeof(IPaymentRepository)) as IPaymentRepository;

        if (repository != null)
        {
            var payment = await repository.GetByIdAsync(ctx.Saga.PaymentId);
            if (payment != null && payment.Status == PaymentStatus.PENDING)
                payment.Fail(msg.ErrorMessage);
        }

        _logger.LogWarning(
            "Saga {CorrelationId}: Payment {PaymentId} failed. Reason={Reason}",
            ctx.Saga.CorrelationId, ctx.Saga.PaymentId, msg.ErrorMessage);
    }

    private async Task OnCashPaymentConfirmed(BehaviorContext<PaymentSagaState, CashPaymentConfirmed> ctx)
    {
        var cashTransactionId = $"CASH-{ctx.Saga.PaymentId}-{DateTime.UtcNow:yyyyMMddHHmmss}";
        ctx.Saga.TransactionId = cashTransactionId;
        ctx.Saga.CompletedAt = DateTime.UtcNow;

        var repository = ctx.GetPayload<IServiceProvider>()
            .GetService(typeof(IPaymentRepository)) as IPaymentRepository;

        if (repository != null)
        {
            var payment = await repository.GetByIdAsync(ctx.Saga.PaymentId);
            if (payment != null && payment.Status == PaymentStatus.PENDING)
                payment.Complete(cashTransactionId, $"Cash confirmed by admin userId={ctx.Message.AdminUserId}");
        }

        _logger.LogInformation(
            "Saga {CorrelationId}: Cash payment {PaymentId} confirmed by admin {AdminId}",
            ctx.Saga.CorrelationId, ctx.Saga.PaymentId, ctx.Message.AdminUserId);
    }

    private async Task OnRefundRequested(BehaviorContext<PaymentSagaState, RefundRequested> ctx)
    {
        var repository = ctx.GetPayload<IServiceProvider>()
            .GetService(typeof(IPaymentRepository)) as IPaymentRepository;

        if (repository != null)
        {
            var payment = await repository.GetByIdAsync(ctx.Saga.PaymentId);
            if (payment != null)
                payment.AddRefund(ctx.Message.Amount, ctx.Message.Reason);
        }

        _logger.LogInformation(
            "Saga {CorrelationId}: Refund requested for payment {PaymentId}, amount={Amount}",
            ctx.Saga.CorrelationId, ctx.Saga.PaymentId, ctx.Message.Amount);
    }
}
