namespace NotificationService.Application.DTOs;

public class PreferenceDto
{
    public long UserId { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public bool EmailEnabled { get; set; }
    public bool SmsEnabled { get; set; }
    public bool PushEnabled { get; set; }
}
