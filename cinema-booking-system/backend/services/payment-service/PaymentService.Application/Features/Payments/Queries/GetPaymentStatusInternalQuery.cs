using System.Threading;
using System.Threading.Tasks;
using MediatR;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Payments.Queries;

public record GetPaymentStatusInternalQuery(long OrderId) : IRequest<PaymentStatus>;

public class GetPaymentStatusInternalQueryHandler : IRequestHandler<GetPaymentStatusInternalQuery, PaymentStatus>
{
    private readonly IPaymentRepository _paymentRepository;

    public GetPaymentStatusInternalQueryHandler(IPaymentRepository paymentRepository)
    {
        _paymentRepository = paymentRepository;
    }

    public async Task<PaymentStatus> Handle(GetPaymentStatusInternalQuery request, CancellationToken cancellationToken)
    {
        var payment = await _paymentRepository.GetByOrderIdAsync(request.OrderId, cancellationToken);
        
        // If no payment found, it's basically pending from the booking perspective or we can throw.
        // Returning PENDING by default or based on business logic. 
        return payment?.Status ?? PaymentStatus.PENDING; 
    }
}
