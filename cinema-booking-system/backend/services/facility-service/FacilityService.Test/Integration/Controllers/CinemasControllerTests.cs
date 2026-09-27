using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FacilityService.Application.DTOs;
using FacilityService.Application.Features.Cinemas.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Presentation.Models;
using FluentAssertions;
using Xunit;

namespace FacilityService.Test.Integration.Controllers;

[Collection("IntegrationTests")]
public class CinemasControllerTests : BaseIntegrationTest
{
    public CinemasControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task GetCinemas_ReturnsOk_WithCinemas()
    {
        // Arrange
        var cinema = new Cinema("Test Cinema", "Test Address", "Description", "LogoUrl");
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        // Act
        var response = await _client.GetAsync("/api/Cinemas");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<IEnumerable<CinemaDto>>>();
        result.Should().NotBeNull();
        result!.Data.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetCinemaById_ReturnsOk_WithCinema()
    {
        // Arrange
        var cinema = new Cinema("Target Cinema", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        // Act
        var response = await _client.GetAsync($"/api/Cinemas/{cinema.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<CinemaDto>>();
        result.Should().NotBeNull();
        result!.Data!.Name.Should().Be("Target Cinema");
    }

    [Fact]
    public async Task CreateCinema_ReturnsOk_WhenAdmin()
    {
        // Arrange
        AuthenticateAsUser("admin-id", "ADMIN");
        var command = new CreateCinemaCommand { Name = "New Cinema", Address = "New Address" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/Cinemas", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<CinemaDto>>();
        result.Should().NotBeNull();
        result!.Data!.Name.Should().Be("New Cinema");
    }

    [Fact]
    public async Task CreateCinema_ReturnsForbidden_WhenNotAdmin()
    {
        // Arrange
        AuthenticateAsUser("user-id", "USER");
        var command = new CreateCinemaCommand { Name = "New Cinema", Address = "New Address" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/Cinemas", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateCinema_ReturnsOk_WhenAdmin()
    {
        // Arrange
        var cinema = new Cinema("Old Cinema", "Old Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser("admin-id", "ADMIN");
        var command = new UpdateCinemaCommand { Id = cinema.Id, Name = "Updated Cinema", Address = "Updated Address" };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/Cinemas/{cinema.Id}", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<CinemaDto>>();
        result.Should().NotBeNull();
        result!.Data!.Name.Should().Be("Updated Cinema");
    }

    [Fact]
    public async Task DeleteCinema_ReturnsOk_WhenAdmin()
    {
        // Arrange
        var cinema = new Cinema("Delete Cinema", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser("admin-id", "ADMIN");

        // Act
        var response = await _client.DeleteAsync($"/api/Cinemas/{cinema.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<bool>>();
        result!.Data.Should().BeTrue();
    }
}
