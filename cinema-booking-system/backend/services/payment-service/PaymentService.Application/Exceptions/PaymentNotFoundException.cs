using System;

namespace PaymentService.Application.Exceptions;

public class PaymentNotFoundException : Exception
{
    public PaymentNotFoundException(long paymentId) 
        : base($"Payment with ID {paymentId} was not found.")
    {
    }
}
