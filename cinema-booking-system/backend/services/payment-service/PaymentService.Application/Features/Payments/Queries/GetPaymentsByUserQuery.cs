using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using PaymentService.Application.DTOs;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Payments.Queries;

public record GetPaymentsByUserQuery(long UserId) : IRequest<IEnumerable<PaymentDto>>;

public class GetPaymentsByUserQueryHandler : IRequestHandler<GetPaymentsByUserQuery, IEnumerable<PaymentDto>>
{
    private readonly IPaymentRepository _paymentRepository;

    public GetPaymentsByUserQueryHandler(IPaymentRepository paymentRepository)
    {
        _paymentRepository = paymentRepository;
    }

    public async Task<IEnumerable<PaymentDto>> Handle(GetPaymentsByUserQuery request, CancellationToken cancellationToken)
    {
        var payments = await _paymentRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        
        return payments.Select(payment => new PaymentDto(
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
        ));
    }
}
