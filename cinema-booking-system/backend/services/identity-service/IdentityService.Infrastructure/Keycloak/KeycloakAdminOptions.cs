namespace IdentityService.Infrastructure.Keycloak;

/// <summary>
/// Strongly-typed options for the Keycloak Admin REST API client.
/// Bound from the "KeycloakAdmin" section in appsettings.
/// </summary>
public class KeycloakAdminOptions
{
    public const string SectionName = "KeycloakAdmin";

    /// <summary>Base URL of the Keycloak server, e.g. http://keycloak:8080</summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>Realm name, e.g. cinema-booking</summary>
    public string Realm { get; set; } = string.Empty;

    /// <summary>Service-account client ID that has manage-users permissions, e.g. cinema-admin</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>Client secret for the service-account client.</summary>
    public string ClientSecret { get; set; } = string.Empty;
}
