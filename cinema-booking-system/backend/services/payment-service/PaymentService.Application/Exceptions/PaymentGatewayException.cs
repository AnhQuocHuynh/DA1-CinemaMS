using System;

namespace PaymentService.Application.Exceptions;

public class PaymentGatewayException : Exception
{
    public PaymentGatewayException(string message) : base(message)
    {
    }

    public PaymentGatewayException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
