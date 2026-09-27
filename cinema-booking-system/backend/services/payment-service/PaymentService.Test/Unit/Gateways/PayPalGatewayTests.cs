using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;
using PaymentService.Infrastructure.Gateways;

namespace PaymentService.Test.Unit.Gateways;

/// <summary>
/// Unit tests for PayPalGateway.
/// These tests verify configuration behavior and parameter validation
/// using a mocked IHttpClientFactory.
/// </summary>
public class PayPalGatewayTests
{
    private static IConfiguration CreateConfig(
        string clientId = "test_client_id",
        string clientSecret = "test_client_secret",
        string mode = "sandbox")
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "PayPal:ClientId", clientId },
                { "PayPal:ClientSecret", clientSecret },
                { "PayPal:Mode", mode }
            })
            .Build();
    }

    [Fact]
    public void Constructor_ShouldNotThrow_WhenConfigurationIsValid()
    {
        // Arrange
        var config = CreateConfig();
        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory
            .Setup(f => f.CreateClient("PayPal"))
            .Returns(new HttpClient());

        // Act & Assert
        var exception = Record.Exception(() =>
            new PayPalGateway(config, NullLogger<PayPalGateway>.Instance, httpClientFactory.Object));
        Assert.Null(exception);
    }

    [Fact]
    public async Task VerifyCallbackAsync_ShouldReturnFailure_WhenTokenIsMissing()
    {
        // Arrange
        var config = CreateConfig();
        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory.Setup(f => f.CreateClient("PayPal")).Returns(new HttpClient());

        var gateway = new PayPalGateway(config, NullLogger<PayPalGateway>.Instance, httpClientFactory.Object);
        var parameters = new Dictionary<string, string>(); // No token

        // Act
        var result = await gateway.VerifyCallbackAsync(parameters);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("token", result.ErrorMessage, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task VerifyCallbackAsync_ShouldReturnFailure_WhenTokenIsEmpty()
    {
        // Arrange
        var config = CreateConfig();
        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory.Setup(f => f.CreateClient("PayPal")).Returns(new HttpClient());

        var gateway = new PayPalGateway(config, NullLogger<PayPalGateway>.Instance, httpClientFactory.Object);
        var parameters = new Dictionary<string, string>
        {
            { "token", "" } // Empty token
        };

        // Act
        var result = await gateway.VerifyCallbackAsync(parameters);

        // Assert
        Assert.False(result.IsSuccess);
    }

    [Fact]
    public async Task InitiateAsync_ShouldReturnFailure_WhenApiCallFails()
    {
        // Arrange — HTTP client that returns 401 Unauthorized
        var config = CreateConfig();
        var fakeHandler = new FakeHttpMessageHandler(HttpStatusCode.Unauthorized, "{\"error\":\"invalid_client\"}");
        var httpClient = new HttpClient(fakeHandler);

        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory.Setup(f => f.CreateClient("PayPal")).Returns(httpClient);

        var gateway = new PayPalGateway(config, NullLogger<PayPalGateway>.Instance, httpClientFactory.Object);

        var request = new PaymentRequest(
            PaymentId: 1,
            Amount: 180000m,
            Currency: "VND",
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        // Act
        var result = await gateway.InitiateAsync(request);

        // Assert — should fail gracefully, not throw
        Assert.False(result.IsSuccess);
        Assert.Null(result.RedirectUrl);
        Assert.NotEmpty(result.ErrorMessage!);
    }

    [Fact]
    public async Task InitiateAsync_ShouldReturnFailure_WhenTokenRequestFails()
    {
        // Arrange — token endpoint returns error
        var config = CreateConfig(clientId: "bad_id", clientSecret: "bad_secret");
        var fakeHandler = new FakeHttpMessageHandler(HttpStatusCode.Unauthorized, "{\"error\":\"invalid_client\"}");
        var httpClient = new HttpClient(fakeHandler);

        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory.Setup(f => f.CreateClient("PayPal")).Returns(httpClient);

        var gateway = new PayPalGateway(config, NullLogger<PayPalGateway>.Instance, httpClientFactory.Object);

        var request = new PaymentRequest(1, 50000m, "VND", "https://cancel.com", "https://success.com");

        // Act
        var result = await gateway.InitiateAsync(request);

        // Assert
        Assert.False(result.IsSuccess);
    }

    // ── Mode selection ────────────────────────────────────────────────────────

    [Theory]
    [InlineData("sandbox")]
    [InlineData("production")]
    public void Gateway_ShouldNotThrow_ForBothModes(string mode)
    {
        // Arrange
        var config = CreateConfig(mode: mode);
        var httpClientFactory = new Mock<IHttpClientFactory>();
        httpClientFactory.Setup(f => f.CreateClient("PayPal")).Returns(new HttpClient());

        // Act & Assert
        var exception = Record.Exception(() =>
            new PayPalGateway(config, NullLogger<PayPalGateway>.Instance, httpClientFactory.Object));
        Assert.Null(exception);
    }
}

/// <summary>
/// Fake HTTP message handler for controlling PayPal API responses in tests.
/// </summary>
internal class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly HttpStatusCode _statusCode;
    private readonly string _responseBody;

    public FakeHttpMessageHandler(HttpStatusCode statusCode, string responseBody)
    {
        _statusCode = statusCode;
        _responseBody = responseBody;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        System.Threading.CancellationToken cancellationToken)
    {
        var response = new HttpResponseMessage(_statusCode)
        {
            Content = new StringContent(_responseBody, System.Text.Encoding.UTF8, "application/json")
        };
        return Task.FromResult(response);
    }
}
