using System.Threading;
using System.Threading.Tasks;

namespace NotificationService.Application.Contracts;

public record UserContactDto(long Id, string Email, string? FullName, string? Phone);

/// <summary>
/// Resolves Keycloak UUIDs to internal numeric user IDs, and provides lookup for user contact details via Identity Service.
/// </summary>
public interface IKeycloakUserResolver
{
    /// <summary>
    /// Maps a Keycloak UUID to the internal numeric UserId via Identity Service
    /// <c>GET /internal/users/resolve?keycloakId={keycloakId}</c>.
    /// </summary>
    Task<long> ResolveUserIdAsync(string keycloakId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Fetches user contact details by internal numeric UserId via Identity Service
    /// <c>GET /internal/users/{userId}</c>.
    /// </summary>
    Task<UserContactDto?> GetUserContactAsync(long userId, CancellationToken cancellationToken = default);
}
