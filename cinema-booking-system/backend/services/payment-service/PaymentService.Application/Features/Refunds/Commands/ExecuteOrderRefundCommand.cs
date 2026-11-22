using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MassTransit;
using MediatR;
using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Refunds.Commands;

public record ExecuteOrderRefundCommand(long OrderId, decimal Amount, string Reason) : IRequest<RefundDto>;

public class ExecuteOrderRefundCommandValidator : AbstractValidator<ExecuteOrderRefundCommand>
{
    public ExecuteOrderRefundCommandValidator()
    {
        RuleFor(x => x.OrderId).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public class ExecuteOrderRefundCommandHandler : IRequestHandler<ExecuteOrderRefundCommand, RefundDto>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPaymentGatewayFactory _paymentGatewayFactory;
    private readonly IPublishEndpoint? _publishEndpoint;

    public ExecuteOrderRefundCommandHandler(
        IPaymentRepository paymentRepository,
        IUnitOfWork unitOfWork,
        IPaymentGatewayFactory paymentGatewayFactory,
        IPublishEndpoint? publishEndpoint = null)
    {
        _paymentRepository = paymentRepository;
        _unitOfWork = unitOfWork;
        _paymentGatewayFactory = paymentGatewayFactory;
        _publishEndpoint = publishEndpoint;
    }

    public async Task<RefundDto> Handle(ExecuteOrderRefundCommand request, CancellationToken cancellationToken)
    {
        var payment = await _paymentRepository.GetByOrderIdAsync(request.OrderId, cancellationToken);
        if (payment == null)
            throw new PaymentNotFoundException(request.OrderId);

        if (payment.Status == PaymentStatus.REFUNDED)
        {
            var existingRefund = payment.Refunds.LastOrDefault();
            return new RefundDto(
                existingRefund?.Id ?? 0,
                payment.Id,
                existingRefund?.Amount ?? request.Amount,
                existingRefund?.Reason ?? request.Reason,
                existingRefund?.Status ?? RefundStatus.PROCESSED,
                existingRefund?.ProcessedAt,
                existingRefund?.CreatedAt ?? DateTime.UtcNow
            );
        }

        if (payment.Status != PaymentStatus.COMPLETED && payment.Status != PaymentStatus.PARTIALLY_REFUNDED)
            throw new InvalidPaymentStateException($"Cannot refund payment in status {payment.Status}");

        // For online gateways (Stripe/PayPal), execute gateway refund
        if (!string.IsNullOrEmpty(payment.TransactionId) && payment.PaymentMethod.HasValue && payment.PaymentMethod.Value != PaymentMethod.CASH)
        {
            var gateway = _paymentGatewayFactory.GetGateway(payment.PaymentMethod.Value);
            var refundResult = await gateway.RefundAsync(payment.TransactionId, request.Amount, payment.Currency);
            if (!refundResult.IsSuccess)
            {
                throw new PaymentGatewayException($"Gateway refund failed: {refundResult.ErrorMessage}");
            }
        }

        var refund = payment.AddRefund(request.Amount, request.Reason);
        refund.Approve();
        refund.Process();
        payment.MarkAsRefunded();

        if (_publishEndpoint != null)
        {
            await _publishEndpoint.Publish(new RefundRequested
            {
                CorrelationId = payment.SagaId,
                PaymentId = payment.Id,
                Amount = request.Amount,
                Reason = request.Reason
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new RefundDto(
            refund.Id,
            refund.PaymentId,
            refund.Amount,
            refund.Reason,
            refund.Status,
            refund.ProcessedAt,
            refund.CreatedAt
        );
    }
}
