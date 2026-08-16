using IdentityService.Application;
using IdentityService.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddControllers();

// Add native Keycloak JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Jwt:Authority"];
        options.Audience = builder.Configuration["Jwt:Audience"];
        options.RequireHttpsMetadata = builder.Configuration.GetValue<bool>("Jwt:RequireHttpsMetadata");
        
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            NameClaimType = "preferred_username",
            RoleClaimType = ClaimTypes.Role
        };
        
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                // Map Keycloak realm roles to standard Role claims
                var realmAccess = context.Principal?.FindFirst("realm_access");
                if (realmAccess != null)
                {
                    var parsed = JsonDocument.Parse(realmAccess.Value);
                    if (parsed.RootElement.TryGetProperty("roles", out var roles))
                    {
                        var identity = context.Principal?.Identity as ClaimsIdentity;
                        foreach (var role in roles.EnumerateArray())
                        {
                            identity?.AddClaim(new Claim(ClaimTypes.Role, role.GetString()!));
                        }
                    }
                }

                // Map X-User-Id header to an internal claim for business logic
                if (context.HttpContext.Request.Headers.TryGetValue("X-User-Id", out var userIdValues))
                {
                    var internalId = userIdValues.ToString();
                    if (!string.IsNullOrEmpty(internalId))
                    {
                        var identity = context.Principal?.Identity as ClaimsIdentity;
                        identity?.AddClaim(new Claim("internal_user_id", internalId));
                    }
                }

                return Task.CompletedTask;
            }
        };
    });

var app = builder.Build();

// Apply EF Core Migrations on startup
await DatabaseMigration.ApplyMigrationAsync(app.Services);

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/", () => "IdentityService is running!");

app.Run();

public partial class Program { }
