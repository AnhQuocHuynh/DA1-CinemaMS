using System;

namespace PaymentService.Application.Exceptions;

public class InvalidPaymentStateException : Exception
{
    public InvalidPaymentStateException(string message) : base(message)
    {
    }
}
