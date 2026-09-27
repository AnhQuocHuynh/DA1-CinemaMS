using System.Net.Http;
using System.Net.Http.Headers;
using FacilityService.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FacilityService.Test.Integration;

public abstract class BaseIntegrationTest : IClassFixture<CustomWebApplicationFactory>
{
    protected readonly HttpClient _client;
    protected readonly CustomWebApplicationFactory _factory;
    protected readonly FacilityDbContext _dbContext;

    protected BaseIntegrationTest(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();

        var scope = factory.Services.CreateScope();
        _dbContext = scope.ServiceProvider.GetRequiredService<FacilityDbContext>();

        // Ensure database is created
        _dbContext.Database.EnsureCreated();
    }

    protected void AuthenticateAsUser(string userId = "123", string role = "user")
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test", $"{userId}:{role}");
    }
}
