using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FacilityService.Application.DTOs;
using FacilityService.Application.Features.Rooms.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Presentation.Models;
using FluentAssertions;
using Xunit;

namespace FacilityService.Test.Integration.Controllers;

[Collection("IntegrationTests")]
public class RoomsControllerTests : BaseIntegrationTest
{
    public RoomsControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    [Fact]
    public async Task GetRoomsByCinema_ReturnsOk_WithRooms()
    {
        // Arrange
        var cinema = new Cinema("Cinema For Rooms", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        var room = new Room(cinema, "Room 1", null, null, null, null);
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();

        // Act
        var response = await _client.GetAsync($"/api/cinemas/{cinema.Id}/Rooms");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<IEnumerable<RoomDto>>>();
        result.Should().NotBeNull();
        result!.Data.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetRoomById_ReturnsOk_WithRoom()
    {
        // Arrange
        var cinema = new Cinema("Cinema", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        var room = new Room(cinema, "Target Room", null, null, null, null);
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();

        // Act
        var response = await _client.GetAsync($"/api/cinemas/{cinema.Id}/Rooms/{room.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<RoomDto>>();
        result.Should().NotBeNull();
        result!.Data!.Name.Should().Be("Target Room");
    }

    [Fact]
    public async Task CreateRoom_ReturnsOk_WhenAdmin()
    {
        // Arrange
        var cinema = new Cinema("Cinema", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser("admin-id", "ADMIN");
        var command = new CreateRoomCommand { CinemaId = cinema.Id, Name = "New Room" };

        // Act
        var response = await _client.PostAsJsonAsync($"/api/cinemas/{cinema.Id}/Rooms", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<RoomDto>>();
        result.Should().NotBeNull();
        result!.Data!.Name.Should().Be("New Room");
    }

    [Fact]
    public async Task CreateRoom_ReturnsForbidden_WhenNotAdmin()
    {
        // Arrange
        AuthenticateAsUser("user-id", "USER");
        var command = new CreateRoomCommand { CinemaId = 1, Name = "New Room" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/cinemas/1/Rooms", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateRoom_ReturnsOk_WhenAdmin()
    {
        // Arrange
        var cinema = new Cinema("Cinema", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        var room = new Room(cinema, "Old Room", null, null, null, null);
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser("admin-id", "ADMIN");
        var command = new UpdateRoomCommand { Id = room.Id, CinemaId = cinema.Id, Name = "Updated Room" };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/cinemas/{cinema.Id}/Rooms/{room.Id}", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<RoomDto>>();
        result.Should().NotBeNull();
        result!.Data!.Name.Should().Be("Updated Room");
    }

    [Fact]
    public async Task DeleteRoom_ReturnsOk_WhenAdmin()
    {
        // Arrange
        var cinema = new Cinema("Cinema", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        var room = new Room(cinema, "Delete Room", null, null, null, null);
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();

        AuthenticateAsUser("admin-id", "ADMIN");

        // Act
        var response = await _client.DeleteAsync($"/api/cinemas/{cinema.Id}/Rooms/{room.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<bool>>();
        result!.Data.Should().BeTrue();
    }
}
