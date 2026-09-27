using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Contracts;

namespace NotificationService.Infrastructure.Services;

/// <summary>
/// Resolves Keycloak UUIDs to internal numeric user IDs and fetches user contact info via the Identity Service REST API.
/// </summary>
public class HttpKeycloakUserResolver : IKeycloakUserResolver
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<HttpKeycloakUserResolver> _logger;
    private readonly TimeSpan[] _retryDelays;

    public HttpKeycloakUserResolver(
        HttpClient httpClient,
        ILogger<HttpKeycloakUserResolver> logger,
        TimeSpan[]? retryDelays = null)
    {
        _httpClient = httpClient;
        _logger = logger;
        _retryDelays = retryDelays ?? new[]
        {
            TimeSpan.FromMilliseconds(500),
            TimeSpan.FromMilliseconds(1000),
            TimeSpan.FromMilliseconds(1500),
            TimeSpan.FromMilliseconds(2000),
            TimeSpan.FromMilliseconds(2500)
        };
    }

    public async Task<long> ResolveUserIdAsync(string keycloakId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(keycloakId))
            throw new ArgumentException("KeycloakId is required.", nameof(keycloakId));

        var requestUri = $"internal/users/resolve?keycloakId={Uri.EscapeDataString(keycloakId)}";

        _logger.LogDebug("Resolving Keycloak ID {KeycloakId} via Identity Service", keycloakId);

        var maxAttempts = _retryDelays.Length + 1;
        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                var response = await _httpClient.GetAsync(requestUri, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync(cancellationToken);
                    if (long.TryParse(body.Trim(), out var userId))
                    {
                        _logger.LogInformation("Resolved Keycloak ID {KeycloakId} → User ID {UserId}", keycloakId, userId);
                        return userId;
                    }
                }

                if (response.StatusCode == System.Net.HttpStatusCode.NotFound && attempt < maxAttempts)
                {
                    var delay = _retryDelays[attempt - 1];
                    _logger.LogWarning("User with Keycloak ID {KeycloakId} not found in Identity Service yet (attempt {Attempt}/{MaxAttempts}). Waiting {Delay}ms before retry...", keycloakId, attempt, maxAttempts, delay.TotalMilliseconds);
                    if (delay > TimeSpan.Zero)
                    {
                        await Task.Delay(delay, cancellationToken);
                    }
                    continue;
                }

                response.EnsureSuccessStatusCode();
            }
            catch (HttpRequestException ex) when (attempt < maxAttempts)
            {
                var delay = _retryDelays[attempt - 1];
                _logger.LogWarning(ex, "HTTP error resolving Keycloak ID {KeycloakId} (attempt {Attempt}/{MaxAttempts}). Waiting {Delay}ms before retry...", keycloakId, attempt, maxAttempts, delay.TotalMilliseconds);
                if (delay > TimeSpan.Zero)
                {
                    await Task.Delay(delay, cancellationToken);
                }
            }
        }

        throw new InvalidOperationException($"Failed to resolve user ID for Keycloak ID {keycloakId} after {maxAttempts} attempts.");
    }

    public async Task<UserContactDto?> GetUserContactAsync(long userId, CancellationToken cancellationToken = default)
    {
        var requestUri = $"internal/users/{userId}";
        try
        {
            _logger.LogDebug("Looking up contact details for User ID {UserId} via Identity Service", userId);
            var response = await _httpClient.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Identity Service returned {StatusCode} for User ID {UserId}", response.StatusCode, userId);
                return null;
            }

            var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var userDto = await JsonSerializer.DeserializeAsync<UserContactDto>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, cancellationToken);
            return userDto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to resolve user contact for User ID {UserId} via Identity Service", userId);
            return null;
        }
    }
}
