using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text.Json;

namespace CinemaBooking.Shared.Hosting.Extensions;

public static class AuthenticationExtensions
{
    public static IServiceCollection AddCinemaAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = configuration["Jwt:Authority"];
                options.Audience = configuration["Jwt:Audience"];
                options.RequireHttpsMetadata = configuration.GetValue<bool>("Jwt:RequireHttpsMetadata");
                
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    ValidateIssuer = true,
                    ValidIssuer = configuration["Jwt:ValidIssuer"] ?? configuration["Jwt:Authority"],
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    NameClaimType = "preferred_username",
                    RoleClaimType = ClaimTypes.Role
                };
                
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        var identity = context.Principal?.Identity as ClaimsIdentity;
                        if (identity == null) return Task.CompletedTask;

                        // 1. Map Keycloak realm roles to standard Role claims
                        var realmAccess = context.Principal?.FindFirst("realm_access");
                        if (realmAccess != null)
                        {
                            var parsed = JsonDocument.Parse(realmAccess.Value);
                            if (parsed.RootElement.TryGetProperty("roles", out var roles))
                            {
                                foreach (var role in roles.EnumerateArray())
                                {
                                    var roleStr = role.GetString()?.ToUpperInvariant();
                                    if (!string.IsNullOrEmpty(roleStr))
                                    {
                                        identity?.AddClaim(new Claim(ClaimTypes.Role, roleStr));
                                    }
                                }
                            }
                        }

                        // 2. Read X-User-Id from API Gateway headers to map UUID to internal ID if needed
                        if (context.Request.Headers.TryGetValue("X-User-Id", out var userIdValues))
                        {
                            var userIdStr = userIdValues.ToString();
                            if (!string.IsNullOrEmpty(userIdStr))
                            {
                                // Add as an internal user ID or overwrite NameIdentifier
                                // Using a custom claim to avoid breaking standard JWT NameIdentifier logic
                                identity.AddClaim(new Claim("internal_user_id", userIdStr));
                                
                                // PaymentService overwrites NameIdentifier, while Identity adds internal_user_id.
                                // We will add both here so all services have access to it via NameIdentifier and internal_user_id.
                                var existingNameId = identity.FindFirst(ClaimTypes.NameIdentifier);
                                if (existingNameId != null)
                                {
                                    identity.RemoveClaim(existingNameId);
                                }
                                identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userIdStr));
                            }
                        }

                        return Task.CompletedTask;
                    }
                };
            });
            
        services.AddAuthorization();
        
        return services;
    }
}
