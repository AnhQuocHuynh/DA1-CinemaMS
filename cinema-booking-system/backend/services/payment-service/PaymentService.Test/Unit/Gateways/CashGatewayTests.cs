using System.Collections.Generic;
using System.Threading.Tasks;
using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;
using PaymentService.Infrastructure.Gateways;

namespace PaymentService.Test.Unit.Gateways;

/// <summary>
/// Unit tests for CashGateway — purely in-memory, no external dependencies.
/// </summary>
public class CashGatewayTests
{
    private readonly CashGateway _gateway;

    public CashGatewayTests()
    {
        _gateway = new CashGateway();
    }

    [Fact]
    public async Task InitiateAsync_ShouldReturnSuccess_WithNoRedirectUrl()
    {
        // Arrange
        var request = new PaymentRequest(
            PaymentId: 1,
            Amount: 150000m,
            Currency: "VND",
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        // Act
        var result = await _gateway.InitiateAsync(request);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Null(result.RedirectUrl); // Cash has no redirect
        Assert.Null(result.ErrorMessage);
    }

    [Fact]
    public async Task VerifyCallbackAsync_ShouldReturnFailure_WithExplanatoryMessage()
    {
        // Arrange
        var parameters = new Dictionary<string, string>();

        // Act
        var result = await _gateway.VerifyCallbackAsync(parameters);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Null(result.TransactionId);
        Assert.NotEmpty(result.ErrorMessage!); // Should explain it's manual
        Assert.Contains("Cash", result.ErrorMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task InitiateAsync_ShouldNotThrow_ForAnyAmount()
    {
        // Arrange & Act & Assert — boundary values
        var zero = await _gateway.InitiateAsync(new PaymentRequest(1, 0m, "VND", "", ""));
        var large = await _gateway.InitiateAsync(new PaymentRequest(2, 99_999_999m, "VND", "", ""));

        Assert.True(zero.IsSuccess);
        Assert.True(large.IsSuccess);
    }
}
