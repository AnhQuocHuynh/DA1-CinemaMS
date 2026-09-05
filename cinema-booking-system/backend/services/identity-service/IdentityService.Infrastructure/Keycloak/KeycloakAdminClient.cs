using IdentityService.Application.Contracts;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure.Keycloak;

/// <summary>
/// Implementation of <see cref="IKeycloakAdminClient"/> that calls the
/// Keycloak Admin REST API using the cinema-admin service-account credentials.
/// Access tokens are cached in-memory until they expire to minimise round-trips.
/// </summary>
public class KeycloakAdminClient : IKeycloakAdminClient
{
    private readonly HttpClient _http;
    private readonly KeycloakAdminOptions _opts;
    private readonly IMemoryCache _cache;

    private const string TokenCacheKey = "keycloak_admin_access_token";

    public KeycloakAdminClient(HttpClient http, IOptions<KeycloakAdminOptions> opts, IMemoryCache cache)
    {
        _http = http;
        _opts = opts.Value;
        _cache = cache;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Token acquisition
    // ─────────────────────────────────────────────────────────────────────

    private async Task<string> GetAccessTokenAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue<string>(TokenCacheKey, out var cached) && cached != null)
            return cached;

        var tokenUrl = $"{_opts.BaseUrl}/realms/{_opts.Realm}/protocol/openid-connect/token";

        var form = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials"),
            new KeyValuePair<string, string>("client_id", _opts.ClientId),
            new KeyValuePair<string, string>("client_secret", _opts.ClientSecret),
        });

        var response = await _http.PostAsync(tokenUrl, form, ct);
        response.EnsureSuccessStatusCode();

        var tokenResponse = await response.Content.ReadFromJsonAsync<KeycloakTokenResponse>(cancellationToken: ct)
            ?? throw new InvalidOperationException("Keycloak token response was null.");

        // Cache with a 30-second safety margin before actual expiry
        var expiry = TimeSpan.FromSeconds(Math.Max(tokenResponse.ExpiresIn - 30, 10));
        _cache.Set(TokenCacheKey, tokenResponse.AccessToken, expiry);

        return tokenResponse.AccessToken;
    }

    private async Task<HttpClient> AuthorizedClient(CancellationToken ct)
    {
        var token = await GetAccessTokenAsync(ct);
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return _http;
    }

    // ─────────────────────────────────────────────────────────────────────
    // IKeycloakAdminClient implementation
    // ─────────────────────────────────────────────────────────────────────

    public async Task<IEnumerable<RoleRepresentation>> GetRealmRolesAsync(CancellationToken ct = default)
    {
        var client = await AuthorizedClient(ct);
        var url = $"{_opts.BaseUrl}/admin/realms/{_opts.Realm}/roles";

        var roles = await client.GetFromJsonAsync<List<KeycloakRoleDto>>(url, ct)
            ?? [];

        return roles.Select(r => new RoleRepresentation(r.Id, r.Name));
    }

    public async Task<IEnumerable<RoleRepresentation>> GetUserRealmRolesAsync(string keycloakId, CancellationToken ct = default)
    {
        var client = await AuthorizedClient(ct);
        var url = $"{_opts.BaseUrl}/admin/realms/{_opts.Realm}/users/{keycloakId}/role-mappings/realm";

        try
        {
            var roles = await client.GetFromJsonAsync<List<KeycloakRoleDto>>(url, ct)
                ?? [];

            return roles.Select(r => new RoleRepresentation(r.Id, r.Name));
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return [];
        }
    }

    public async Task AssignRealmRoleAsync(string keycloakId, RoleRepresentation role, CancellationToken ct = default)
    {
        var client = await AuthorizedClient(ct);
        var url = $"{_opts.BaseUrl}/admin/realms/{_opts.Realm}/users/{keycloakId}/role-mappings/realm";

        var payload = new[] { new KeycloakRoleDto(role.Id, role.Name) };
        var response = await client.PostAsJsonAsync(url, payload, ct);
        response.EnsureSuccessStatusCode();
    }

    public async Task UnassignRealmRoleAsync(string keycloakId, RoleRepresentation role, CancellationToken ct = default)
    {
        var client = await AuthorizedClient(ct);
        var url = $"{_opts.BaseUrl}/admin/realms/{_opts.Realm}/users/{keycloakId}/role-mappings/realm";

        var payload = new[] { new KeycloakRoleDto(role.Id, role.Name) };

        // HttpClient.DeleteAsync does not support a body; use SendAsync with a request message
        var request = new HttpRequestMessage(HttpMethod.Delete, url)
        {
            Content = JsonContent.Create(payload)
        };
        var response = await client.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Private DTOs for JSON deserialization
    // ─────────────────────────────────────────────────────────────────────

    private record KeycloakTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")]   int ExpiresIn
    );

    private record KeycloakRoleDto(
        [property: JsonPropertyName("id")]   string Id,
        [property: JsonPropertyName("name")] string Name
    );
}
