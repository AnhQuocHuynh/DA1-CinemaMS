using System;

namespace NotificationService.Application.Exceptions;

public class NotificationNotFoundException : Exception
{
    public NotificationNotFoundException(string id) 
        : base($"Notification with ID '{id}' was not found.")
    {
    }
}
