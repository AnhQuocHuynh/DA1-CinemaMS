using System.Threading;
using System.Threading.Tasks;
using MassTransit;
using MediatR;
using PaymentService.Application.Contracts;
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
    private readonly IPaymentGatewayFactory _paymentGatewayFactory;

    public ProcessRefundCommandHandler(
        IRefundRepository refundRepository,
        IPaymentRepository paymentRepository,
        IUnitOfWork unitOfWork,
        IPublishEndpoint publishEndpoint,
        IPaymentGatewayFactory paymentGatewayFactory)
    {
        _refundRepository = refundRepository;
        _paymentRepository = paymentRepository;
        _unitOfWork = unitOfWork;
        _publishEndpoint = publishEndpoint;
        _paymentGatewayFactory = paymentGatewayFactory;
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

            var gateway = _paymentGatewayFactory.GetGateway(payment.PaymentMethod);
            if (string.IsNullOrEmpty(payment.TransactionId))
                throw new PaymentGatewayException("Payment has no transaction ID.");

            var refundResult = await gateway.RefundAsync(payment.TransactionId, refund.Amount, payment.Currency);

            if (!refundResult.IsSuccess)
                throw new PaymentGatewayException($"Gateway refund failed: {refundResult.ErrorMessage}");

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
