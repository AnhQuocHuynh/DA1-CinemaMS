using System;
using System.Collections.Generic;
using NotificationService.Domain.Enums;

namespace NotificationService.Application.DTOs;

public class NotificationDto
{
    public string Id { get; set; } = string.Empty;
    public long UserId { get; set; }
    public NotificationType Type { get; set; }
    public NotificationChannel Channel { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public Dictionary<string, object> Metadata { get; set; } = new();
    public DeliveryStatus Status { get; set; }
    public int RetryCount { get; set; }
    public DateTime? SentAt { get; set; }
    public string? FailedReason { get; set; }
    public DateTime CreatedAt { get; set; }
}
