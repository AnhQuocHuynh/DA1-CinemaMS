using System;
using NotificationService.Domain.Enums;

namespace NotificationService.Domain.Entities;

public class NotificationTemplate
{
    public string Id { get; private set; }
    public string Code { get; private set; }
    public NotificationChannel Channel { get; private set; }
    public string Subject { get; private set; }
    public string BodyTemplate { get; private set; }
    public bool Active { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private NotificationTemplate()
    {
        Id = string.Empty;
        Code = string.Empty;
        Subject = string.Empty;
        BodyTemplate = string.Empty;
    }

    public NotificationTemplate(string code, NotificationChannel channel, string subject, string bodyTemplate)
    {
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("Code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(subject)) throw new ArgumentException("Subject is required.", nameof(subject));
        if (string.IsNullOrWhiteSpace(bodyTemplate)) throw new ArgumentException("BodyTemplate is required.", nameof(bodyTemplate));

        Id = string.Empty;
        Code = code;
        Channel = channel;
        Subject = subject;
        BodyTemplate = bodyTemplate;
        Active = true;
        CreatedAt = DateTime.UtcNow;
    }

    public void Update(string subject, string bodyTemplate, NotificationChannel channel)
    {
        if (string.IsNullOrWhiteSpace(subject)) throw new ArgumentException("Subject is required.", nameof(subject));
        if (string.IsNullOrWhiteSpace(bodyTemplate)) throw new ArgumentException("BodyTemplate is required.", nameof(bodyTemplate));

        Subject = subject;
        BodyTemplate = bodyTemplate;
        Channel = channel;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ToggleActive(bool active)
    {
        Active = active;
        UpdatedAt = DateTime.UtcNow;
    }
}
