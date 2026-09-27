using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Infrastructure.Data;
using PaymentService.Presentation.Controllers;
using PaymentService.Test.Integration;
using Xunit;

namespace PaymentService.Test.Integration.Controllers;

[Collection("IntegrationTests")]
public class RefundsControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public RefundsControllerTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task RequestRefund_ShouldReturnAccepted_WhenPaymentIsCompleted()
    {
        // Arrange
        var payment = new Payment(9994, 201, 200000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("txn_123", "success"); // Needs to be completed to allow refund

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        _client.DefaultRequestHeaders.Add("Authorization", "Test 201:user");
        var request = new RequestRefundRequest(200000m, "Customer changed mind");

        // Act
        var response = await _client.PostAsJsonAsync($"/api/payments/{payment.Id}/refund", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
    }

    [Fact]
    public async Task ProcessRefund_ShouldReturnOk_WhenAdminApproves()
    {
        // Arrange
        var payment = new Payment(9995, 202, 100000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("txn_456", "success");

        var refund = payment.AddRefund(100000m, "Duplicate order");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        _client.DefaultRequestHeaders.Add("Authorization", "Test 203:ADMIN");
        var request = new ProcessRefundRequest(Approve: true);

        // Act
        var response = await _client.PutAsJsonAsync($"/api/payments/refunds/{refund.Id}", request);

        // Assert
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task ProcessRefund_ShouldReturnForbidden_WhenNotAdmin()
    {
        // Arrange
        _client.DefaultRequestHeaders.Add("Authorization", "Test 204:user");
        var request = new ProcessRefundRequest(Approve: true);

        // Act
        var response = await _client.PutAsJsonAsync("/api/payments/refunds/999", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
