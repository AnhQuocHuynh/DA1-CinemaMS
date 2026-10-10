using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
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
public class PaymentsControllerTests : IAsyncLifetime
{
    private readonly HttpClient _client;
    private readonly CustomWebApplicationFactory _factory;

    public PaymentsControllerTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        db.Refunds.RemoveRange(db.Refunds);
        db.TransactionLogs.RemoveRange(db.TransactionLogs);
        db.Payments.RemoveRange(db.Payments);
        db.Set<PaymentSagaState>().RemoveRange(db.Set<PaymentSagaState>());
        await db.SaveChangesAsync();
    }

    private void SetAuthUser(long userId, string role = "user")
    {
        _client.DefaultRequestHeaders.Remove("Authorization");
        _client.DefaultRequestHeaders.Add("Authorization", $"Test {userId}:{role}");
    }

    [Fact]
    public async Task InitiatePayment_ShouldReturnOk_WhenCashRequestedByStaff()
    {
        // Arrange
        var payment = new Payment(9101, 100, 150000m, "VND");
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        SetAuthUser(100, "STAFF");
        
        var request = new InitiatePaymentRequest(
            OrderId: 9101,
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
    public async Task InitiatePayment_ShouldReturnForbidden_WhenCashRequestedByRegularUser()
    {
        // Arrange
        var payment = new Payment(91011, 100, 150000m, "VND");
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        SetAuthUser(100, "user");

        var request = new InitiatePaymentRequest(
            OrderId: 91011,
            PaymentMethod: PaymentMethod.CASH
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/payments/initiate", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetPaymentById_ShouldReturnPayment_WhenExists()
    {
        // Arrange
        var payment = new Payment(9102, 101, 100000m, "VND", PaymentMethod.CASH);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        SetAuthUser(101, "user");

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
        SetAuthUser(102, "user");

        // Act
        var response = await _client.GetAsync("/api/payments");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetAllPayments_ShouldReturnOk_WhenAdmin()
    {
        // Arrange
        SetAuthUser(103, "ADMIN");

        // Act
        var response = await _client.GetAsync("/api/payments");

        // Assert
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task ConfirmCashPayment_ShouldReturnOk_WhenAdmin()
    {
        // Arrange
        var payment = new Payment(9103, 104, 50000m, "VND", PaymentMethod.CASH);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        SetAuthUser(104, "ADMIN");
        var request = new ConfirmCashRequest(payment.Id);

        // Act
        var response = await _client.PostAsJsonAsync("/api/payments/cash/confirm", request);

        // Assert
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task InitiatePayment_ShouldReturnUnauthorized_WhenPaymentBelongsToDifferentUser()
    {
        // Arrange — payment belongs to user 200
        var payment = new Payment(9104, 200, 150000m, "VND");
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        // Authenticate as a different user (100)
        SetAuthUser(100, "user");

        var request = new InitiatePaymentRequest(
            OrderId: 9104,
            PaymentMethod: PaymentMethod.STRIPE
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/payments/initiate", request);

        // Assert — 401 Unauthorized because userId does not match
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task InitiatePayment_ShouldReturnConflict_WhenPaymentIsExpired()
    {
        // Arrange — payment is expired
        var payment = new Payment(9105, 100, 150000m, "VND");
        payment.Expire();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        SetAuthUser(100, "user");

        var request = new InitiatePaymentRequest(
            OrderId: 9105,
            PaymentMethod: PaymentMethod.STRIPE
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/payments/initiate", request);

        // Assert — 409 Conflict because payment is expired
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task InitiatePayment_ShouldReturnOk_WhenPaymentIsPendingAndRetried()
    {
        // Arrange — payment is already PENDING (e.g. user retrying after dropped response)
        var payment = new Payment(9106, 100, 150000m, "VND");
        payment.Initiate(PaymentMethod.CASH, null);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        SetAuthUser(100, "STAFF");

        var request = new InitiatePaymentRequest(
            OrderId: 9106,
            PaymentMethod: PaymentMethod.CASH
        );

        // Act — idempotent retry returns 200 OK
        var response = await _client.PostAsJsonAsync("/api/payments/initiate", request);

        // Assert
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        result.Should().NotBeNull();
        result!.Success.Should().BeTrue();
    }

    [Fact]
    public async Task ExecuteOrderRefund_ShouldReturnOk_WhenCashPaymentExists()
    {
        // Arrange — completed CASH payment
        var payment = new Payment(9107, 100, 150000m, "VND", PaymentMethod.CASH);
        payment.Complete("CASH-9107-123", "{}");
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        var request = new ExecuteOrderRefundRequest(150000m, "Customer cancelled booking");

        // Act
        var response = await _client.PostAsJsonAsync($"/api/payments/order/{payment.OrderId}/refund", request);

        // Assert
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task InitiatePayment_ShouldReturnNotFound_WhenPaymentSlotDoesNotExist()
    {
        // Arrange — user 100 tries to initiate payment for an order with no reserved slot
        SetAuthUser(100, "user");
        var request = new InitiatePaymentRequest(
            OrderId: 91099,
            PaymentMethod: PaymentMethod.STRIPE
        );

        // Act — polling times out and returns 404
        var response = await _client.PostAsJsonAsync("/api/payments/initiate", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ExecuteOrderRefund_ShouldReturnNotFound_WhenPaymentDoesNotExist()
    {
        // Arrange
        var request = new ExecuteOrderRefundRequest(50000m, "Customer cancellation");

        // Act
        var response = await _client.PostAsJsonAsync("/api/payments/order/910998/refund", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ExecuteOrderRefund_ShouldReturnConflict_WhenPaymentNotCompleted()
    {
        // Arrange — payment is still in CREATED status
        var payment = new Payment(9108, 100, 150000m, "VND", PaymentMethod.CASH);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        var request = new ExecuteOrderRefundRequest(150000m, "Customer cancellation");

        // Act
        var response = await _client.PostAsJsonAsync($"/api/payments/order/{payment.OrderId}/refund", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
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
    public string Status { get; set; } = string.Empty;
}
