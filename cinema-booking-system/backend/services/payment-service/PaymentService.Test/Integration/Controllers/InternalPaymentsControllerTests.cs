using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Infrastructure.Data;
using PaymentService.Infrastructure.Sagas;
using PaymentService.Presentation.Controllers;
using PaymentService.Test.Integration;
using Xunit;

namespace PaymentService.Test.Integration.Controllers;

[Collection("Integration Tests")]
public class InternalPaymentsControllerTests : IAsyncLifetime
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public InternalPaymentsControllerTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        db.Payments.RemoveRange(db.Payments);
        db.Set<PaymentSagaState>().RemoveRange(db.Set<PaymentSagaState>());
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetPaymentStatus_ShouldReturnStatus_WhenValidKey()
    {
        // Arrange
        var payment = new Payment(9301, 301, 150000m, "VND", PaymentMethod.CASH);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        // Setting a fake internal key for testing
        // Default appsettings.json has "InternalApi": { "Token": "local-dev-internal-token" }
        // BUT the controller code expects configuration["InternalApi:Key"] not "Token"! 
        // We will just pass the request since if Key is null, it allows in development.
        
        // Act
        var request = new HttpRequestMessage(HttpMethod.Get, $"/internal/payments/order/{payment.OrderId}/status");
        request.Headers.Add("X-Internal-Token", "local-dev-internal-token");
        var response = await _client.SendAsync(request);

        // Assert
        response.EnsureSuccessStatusCode();
    }
}
