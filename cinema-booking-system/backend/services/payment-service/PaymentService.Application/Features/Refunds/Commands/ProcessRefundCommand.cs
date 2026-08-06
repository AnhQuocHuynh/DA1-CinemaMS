using System.Threading;
using System.Threading.Tasks;
using MassTransit;
using MediatR;
using PaymentService.Application.Exceptions;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Refunds.Commands;

public record ProcessRefundCommand(long RefundId, bool Approve) : IRequest<bool>;

public class ProcessRefundCommandHandler : IRequestHandler<ProcessRefundCommand, bool>
{
    private readonly IRefundRepository _refundRepository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPublishEndpoint _publishEndpoint;

    public ProcessRefundCommandHandler(
        IRefundRepository refundRepository,
        IPaymentRepository paymentRepository,
        IUnitOfWork unitOfWork,
        IPublishEndpoint publishEndpoint)
    {
        _refundRepository = refundRepository;
        _paymentRepository = paymentRepository;
        _unitOfWork = unitOfWork;
        _publishEndpoint = publishEndpoint;
    }

    public async Task<bool> Handle(ProcessRefundCommand request, CancellationToken cancellationToken)
    {
        var refund = await _refundRepository.GetByIdAsync(request.RefundId, cancellationToken);
        if (refund == null)
            throw new PaymentGatewayException($"Refund {request.RefundId} not found");

        var payment = await _paymentRepository.GetByIdAsync(refund.PaymentId, cancellationToken);
        if (payment == null)
            throw new PaymentNotFoundException(refund.PaymentId);

        if (request.Approve)
        {
            refund.Approve();

            // In a real system, call the Payment Gateway to execute the refund (Stripe/PayPal API)
            // For now, simulate success and mark as processed immediately.
            refund.Process();
            payment.MarkAsRefunded();

            // Publish RefundRequested → saga transitions Completed → Refunded → publishes PaymentRefunded
            await _publishEndpoint.Publish(new RefundRequested
            {
                CorrelationId = payment.SagaId,
                PaymentId = payment.Id,
                Amount = refund.Amount,
                Reason = refund.Reason
            }, cancellationToken);
        }
        else
        {
            refund.Reject();
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}
