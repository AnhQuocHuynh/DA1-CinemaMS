using System;

namespace PaymentService.Application.Exceptions;

public class DuplicateTransactionException : Exception
{
    public DuplicateTransactionException(string transactionId) 
        : base($"A transaction with ID {transactionId} has already been processed.")
    {
    }
}
