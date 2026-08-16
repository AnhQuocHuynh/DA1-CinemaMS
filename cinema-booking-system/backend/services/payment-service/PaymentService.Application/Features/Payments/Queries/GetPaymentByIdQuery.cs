using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Payments.Queries;

public record GetPaymentByIdQuery(long PaymentId) : IRequest<PaymentDto>;

public class GetPaymentByIdQueryHandler : IRequestHandler<GetPaymentByIdQuery, PaymentDto>
{
    private readonly IPaymentRepository _paymentRepository;

    public GetPaymentByIdQueryHandler(IPaymentRepository paymentRepository)
    {
        _paymentRepository = paymentRepository;
    }

    public async Task<PaymentDto> Handle(GetPaymentByIdQuery request, CancellationToken cancellationToken)
    {
        var payment = await _paymentRepository.GetByIdAsync(request.PaymentId, cancellationToken);
        if (payment == null)
            throw new PaymentNotFoundException(request.PaymentId);

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
