using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Contracts;

/// <summary>
/// Represents a role as returned by the Keycloak Admin REST API.
/// </summary>
public record RoleRepresentation(string Id, string Name);

/// <summary>
/// Contract for interacting with the Keycloak Admin REST API.
/// Used to manage realm-level role assignments for users.
/// </summary>
public interface IKeycloakAdminClient
{
    /// <summary>Gets all realm roles defined in the Keycloak realm.</summary>
    Task<IEnumerable<RoleRepresentation>> GetRealmRolesAsync(CancellationToken ct = default);

    /// <summary>Gets the realm roles currently assigned to a specific user.</summary>
    Task<IEnumerable<RoleRepresentation>> GetUserRealmRolesAsync(string keycloakId, CancellationToken ct = default);

    /// <summary>Assigns a realm role to a user.</summary>
    Task AssignRealmRoleAsync(string keycloakId, RoleRepresentation role, CancellationToken ct = default);

    /// <summary>Removes a realm role from a user.</summary>
    Task UnassignRealmRoleAsync(string keycloakId, RoleRepresentation role, CancellationToken ct = default);
}
