using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using NotificationService.Application.Contracts;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.Messaging;
using Xunit;

namespace NotificationService.Test.Integration;

public class NotificationTestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public NotificationTestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (Request.Headers.TryGetValue("Authorization", out var authHeader) && authHeader.ToString().StartsWith("Test "))
        {
            var token = authHeader.ToString().Substring(5);
            var parts = token.Split(':');
            var userId = parts[0];
            var role = parts.Length > 1 ? parts[1] : "user";

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Role, role),
                new Claim("userId", userId),
                new Claim("sub", userId)
            };

            var identity = new ClaimsIdentity(claims, "Test");
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, "Test");

            return Task.FromResult(AuthenticateResult.Success(ticket));
        }

        return Task.FromResult(AuthenticateResult.Fail("No Test token provided"));
    }
}

public class NotificationEndpointsIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly Mock<INotificationRepository> _notifRepoMock = new();
    private readonly Mock<IPushNotificationSender> _pushSenderMock = new();

    public NotificationEndpointsIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Disable background consumers and dispatchers during HTTP endpoint tests
                services.RemoveAll<IHostedService>();

                // Replace repository and push sender with test mocks
                services.RemoveAll<INotificationRepository>();
                services.AddSingleton(_notifRepoMock.Object);

                services.RemoveAll<IPushNotificationSender>();
                services.AddSingleton(_pushSenderMock.Object);

                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = "Test";
                    options.DefaultChallengeScheme = "Test";
                })
                .AddScheme<AuthenticationSchemeOptions, NotificationTestAuthHandler>("Test", _ => { });
            });
        });
    }

    [Fact]
    public async Task GetMyNotifications_ShouldReturn401_WhenNoAuthHeader()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/notifications/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMyNotifications_ShouldReturnNotifications_WhenAuthenticated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test", "42:user");
        client.DefaultRequestHeaders.Add("X-User-Id", "42");

        var testNotification = new Notification(42, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.PUSH, "Title", "Body");
        _notifRepoMock.Setup(r => r.GetByUserIdAsync(42, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { testNotification });

        // Act
        var response = await client.GetAsync("/api/notifications/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task MarkAsRead_ShouldReturnNoContent_WhenNotificationBelongsToUser()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test", "42:user");
        client.DefaultRequestHeaders.Add("X-User-Id", "42");

        const string notifId = "notif-abc";
        var testNotification = new Notification(42, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.PUSH, "Title", "Body");
        _notifRepoMock.Setup(r => r.GetByIdAsync(notifId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(testNotification);

        // Act
        var response = await client.PutAsync($"/api/notifications/{notifId}/read", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        testNotification.IsRead.Should().BeTrue();
        testNotification.ReadAt.Should().NotBeNull();
        _notifRepoMock.Verify(r => r.UpdateAsync(testNotification, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkAllAsRead_ShouldReturnNoContent_WhenAuthenticated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test", "42:user");
        client.DefaultRequestHeaders.Add("X-User-Id", "42");

        // Act
        var response = await client.PutAsync("/api/notifications/read-all", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        _notifRepoMock.Verify(r => r.MarkAllAsReadAsync(42, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SignalRNegotiate_ShouldSucceed_WhenAuthenticated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test", "42:user");

        // Act
        var response = await client.PostAsync("/hubs/notifications/negotiate?negotiateVersion=1", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("connectionId");
    }
}
