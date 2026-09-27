using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Application.Features.Refunds.Commands;

public record RequestRefundCommand(long PaymentId, decimal Amount, string Reason) : IRequest<RefundDto>;

public class RequestRefundCommandValidator : AbstractValidator<RequestRefundCommand>
{
    public RequestRefundCommandValidator()
    {
        RuleFor(x => x.PaymentId).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Reason).NotEmpty();
    }
}

public class RequestRefundCommandHandler : IRequestHandler<RequestRefundCommand, RefundDto>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IUnitOfWork _unitOfWork;

    public RequestRefundCommandHandler(IPaymentRepository paymentRepository, IUnitOfWork unitOfWork)
    {
        _paymentRepository = paymentRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<RefundDto> Handle(RequestRefundCommand request, CancellationToken cancellationToken)
    {
        var payment = await _paymentRepository.GetByIdAsync(request.PaymentId, cancellationToken);
        if (payment == null)
            throw new PaymentNotFoundException(request.PaymentId);

        // Domain logic to add refund
        var refund = payment.AddRefund(request.Amount, request.Reason);

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
