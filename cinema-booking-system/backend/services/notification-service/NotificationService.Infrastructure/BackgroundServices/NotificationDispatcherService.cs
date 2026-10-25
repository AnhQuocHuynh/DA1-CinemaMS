using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NotificationService.Application.Contracts;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using NotificationService.Domain.ValueObjects;
using NotificationService.Infrastructure.Data;

namespace NotificationService.Infrastructure.BackgroundServices;

public class NotificationDispatcherService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<NotificationDispatcherService> _logger;

    public NotificationDispatcherService(
        IServiceProvider serviceProvider,
        ILogger<NotificationDispatcherService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Notification Dispatcher Service is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingNotificationsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while processing pending notifications.");
            }

            // Wait for 5 seconds before checking again
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }

        _logger.LogInformation("Notification Dispatcher Service is stopping.");
    }

    private async Task ProcessPendingNotificationsAsync(CancellationToken cancellationToken)
    {
        // Resolve scoped services
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
        var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var smsSender = scope.ServiceProvider.GetRequiredService<ISmsSender>();
        var pushSender = scope.ServiceProvider.GetRequiredService<IPushNotificationSender>();
        var preferenceRepository = scope.ServiceProvider.GetRequiredService<IUserPreferenceRepository>();
        var userResolver = scope.ServiceProvider.GetRequiredService<IKeycloakUserResolver>();

        // Find all pending notifications
        var filter = Builders<Notification>.Filter.Eq(n => n.Status, DeliveryStatus.PENDING) |
                     Builders<Notification>.Filter.Eq(n => n.Status, DeliveryStatus.RETRYING);
                     
        var pendingNotifications = await context.Notifications
            .Find(filter)
            .Limit(50) // process in batches
            .ToListAsync(cancellationToken);

        foreach (var notification in pendingNotifications)
        {
            if (cancellationToken.IsCancellationRequested) break;

            try
            {
                await DispatchNotificationAsync(notification, emailSender, smsSender, pushSender, preferenceRepository, userResolver, cancellationToken);
                
                // Update to SENT
                var update = Builders<Notification>.Update
                    .Set(n => n.Status, DeliveryStatus.SENT)
                    .Set(n => n.SentAt, DateTime.UtcNow)
                    .Set(n => n.FailedReason, null);

                await context.Notifications.UpdateOneAsync(
                    Builders<Notification>.Filter.Eq(n => n.Id, notification.Id),
                    update,
                    cancellationToken: cancellationToken);
                    
                // Log delivery success
                await LogDeliveryAsync(context, notification.Id, notification.RetryCount + 1, DeliveryStatus.SENT, "OK", cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send notification {Id}", notification.Id);
                
                var retryCount = notification.RetryCount + 1;
                var status = retryCount >= 3 ? DeliveryStatus.FAILED : DeliveryStatus.RETRYING;
                
                var update = Builders<Notification>.Update
                    .Set(n => n.Status, status)
                    .Set(n => n.RetryCount, retryCount)
                    .Set(n => n.FailedReason, ex.Message);
                    
                await context.Notifications.UpdateOneAsync(
                    Builders<Notification>.Filter.Eq(n => n.Id, notification.Id),
                    update,
                    cancellationToken: cancellationToken);
                    
                // Log delivery failure
                await LogDeliveryAsync(context, notification.Id, retryCount, status, ex.Message, cancellationToken);
            }
        }
    }

    private async Task DispatchNotificationAsync(
        Notification notification,
        IEmailSender emailSender,
        ISmsSender smsSender,
        IPushNotificationSender pushSender,
        IUserPreferenceRepository preferenceRepository,
        IKeycloakUserResolver userResolver,
        CancellationToken cancellationToken)
    {
        switch (notification.Channel)
        {
            case NotificationChannel.EMAIL:
                var email = GetMetadataValue(notification.Metadata, "Email", "email");
                if (string.IsNullOrWhiteSpace(email))
                {
                    var pref = await preferenceRepository.GetByUserIdAsync(notification.UserId, cancellationToken);
                    email = pref?.Contact?.Email;
                    if (string.IsNullOrWhiteSpace(email))
                    {
                        var userContact = await userResolver.GetUserContactAsync(notification.UserId, cancellationToken);
                        if (!string.IsNullOrWhiteSpace(userContact?.Email))
                        {
                            email = userContact.Email;
                            if (pref == null)
                            {
                                var newPref = new UserPreference(
                                    notification.UserId,
                                    new ContactDetails(userContact.Email, userContact.Phone),
                                    emailEnabled: true,
                                    smsEnabled: true,
                                    pushEnabled: true);
                                await preferenceRepository.UpsertAsync(newPref, cancellationToken);
                            }
                            else
                            {
                                pref.UpdatePreferences(
                                    new ContactDetails(userContact.Email, userContact.Phone ?? pref.Contact?.PhoneNumber),
                                    pref.EmailEnabled,
                                    pref.SmsEnabled,
                                    pref.PushEnabled);
                                await preferenceRepository.UpsertAsync(pref, cancellationToken);
                            }
                        }
                    }
                }
                if (string.IsNullOrWhiteSpace(email))
                    throw new InvalidOperationException($"Email address could not be resolved from metadata, user preferences, or identity service for user {notification.UserId}.");
                await emailSender.SendEmailAsync(email, notification.Title, notification.Body, cancellationToken);
                break;
                
            case NotificationChannel.SMS:
                var phone = GetMetadataValue(notification.Metadata, "Phone", "phone", "PhoneNumber", "phoneNumber");
                if (string.IsNullOrWhiteSpace(phone))
                {
                    var pref = await preferenceRepository.GetByUserIdAsync(notification.UserId, cancellationToken);
                    phone = pref?.Contact?.PhoneNumber;
                    if (string.IsNullOrWhiteSpace(phone))
                    {
                        var userContact = await userResolver.GetUserContactAsync(notification.UserId, cancellationToken);
                        if (!string.IsNullOrWhiteSpace(userContact?.Phone))
                        {
                            phone = userContact.Phone;
                        }
                    }
                }
                if (string.IsNullOrWhiteSpace(phone))
                    throw new InvalidOperationException($"Phone number could not be resolved from metadata, user preferences, or identity service for user {notification.UserId}.");
                await smsSender.SendSmsAsync(phone, notification.Body, cancellationToken);
                break;
                
            case NotificationChannel.PUSH:
                await pushSender.SendPushAsync(notification.UserId, notification.Title, notification.Body, cancellationToken);
                break;
                
            default:
                throw new NotSupportedException($"Channel {notification.Channel} is not supported.");
        }
    }

    private static string? GetMetadataValue(Dictionary<string, object>? metadata, params string[] keys)
    {
        if (metadata == null) return null;

        foreach (var key in keys)
        {
            foreach (var kvp in metadata)
            {
                if (string.Equals(kvp.Key, key, StringComparison.OrdinalIgnoreCase))
                {
                    if (kvp.Value is JsonElement jsonElement)
                    {
                        return jsonElement.GetString();
                    }
                    var str = kvp.Value?.ToString();
                    if (!string.IsNullOrWhiteSpace(str))
                    {
                        return str;
                    }
                }
            }
        }

        return null;
    }
    
    private async Task LogDeliveryAsync(MongoDbContext context, string notificationId, int attempt, DeliveryStatus status, string response, CancellationToken cancellationToken)
    {
        var log = new DeliveryLog(notificationId, attempt, status, response);
        await context.DeliveryLogs.InsertOneAsync(log, cancellationToken: cancellationToken);
    }
}
