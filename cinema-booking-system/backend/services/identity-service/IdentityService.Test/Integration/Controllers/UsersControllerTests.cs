using FluentAssertions;
using IdentityService.Application.DTOs;
using IdentityService.Domain.Entities;
using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace IdentityService.Test.Integration.Controllers;

/// <summary>Mirrors the Presentation-layer ApiResponse for test deserialization.</summary>
file record ApiResponseWrapper<T>(bool Success, string Message, T? Data);

[Collection("IntegrationTests")]
public class UsersControllerTests : BaseIntegrationTest
{
    private static readonly System.Text.Json.JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

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
        var wrapper = await response.Content.ReadFromJsonAsync<ApiResponseWrapper<UserDto>>(JsonOptions);
        wrapper.Should().NotBeNull();
        wrapper!.Success.Should().BeTrue();
        wrapper.Data.Should().NotBeNull();
        wrapper.Data!.FullName.Should().Be("test_auth_user");
        wrapper.Data.Email.Should().Be(email);
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

        AuthenticateAsUser(adminKeycloakId, "ADMIN");

        // Act
        var response = await _client.GetAsync("/api/Users?page=1&pageSize=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var wrapper = await response.Content.ReadFromJsonAsync<ApiResponseWrapper<PagedResult<UserDto>>>(JsonOptions);
        wrapper.Should().NotBeNull();
        wrapper!.Success.Should().BeTrue();
        wrapper.Data.Should().NotBeNull();
        wrapper.Data!.Items.Should().NotBeEmpty();
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

        AuthenticateAsUser(adminKeycloakId, "ADMIN");

        // Act
        var response = await _client.GetAsync($"/api/Users/{user.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var wrapper = await response.Content.ReadFromJsonAsync<ApiResponseWrapper<UserDto>>(JsonOptions);
        wrapper.Should().NotBeNull();
        wrapper!.Success.Should().BeTrue();
        wrapper.Data.Should().NotBeNull();
        wrapper.Data!.Email.Should().Be(email);
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

        AuthenticateAsUser(adminKeycloakId, "ADMIN");
        
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

    [Fact]
    public async Task GetUserCinemaScope_ReturnsScopeWithCinemaId_WhenUserAssignedToCinema()
    {
        // Arrange
        var keycloakId = Guid.NewGuid().ToString();
        var user = new User(keycloakId, $"staff_{Guid.NewGuid()}@example.com", "Staff User");
        user.AssignCinema(3L);
        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        // Act
        var response = await _client.GetAsync($"/internal/users/{user.Id}/cinema-scope");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var wrapper = await response.Content.ReadFromJsonAsync<ApiResponseWrapper<CinemaScopeDto>>(JsonOptions);
        wrapper.Should().NotBeNull();
        wrapper!.Success.Should().BeTrue();
        wrapper.Data.Should().NotBeNull();
        wrapper.Data!.CinemaIds.Should().ContainSingle().Which.Should().Be(3L);
    }

    [Fact]
    public async Task GetUserCinemaScope_ReturnsNotFound_WhenUserDoesNotExist()
    {
        // Act
        var response = await _client.GetAsync("/internal/users/999999/cinema-scope");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AssignStaffCinema_ReturnsNoContentAndPersistsCinemaId_WhenAdmin()
    {
        // Arrange
        var staffKeycloakId = Guid.NewGuid().ToString();
        var adminKeycloakId = Guid.NewGuid().ToString();
        var staffUser = new User(staffKeycloakId, $"staff_assign_{Guid.NewGuid()}@example.com", "Staff Assign User");
        var adminUser = new User(adminKeycloakId, $"admin_assign_{Guid.NewGuid()}@example.com", "Admin User");

        _dbContext.Users.Add(staffUser);
        _dbContext.Users.Add(adminUser);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser(adminKeycloakId, "ADMIN");
        var request = new { CinemaId = 5L };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/Users/{staffUser.Id}/cinema", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        await _dbContext.Entry(staffUser).ReloadAsync();
        staffUser.CinemaId.Should().Be(5L);
    }

    [Fact]
    public async Task AssignStaffCinema_ReturnsForbidden_WhenNotAdmin()
    {
        // Arrange
        AuthenticateAsUser(Guid.NewGuid().ToString(), "user");
        var request = new { CinemaId = 5L };

        // Act
        var response = await _client.PutAsJsonAsync("/api/Users/999/cinema", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
