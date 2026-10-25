using System.Threading;
using System.Threading.Tasks;
using MediatR;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Notifications.Commands;

public record RetryAllFailedCommand() : IRequest<int>;

public class RetryAllFailedCommandHandler : IRequestHandler<RetryAllFailedCommand, int>
{
    private readonly INotificationRepository _notificationRepository;

    public RetryAllFailedCommandHandler(INotificationRepository notificationRepository)
    {
        _notificationRepository = notificationRepository;
    }

    public async Task<int> Handle(RetryAllFailedCommand request, CancellationToken cancellationToken)
    {
        return await _notificationRepository.ResetAllFailedToPendingAsync(cancellationToken);
    }
}
