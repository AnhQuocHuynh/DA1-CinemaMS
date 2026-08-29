using System.Threading;
using System.Threading.Tasks;
using MediatR;
using NotificationService.Application.DTOs;
using NotificationService.Application.Exceptions;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Notifications.Queries;

public record GetNotificationByIdQuery(string Id) : IRequest<NotificationDto>;

public class GetNotificationByIdQueryHandler : IRequestHandler<GetNotificationByIdQuery, NotificationDto>
{
    private readonly INotificationRepository _notificationRepository;

    public GetNotificationByIdQueryHandler(INotificationRepository notificationRepository)
    {
        _notificationRepository = notificationRepository;
    }

    public async Task<NotificationDto> Handle(GetNotificationByIdQuery request, CancellationToken cancellationToken)
    {
        var notification = await _notificationRepository.GetByIdAsync(request.Id, cancellationToken)
            ?? throw new NotificationNotFoundException(request.Id);

        return new NotificationDto
        {
            Id = notification.Id,
            UserId = notification.UserId,
            Type = notification.Type,
            Channel = notification.Channel,
            Title = notification.Title,
            Body = notification.Body,
            Metadata = notification.Metadata,
            Status = notification.Status,
            RetryCount = notification.RetryCount,
            SentAt = notification.SentAt,
            FailedReason = notification.FailedReason,
            CreatedAt = notification.CreatedAt
        };
    }
}
