using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using NotificationService.Application.DTOs;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Notifications.Queries;

public record GetNotificationsByUserQuery(long UserId) : IRequest<IEnumerable<NotificationDto>>;

public class GetNotificationsByUserQueryHandler : IRequestHandler<GetNotificationsByUserQuery, IEnumerable<NotificationDto>>
{
    private readonly INotificationRepository _notificationRepository;

    public GetNotificationsByUserQueryHandler(INotificationRepository notificationRepository)
    {
        _notificationRepository = notificationRepository;
    }

    public async Task<IEnumerable<NotificationDto>> Handle(GetNotificationsByUserQuery request, CancellationToken cancellationToken)
    {
        var notifications = await _notificationRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        
        return notifications.Select(n => new NotificationDto
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
        });
    }
}
