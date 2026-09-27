using System.Threading;
using System.Threading.Tasks;
using MediatR;

namespace NotificationService.Application.Features.Notifications.Commands;

public record RetryAllFailedCommand() : IRequest<int>;

public class RetryAllFailedCommandHandler : IRequestHandler<RetryAllFailedCommand, int>
{
    // Implementation would likely require a new method on INotificationRepository
    // like Task<int> ResetFailedToPendingAsync(CancellationToken ct);
    // For now, returning 0 as a stub since repository method isn't strictly defined in the plan for this bulk op.
    
    public Task<int> Handle(RetryAllFailedCommand request, CancellationToken cancellationToken)
    {
        // TODO: Implement bulk retry logic via repository
        return Task.FromResult(0);
    }
}
