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
public class PaymentsControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public PaymentsControllerTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task InitiatePayment_ShouldReturnOk_WhenValidRequest()
    {
        // Arrange
        _client.DefaultRequestHeaders.Add("Authorization", "Test 100:user");
        
        var request = new InitiatePaymentRequest(
            OrderId: 9991,
            Amount: 150000m,
            PaymentMethod: PaymentMethod.CASH
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/payments/initiate", request);

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        result.Should().NotBeNull();
        result!.Success.Should().BeTrue(result.Message);
    }

    [Fact]
    public async Task GetPaymentById_ShouldReturnPayment_WhenExists()
    {
        // Arrange
        var payment = new Payment(9992, 101, 100000m, "VND", PaymentMethod.CASH);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        _client.DefaultRequestHeaders.Add("Authorization", "Test 101:user");

        // Act
        var response = await _client.GetAsync($"/api/payments/{payment.Id}");

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<PaymentDto>>();
        result.Should().NotBeNull();
        result!.Data.Should().NotBeNull();
        result.Data!.Id.Should().Be(payment.Id);
    }

    [Fact]
    public async Task GetAllPayments_ShouldReturnForbidden_WhenNotAdmin()
    {
        // Arrange
        _client.DefaultRequestHeaders.Add("Authorization", "Test 102:user");

        // Act
        var response = await _client.GetAsync("/api/payments");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetAllPayments_ShouldReturnOk_WhenAdmin()
    {
        // Arrange
        _client.DefaultRequestHeaders.Add("Authorization", "Test 103:ADMIN");

        // Act
        var response = await _client.GetAsync("/api/payments");

        // Assert
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task ConfirmCashPayment_ShouldReturnOk_WhenAdmin()
    {
        // Arrange
        var payment = new Payment(9993, 104, 50000m, "VND", PaymentMethod.CASH);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        _client.DefaultRequestHeaders.Add("Authorization", "Test 104:ADMIN");
        var request = new ConfirmCashRequest(payment.Id);

        // Act
        var response = await _client.PostAsJsonAsync("/api/payments/cash/confirm", request);

        // Assert
        response.EnsureSuccessStatusCode();
    }
}

// Temporary DTO mappings for deserialization
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
}

public class PaymentDto
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public long UserId { get; set; }
    public decimal Amount { get; set; }
    public int Status { get; set; }
}
