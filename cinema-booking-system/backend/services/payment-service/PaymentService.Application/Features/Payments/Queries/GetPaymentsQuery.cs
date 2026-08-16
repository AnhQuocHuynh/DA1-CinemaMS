using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using PaymentService.Application.DTOs;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Payments.Queries;

public record GetPaymentsQuery(int Page, int PageSize) : IRequest<PagedResult<PaymentDto>>;

public class GetPaymentsQueryHandler : IRequestHandler<GetPaymentsQuery, PagedResult<PaymentDto>>
{
    private readonly IPaymentRepository _paymentRepository;

    public GetPaymentsQueryHandler(IPaymentRepository paymentRepository)
    {
        _paymentRepository = paymentRepository;
    }

    public async Task<PagedResult<PaymentDto>> Handle(GetPaymentsQuery request, CancellationToken cancellationToken)
    {
        var (items, totalCount) = await _paymentRepository.GetPaginatedAsync(request.Page, request.PageSize, cancellationToken);
        
        var dtos = items.Select(payment => new PaymentDto(
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

        return new PagedResult<PaymentDto>
        {
            Items = dtos,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize
        };
    }
}
