using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Application.Contracts;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using NotificationService.Domain.ValueObjects;

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
    private readonly ITemplateRepository _templateRepository;
    private readonly ITemplateRenderer _templateRenderer;
    private readonly IKeycloakUserResolver? _userResolver;

    public SendNotificationCommandHandler(
        INotificationRepository notificationRepository,
        IUserPreferenceRepository preferenceRepository,
        ITemplateRepository templateRepository,
        ITemplateRenderer templateRenderer,
        IKeycloakUserResolver? userResolver = null)
    {
        _notificationRepository = notificationRepository;
        _preferenceRepository = preferenceRepository;
        _templateRepository = templateRepository;
        _templateRenderer = templateRenderer;
        _userResolver = userResolver;
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

        // Enrich metadata with contact details from UserPreference or IdentityService if not already present
        var metadata = request.Metadata ?? new Dictionary<string, object>();
        if (request.Channel == NotificationChannel.EMAIL && !HasKeyIgnoreCase(metadata, "Email"))
        {
            if (!string.IsNullOrWhiteSpace(pref?.Contact?.Email))
            {
                metadata["Email"] = pref.Contact.Email;
            }
            else if (_userResolver != null)
            {
                var userContact = await _userResolver.GetUserContactAsync(request.UserId, cancellationToken);
                if (!string.IsNullOrWhiteSpace(userContact?.Email))
                {
                    metadata["Email"] = userContact.Email;
                    if (pref == null)
                    {
                        var newPref = new UserPreference(
                            request.UserId,
                            new ContactDetails(userContact.Email, userContact.Phone),
                            emailEnabled: true,
                            smsEnabled: true,
                            pushEnabled: true);
                        await _preferenceRepository.UpsertAsync(newPref, cancellationToken);
                    }
                    else
                    {
                        pref.UpdatePreferences(
                            new ContactDetails(userContact.Email, userContact.Phone ?? pref.Contact?.PhoneNumber),
                            pref.EmailEnabled,
                            pref.SmsEnabled,
                            pref.PushEnabled);
                        await _preferenceRepository.UpsertAsync(pref, cancellationToken);
                    }
                }
            }
        }
        else if (request.Channel == NotificationChannel.SMS && !HasKeyIgnoreCase(metadata, "Phone") && !HasKeyIgnoreCase(metadata, "PhoneNumber"))
        {
            if (!string.IsNullOrWhiteSpace(pref?.Contact?.PhoneNumber))
            {
                metadata["Phone"] = pref.Contact.PhoneNumber;
            }
            else if (_userResolver != null)
            {
                var userContact = await _userResolver.GetUserContactAsync(request.UserId, cancellationToken);
                if (!string.IsNullOrWhiteSpace(userContact?.Phone))
                {
                    metadata["Phone"] = userContact.Phone;
                }
            }
        }

        // Attempt to render title and body from a template matching the notification type.
        // Falls back to the pre-rendered title/body from the command if no active template is found.
        var title = request.Title;
        var body = request.Body;
        
        var templateCode = MapTypeToTemplateCode(request.Type);
        if (templateCode != null)
        {
            var template = await _templateRepository.GetByCodeAsync(templateCode, cancellationToken);
            if (template != null && template.Active)
            {
                title = _templateRenderer.Render(template.Subject, metadata);
                body = _templateRenderer.Render(template.BodyTemplate, metadata);
            }
        }

        var notification = new Notification(
            request.UserId,
            request.Type,
            request.Channel,
            title,
            body,
            metadata
        );

        await _notificationRepository.InsertAsync(notification, cancellationToken);

        return notification.Id;
    }

    private static bool HasKeyIgnoreCase(Dictionary<string, object> dict, string key)
    {
        foreach (var k in dict.Keys)
        {
            if (string.Equals(k, key, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    /// <summary>
    /// Maps a <see cref="NotificationType"/> to its corresponding template code.
    /// Returns null if no template mapping is defined for the type.
    /// </summary>
    private static string? MapTypeToTemplateCode(NotificationType type) => type switch
    {
        NotificationType.BOOKING_CONFIRMATION => "BOOKING_CONFIRMED",
        NotificationType.PAYMENT_RECEIPT => "PAYMENT_RECEIPT",
        NotificationType.PASSWORD_RESET => "PASSWORD_RESET",
        NotificationType.PROMOTIONAL => "PROMOTIONAL",
        NotificationType.SHOWTIME_REMINDER => "SHOWTIME_REMINDER",
        _ => null
    };
}
