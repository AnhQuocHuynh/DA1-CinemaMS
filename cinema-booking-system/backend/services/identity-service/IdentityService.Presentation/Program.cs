using IdentityService.Application;
using IdentityService.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddControllers();

// Add Gateway Header Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = "GatewayAuth";
    options.DefaultChallengeScheme = "GatewayAuth";
})
.AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, IdentityService.Presentation.Security.GatewayAuthenticationHandler>("GatewayAuth", null);

var app = builder.Build();

// Apply EF Core Migrations on startup
await DatabaseMigration.ApplyMigrationAsync(app.Services);

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/", () => "IdentityService is running!");

app.Run();
