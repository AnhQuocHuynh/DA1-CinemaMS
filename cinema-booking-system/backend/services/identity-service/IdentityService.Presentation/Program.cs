using IdentityService.Application;
using IdentityService.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

// Apply EF Core Migrations on startup
await DatabaseMigration.ApplyMigrationAsync(app.Services);

app.UseHttpsRedirection();

app.MapGet("/", () => "IdentityService is running!");

app.Run();
