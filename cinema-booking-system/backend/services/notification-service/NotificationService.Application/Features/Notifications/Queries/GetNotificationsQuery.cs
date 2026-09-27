using System.Threading;
using System.Threading.Tasks;
using MediatR;
using NotificationService.Application.DTOs;

namespace NotificationService.Application.Features.Notifications.Queries;

public record GetNotificationsQuery(int Page = 1, int PageSize = 10) : IRequest<PagedResult<NotificationDto>>;

public class GetNotificationsQueryHandler : IRequestHandler<GetNotificationsQuery, PagedResult<NotificationDto>>
{
    // Requires a method on INotificationRepository for paginated fetch: 
    // Task<(IEnumerable<Notification>, int)> GetPagedAsync(...)
    
    public Task<PagedResult<NotificationDto>> Handle(GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        // TODO: Implement paginated fetch from repository
        return Task.FromResult(new PagedResult<NotificationDto>());
    }
}
