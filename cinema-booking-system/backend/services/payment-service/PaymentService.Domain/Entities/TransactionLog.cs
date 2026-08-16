using System;
using PaymentService.Domain.Enums;

namespace PaymentService.Domain.Entities;

public class TransactionLog
{
    public long Id { get; private set; }
    public long PaymentId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string? Request { get; private set; }
    public string? Response { get; private set; }
    public int? StatusCode { get; private set; }
    public DateTime Timestamp { get; private set; } = DateTime.UtcNow;

    protected TransactionLog() { } // EF Core

    public TransactionLog(long paymentId, string action, string? request, string? response, int? statusCode)
    {
        PaymentId = paymentId;
        Action = action;
        Request = request;
        Response = response;
        StatusCode = statusCode;
        Timestamp = DateTime.UtcNow;
    }
}
