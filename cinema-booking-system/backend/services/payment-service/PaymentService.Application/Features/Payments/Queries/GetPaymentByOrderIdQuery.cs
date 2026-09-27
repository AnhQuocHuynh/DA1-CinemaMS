using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Payments.Queries;

public record GetPaymentByOrderIdQuery(long OrderId) : IRequest<PaymentDto>;

public class GetPaymentByOrderIdQueryHandler : IRequestHandler<GetPaymentByOrderIdQuery, PaymentDto>
{
    private readonly IPaymentRepository _paymentRepository;

    public GetPaymentByOrderIdQueryHandler(IPaymentRepository paymentRepository)
    {
        _paymentRepository = paymentRepository;
    }

    public async Task<PaymentDto> Handle(GetPaymentByOrderIdQuery request, CancellationToken cancellationToken)
    {
        var payment = await _paymentRepository.GetByOrderIdAsync(request.OrderId, cancellationToken);
        if (payment == null)
            throw new PaymentNotFoundException(request.OrderId); // Need to use standard or custom error, here we use generic one or throw KeyNotFound

        return new PaymentDto(
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
            payment.Refunds.Select(r => new RefundDto(
                r.Id, r.PaymentId, r.Amount, r.Reason, r.Status, r.ProcessedAt, r.CreatedAt
            ))
        );
    }
}
