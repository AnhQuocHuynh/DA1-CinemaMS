using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Contracts;

namespace NotificationService.Infrastructure.Services;

public class DummySmsSender : ISmsSender
{
    private readonly ILogger<DummySmsSender> _logger;

    public DummySmsSender(ILogger<DummySmsSender> logger)
    {
        _logger = logger;
    }

    public Task SendSmsAsync(string phoneNumber, string message, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending SMS to {PhoneNumber}: {Message}", phoneNumber, message);
        return Task.CompletedTask;
    }
}
