using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using PaymentService.Application.DTOs;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Refunds.Queries;

public record GetRefundsByPaymentQuery(long PaymentId) : IRequest<IEnumerable<RefundDto>>;

public class GetRefundsByPaymentQueryHandler : IRequestHandler<GetRefundsByPaymentQuery, IEnumerable<RefundDto>>
{
    private readonly IRefundRepository _refundRepository;

    public GetRefundsByPaymentQueryHandler(IRefundRepository refundRepository)
    {
        _refundRepository = refundRepository;
    }

    public async Task<IEnumerable<RefundDto>> Handle(GetRefundsByPaymentQuery request, CancellationToken cancellationToken)
    {
        var refunds = await _refundRepository.GetByPaymentIdAsync(request.PaymentId, cancellationToken);
        
        return refunds.Select(r => new RefundDto(
            r.Id,
            r.PaymentId,
            r.Amount,
            r.Reason,
            r.Status,
            r.ProcessedAt,
            r.CreatedAt
        ));
    }
}
