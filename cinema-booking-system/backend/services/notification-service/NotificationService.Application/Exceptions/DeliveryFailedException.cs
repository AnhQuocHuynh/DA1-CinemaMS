using System;

namespace NotificationService.Application.Exceptions;

public class DeliveryFailedException : Exception
{
    public DeliveryFailedException(string message) : base(message)
    {
    }
    
    public DeliveryFailedException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
