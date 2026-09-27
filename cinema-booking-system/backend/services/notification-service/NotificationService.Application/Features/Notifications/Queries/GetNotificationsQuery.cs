using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using NotificationService.Application.DTOs;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Notifications.Queries;

public record GetNotificationsQuery(int Page = 1, int PageSize = 10) : IRequest<PagedResult<NotificationDto>>;

public class GetNotificationsQueryHandler : IRequestHandler<GetNotificationsQuery, PagedResult<NotificationDto>>
{
    private readonly INotificationRepository _notificationRepository;

    public GetNotificationsQueryHandler(INotificationRepository notificationRepository)
    {
        _notificationRepository = notificationRepository;
    }

    public async Task<PagedResult<NotificationDto>> Handle(GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        var (items, totalCount) = await _notificationRepository.GetPagedAsync(
            request.Page, request.PageSize, cancellationToken);

        return new PagedResult<NotificationDto>
        {
            Items = items.Select(n => new NotificationDto
            {
                Id = n.Id,
                UserId = n.UserId,
                Type = n.Type,
                Channel = n.Channel,
                Title = n.Title,
                Body = n.Body,
                Metadata = n.Metadata,
                Status = n.Status,
                RetryCount = n.RetryCount,
                SentAt = n.SentAt,
                FailedReason = n.FailedReason,
                CreatedAt = n.CreatedAt
            }),
            TotalCount = (int)totalCount,
            Page = request.Page,
            PageSize = request.PageSize
        };
    }
}
