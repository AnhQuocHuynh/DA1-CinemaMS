using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using NotificationService.Application.Contracts;
using NotificationService.Infrastructure.Services;
using Xunit;

namespace NotificationService.Test.Unit.Infrastructure.Services;

public class HttpKeycloakUserResolverTests
{
    private readonly Mock<HttpMessageHandler> _httpMessageHandlerMock;
    private readonly Mock<ILogger<HttpKeycloakUserResolver>> _loggerMock;
    private readonly HttpClient _httpClient;
    private readonly HttpKeycloakUserResolver _sut;

    public HttpKeycloakUserResolverTests()
    {
        _httpMessageHandlerMock = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        _loggerMock = new Mock<ILogger<HttpKeycloakUserResolver>>();
        _httpClient = new HttpClient(_httpMessageHandlerMock.Object)
        {
            BaseAddress = new Uri("http://localhost:5001/")
        };
        // Use zero delays for fast unit tests
        var fastDelays = new[] { TimeSpan.Zero, TimeSpan.Zero };
        _sut = new HttpKeycloakUserResolver(_httpClient, _loggerMock.Object, fastDelays);
    }

    [Fact]
    public async Task ResolveUserIdAsync_ShouldThrowArgumentException_WhenKeycloakIdIsEmpty()
    {
        // Act
        var act = () => _sut.ResolveUserIdAsync(string.Empty, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithParameterName("keycloakId");
    }

    [Fact]
    public async Task ResolveUserIdAsync_ShouldReturnUserId_WhenResponseIsOk()
    {
        // Arrange
        const string keycloakId = "kc-user-uuid-123";
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req =>
                    req.Method == HttpMethod.Get &&
                    req.RequestUri!.ToString().Contains("internal/users/resolve?keycloakId=")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("105")
            });

        // Act
        var result = await _sut.ResolveUserIdAsync(keycloakId, CancellationToken.None);

        // Assert
        result.Should().Be(105L);
    }

    [Fact]
    public async Task ResolveUserIdAsync_ShouldRetryAndSucceed_WhenInitiallyReturnsNotFound()
    {
        // Arrange
        const string keycloakId = "kc-user-uuid-race";
        var callCount = 0;

        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req =>
                    req.Method == HttpMethod.Get &&
                    req.RequestUri!.ToString().Contains("internal/users/resolve?keycloakId=")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount == 1)
                {
                    return new HttpResponseMessage(HttpStatusCode.NotFound);
                }
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("105")
                };
            });

        // Act
        var result = await _sut.ResolveUserIdAsync(keycloakId, CancellationToken.None);

        // Assert
        result.Should().Be(105L);
        callCount.Should().Be(2);
    }

    [Fact]
    public async Task ResolveUserIdAsync_ShouldThrowHttpRequestException_WhenEndpointReturnsNotFoundExhaustively()
    {
        // Arrange
        const string keycloakId = "unknown-uuid";
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.NotFound));

        // Act
        var act = () => _sut.ResolveUserIdAsync(keycloakId, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<HttpRequestException>();
    }

    [Fact]
    public async Task GetUserContactAsync_ShouldReturnContactDto_WhenUserExists()
    {
        // Arrange
        const long userId = 5;
        const string jsonContent = """{"id":5,"keycloakId":"uuid-5","email":"test@example.com","fullName":"Test User","phone":"0987654321","active":true}""";

        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req =>
                    req.Method == HttpMethod.Get &&
                    req.RequestUri!.ToString().Contains("internal/users/5")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json")
            });

        // Act
        var result = await _sut.GetUserContactAsync(userId, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(5);
        result.Email.Should().Be("test@example.com");
        result.FullName.Should().Be("Test User");
        result.Phone.Should().Be("0987654321");
    }

    [Fact]
    public async Task GetUserContactAsync_ShouldReturnNull_WhenUserNotFound()
    {
        // Arrange
        const long userId = 999;
        _httpMessageHandlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req =>
                    req.Method == HttpMethod.Get &&
                    req.RequestUri!.ToString().Contains("internal/users/999")),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.NotFound));

        // Act
        var result = await _sut.GetUserContactAsync(userId, CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }
}
