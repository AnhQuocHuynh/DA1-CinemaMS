using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Net.Http;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ApiGateway.Middleware
{
    public class KeycloakUserIdResolutionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<KeycloakUserIdResolutionMiddleware> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IDistributedCache _cache;
        private readonly string _userProfileBaseUrl;
        private readonly string _resolveEndpoint;
        private readonly string _internalToken;

        public KeycloakUserIdResolutionMiddleware(
            RequestDelegate next,
            ILogger<KeycloakUserIdResolutionMiddleware> logger,
            IHttpClientFactory httpClientFactory,
            IDistributedCache cache,
            IConfiguration config)
        {
            _next = next;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _cache = cache;
            
            _userProfileBaseUrl = config["UserProfileService:BaseUrl"] ?? throw new InvalidOperationException("UserProfileService:BaseUrl is not configured");
            _resolveEndpoint = config["UserProfileService:ResolveEndpoint"] ?? "/internal/users/resolve";
            _internalToken = config["INTERNAL_API_TOKEN"] ?? config["InternalApi:Token"] ?? "local-dev-internal-token";
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Strip any incoming spoofable headers from external requests
            context.Request.Headers.Remove("X-User-Id");
            context.Request.Headers.Remove("X-Keycloak-Id");
            context.Request.Headers.Remove("X-User-Roles");
            context.Request.Headers.Remove("X-User-Email");

            if (context.User.Identity?.IsAuthenticated == true)
            {
                var keycloakId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var email = context.User.FindFirst(ClaimTypes.Email)?.Value;

                if (!string.IsNullOrEmpty(keycloakId))
                {
                    context.Request.Headers["X-Keycloak-Id"] = keycloakId;

                    // Resolve Keycloak UUID to internal Long ID
                    var internalId = await ResolveInternalUserIdAsync(keycloakId);
                    if (internalId.HasValue)
                    {
                        context.Request.Headers["X-User-Id"] = internalId.Value.ToString();
                    }
                    else
                    {
                        _logger.LogWarning("Failed to resolve internal user ID for Keycloak ID {KeycloakId}", keycloakId);
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        await context.Response.WriteAsync("User resolution failed");
                        return;
                    }
                }
            }

            await _next(context);
        }

        private async Task<long?> ResolveInternalUserIdAsync(string keycloakId)
        {
            var cacheKey = $"user-resolve:{keycloakId}";
            
            var cachedIdStr = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrEmpty(cachedIdStr) && long.TryParse(cachedIdStr, out var cachedId))
            {
                return cachedId;
            }

            try
            {
                var client = _httpClientFactory.CreateClient("UserProfileClient");
                var url = $"{_userProfileBaseUrl}{_resolveEndpoint}?keycloakId={keycloakId}";
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                if (!string.IsNullOrEmpty(_internalToken) && !client.DefaultRequestHeaders.Contains("X-Internal-Token"))
                {
                    request.Headers.Add("X-Internal-Token", _internalToken);
                }
                var response = await client.SendAsync(request);

                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    if (long.TryParse(content, out var internalId))
                    {
                        // Cache for 10 minutes
                        var cacheOptions = new DistributedCacheEntryOptions
                        {
                            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
                        };
                        await _cache.SetStringAsync(cacheKey, internalId.ToString(), cacheOptions);
                        
                        return internalId;
                    }
                }
                
                _logger.LogWarning("Profile service returned {StatusCode} when resolving {KeycloakId}", response.StatusCode, keycloakId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolving Keycloak ID {KeycloakId} from Profile Service", keycloakId);
            }

            return null;
        }
    }
}
