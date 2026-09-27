using IdentityService.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http;
using System.Net.Http.Headers;
using Xunit;

namespace IdentityService.Test.Integration;

public abstract class BaseIntegrationTest : IClassFixture<CustomWebApplicationFactory>
{
    protected readonly CustomWebApplicationFactory _factory;
    protected readonly HttpClient _client;
    protected readonly IServiceScope _scope;
    protected readonly UserProfileDbContext _dbContext;

    protected BaseIntegrationTest(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _scope = factory.Services.CreateScope();
        _dbContext = _scope.ServiceProvider.GetRequiredService<UserProfileDbContext>();
        
        // Ensure database is created and migrations are applied
        _dbContext.Database.EnsureCreated();
    }

    protected void AuthenticateAsUser(string userId, string role = "user")
    {
        // By using a mock authentication handler or a test token.
        // For simplicity with WebApplicationFactory, we can add a test auth handler 
        // to the factory if needed. 
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test", $"{userId}:{role}");
    }
}
