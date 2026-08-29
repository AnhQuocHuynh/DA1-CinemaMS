using System;
using NotificationService.Domain.ValueObjects;

namespace NotificationService.Domain.Entities;

public class UserPreference
{
    public long UserId { get; private set; }
    public ContactDetails? Contact { get; private set; }
    public bool EmailEnabled { get; private set; }
    public bool SmsEnabled { get; private set; }
    public bool PushEnabled { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private UserPreference() { } // MongoDB

    public UserPreference(long userId, ContactDetails? contact = null, bool emailEnabled = true, bool smsEnabled = true, bool pushEnabled = true)
    {
        if (userId <= 0) throw new ArgumentException("UserId must be greater than zero.", nameof(userId));

        UserId = userId;
        Contact = contact;
        EmailEnabled = emailEnabled;
        SmsEnabled = smsEnabled;
        PushEnabled = pushEnabled;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdatePreferences(ContactDetails? contact, bool emailEnabled, bool smsEnabled, bool pushEnabled)
    {
        Contact = contact ?? Contact; // Only update if provided, otherwise keep existing
        EmailEnabled = emailEnabled;
        SmsEnabled = smsEnabled;
        PushEnabled = pushEnabled;
        UpdatedAt = DateTime.UtcNow;
    }
}
