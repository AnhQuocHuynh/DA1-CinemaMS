using FluentAssertions;
using IdentityService.Application.DTOs;
using IdentityService.Domain.Entities;
using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace IdentityService.Test.Integration.Controllers;

[Collection("IntegrationTests")]
public class UsersControllerTests : BaseIntegrationTest
{
    public UsersControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task GetCurrentUser_ReturnsUser_WhenAuthenticated()
    {
        // Arrange
        var keycloakId = Guid.NewGuid().ToString();
        var email = $"testauth_{Guid.NewGuid()}@example.com";
        var user = new User(keycloakId, email, "test_auth_user");
        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser(keycloakId);

        // Act
        var response = await _client.GetAsync("/api/Users/me");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<UserDto>();
        result.Should().NotBeNull();
        result!.FullName.Should().Be("test_auth_user");
        result.Email.Should().Be(email);
    }

    [Fact]
    public async Task GetUsers_ReturnsUsers_WhenAdmin()
    {
        // Arrange
        var keycloakId = Guid.NewGuid().ToString();
        var adminKeycloakId = Guid.NewGuid().ToString();
        
        var user1 = new User(keycloakId, $"user1_{Guid.NewGuid()}@example.com", "User One");
        var admin = new User(adminKeycloakId, $"admin_{Guid.NewGuid()}@example.com", "Admin User");
        
        _dbContext.Users.Add(user1);
        _dbContext.Users.Add(admin);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser(adminKeycloakId, "admin");

        // Act
        var response = await _client.GetAsync("/api/Users?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<UserDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().NotBeEmpty();
    }
    
    [Fact]
    public async Task GetUsers_ReturnsForbidden_WhenNotAdmin()
    {
        // Arrange
        AuthenticateAsUser(Guid.NewGuid().ToString(), "user");

        // Act
        var response = await _client.GetAsync("/api/Users?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
    [Fact]
    public async Task GetUserById_ReturnsUser_WhenAdmin()
    {
        // Arrange
        var keycloakId = Guid.NewGuid().ToString();
        var adminKeycloakId = Guid.NewGuid().ToString();
        
        var email = $"target_{Guid.NewGuid()}@example.com";
        var user = new User(keycloakId, email, "Target User");
        var admin = new User(adminKeycloakId, $"admin_{Guid.NewGuid()}@example.com", "Admin User");
        
        _dbContext.Users.Add(user);
        _dbContext.Users.Add(admin);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser(adminKeycloakId, "admin");

        // Act
        var response = await _client.GetAsync($"/api/Users/{user.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<UserDto>();
        result.Should().NotBeNull();
        result!.Email.Should().Be(email);
    }

    [Fact]
    public async Task GetUserById_ReturnsForbidden_WhenNotAdmin()
    {
        // Arrange
        AuthenticateAsUser(Guid.NewGuid().ToString(), "user");

        // Act
        var response = await _client.GetAsync("/api/Users/999");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ChangeUserRole_ReturnsNoContent_WhenAdmin()
    {
        // Arrange
        var keycloakId = Guid.NewGuid().ToString();
        var adminKeycloakId = Guid.NewGuid().ToString();
        
        var user = new User(keycloakId, $"rolechange_{Guid.NewGuid()}@example.com", "Role Change");
        var admin = new User(adminKeycloakId, $"admin_{Guid.NewGuid()}@example.com", "Admin User");
        
        _dbContext.Users.Add(user);
        _dbContext.Users.Add(admin);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser(adminKeycloakId, "admin");
        
        var request = new { NewRole = "ADMIN" };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/Users/{user.Id}/role", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task ChangeUserRole_ReturnsForbidden_WhenNotAdmin()
    {
        // Arrange
        AuthenticateAsUser(Guid.NewGuid().ToString(), "user");
        var request = new { NewRole = "ADMIN" };

        // Act
        var response = await _client.PutAsJsonAsync("/api/Users/999/role", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateCurrentUser_ReturnsNoContent_WhenAuthenticated()
    {
        // Arrange
        var keycloakId = Guid.NewGuid().ToString();
        var user = new User(keycloakId, $"update_{Guid.NewGuid()}@example.com", "Update User");
        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser(keycloakId, "user");
        
        var command = new { Phone = "1234567890", Gender = 0, DateOfBirth = new DateTime(1990, 1, 1).ToString("O") };

        // Act
        var response = await _client.PutAsJsonAsync("/api/Users/me", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        
        // Verify DB update
        await _dbContext.Entry(user).ReloadAsync();
        user.Phone.Should().Be("1234567890");
    }
}
