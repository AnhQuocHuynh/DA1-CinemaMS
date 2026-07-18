using FacilityService.Application;
using FacilityService.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using FacilityService.Presentation.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Clean Architecture - Add Infrastructure layer
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplication();

// Add Gateway Header Authentication
builder.Services.AddAuthentication("GatewayAuth")
    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, FacilityService.Presentation.Security.GatewayAuthenticationHandler>("GatewayAuth", null);
builder.Services.AddAuthorization();

var app = builder.Build();

// Auto-apply migrations upon starting
app.Services.MigrateFacilityDatabase();

// Configure the HTTP request pipeline.
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
