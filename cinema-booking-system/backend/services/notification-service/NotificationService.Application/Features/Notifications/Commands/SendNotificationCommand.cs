using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Notifications.Commands;

public record SendNotificationCommand(
    long UserId,
    NotificationType Type,
    NotificationChannel Channel,
    string Title,
    string Body,
    Dictionary<string, object> Metadata) : IRequest<string>;

public class SendNotificationCommandValidator : AbstractValidator<SendNotificationCommand>
{
    public SendNotificationCommandValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.Type).IsInEnum();
        RuleFor(x => x.Channel).IsInEnum();
        RuleFor(x => x.Title).NotEmpty();
        RuleFor(x => x.Body).NotEmpty();
    }
}

public class SendNotificationCommandHandler : IRequestHandler<SendNotificationCommand, string>
{
    private readonly INotificationRepository _notificationRepository;
    private readonly IUserPreferenceRepository _preferenceRepository;

    public SendNotificationCommandHandler(
        INotificationRepository notificationRepository,
        IUserPreferenceRepository preferenceRepository)
    {
        _notificationRepository = notificationRepository;
        _preferenceRepository = preferenceRepository;
    }

    public async Task<string> Handle(SendNotificationCommand request, CancellationToken cancellationToken)
    {
        var pref = await _preferenceRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        
        bool isChannelEnabled = request.Channel switch
        {
            NotificationChannel.EMAIL => pref == null || pref.EmailEnabled,
            NotificationChannel.SMS => pref == null || pref.SmsEnabled,
            NotificationChannel.PUSH => pref == null || pref.PushEnabled,
            _ => true
        };

        if (!isChannelEnabled)
        {
            return "Skipped due to user preference";
        }
        var notification = new Notification(
            request.UserId,
            request.Type,
            request.Channel,
            request.Title,
            request.Body,
            request.Metadata
        );

        await _notificationRepository.InsertAsync(notification, cancellationToken);

        return notification.Id;
    }
}
