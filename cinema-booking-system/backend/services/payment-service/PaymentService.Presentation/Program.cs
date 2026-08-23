using PaymentService.Application;
using PaymentService.Infrastructure;
using PaymentService.Presentation.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// ── ASP.NET Core Services ──────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Payment Service API",
        Version = "v1",
        Description = "Cinema Booking System — Payment Service (Stripe, PayPal, Cash)"
    });
    options.AddSecurityDefinition("GatewayAuth", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "Provide X-User-Id header (injected by API Gateway)",
        Name = "X-User-Id",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "GatewayAuth"
    });
});

// ── Clean Architecture Layers ──────────────────────────────────────────────
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddApplicationServices();

// ── Native Keycloak JWT Authentication ──────────────────────────────────────
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

                // 2. Read X-User-Id from API Gateway headers to map UUID to Long UserId
                if (context.Request.Headers.TryGetValue("X-User-Id", out var userIdValues))
                {
                    var userIdStr = userIdValues.ToString();
                    // Overwrite the NameIdentifier claim with the long ID
                    var existingNameId = identity.FindFirst(ClaimTypes.NameIdentifier);
                    if (existingNameId != null)
                    {
                        identity.RemoveClaim(existingNameId);
                    }
                    identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userIdStr));
                }

                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// ── Health Checks ──────────────────────────────────────────────────────────
builder.Services.AddHealthChecks();

// ── CORS (development) ────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

// ── Auto-apply EF Core Migrations ─────────────────────────────────────────
app.Services.MigratePaymentDatabase();

// ── Middleware Pipeline ────────────────────────────────────────────────────
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<InternalApiSecurityMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Payment Service v1"));
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Allow integration tests to reference the assembly
public partial class Program { }
