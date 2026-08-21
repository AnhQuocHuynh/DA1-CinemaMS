using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FacilityService.Application.DTOs;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Enum;
using FacilityService.Presentation.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FacilityService.Test.Integration.Controllers;

[Collection("IntegrationTests")]
public class SeatTemplatesControllerTests : BaseIntegrationTest
{
    public SeatTemplatesControllerTests(CustomWebApplicationFactory factory) : base(factory)
    {
    }

    private async Task<SeatType> GetOrCreateSeatType()
    {
        var seatType = await _dbContext.SeatTypes.FirstOrDefaultAsync(s => s.Code == SeatTypeCode.STANDARD);
        if (seatType == null)
        {
            seatType = new SeatType(SeatTypeCode.STANDARD, "Standard", null, 1.0m, 1, null);
            _dbContext.SeatTypes.Add(seatType);
            await _dbContext.SaveChangesAsync();
        }
        return seatType;
    }

    [Fact]
    public async Task GetSeatTemplates_ReturnsOk_WithSeats()
    {
        // Arrange
        var cinema = new Cinema("Cinema 1", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        var room = new Room(cinema, "Room 1", null, null, null, null);
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();

        var seatType = await GetOrCreateSeatType();

        var seat = new SeatTemplate(room, seatType, "A", 1, 1, false);
        _dbContext.SeatTemplates.Add(seat);
        await _dbContext.SaveChangesAsync();

        // Act
        var response = await _client.GetAsync($"/api/cinemas/{cinema.Id}/rooms/{room.Id}/seats");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<IEnumerable<SeatTemplateDto>>>();
        result.Should().NotBeNull();
        result!.Data.Should().NotBeEmpty();
    }

    [Fact]
    public async Task UpdateSeatMap_ReturnsOk_WhenAdmin()
    {
        // Arrange
        var cinema = new Cinema("Cinema 2", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        var room = new Room(cinema, "Room 2", null, null, null, null);
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();
        
        var seatType = await GetOrCreateSeatType();

        AuthenticateAsUser("admin-id", "ADMIN");

        var request = new SeatMapUpdateRequestDto
        {
            Rows = 1,
            Columns = 1,
            Seats = new List<SeatRequestDto>
            {
                new SeatRequestDto { RowLabel = "A", ColumnNumber = 1, SeatTypeCode = "STANDARD" }
            }
        };

        // Act
        var response = await _client.PutAsJsonAsync($"/api/cinemas/{cinema.Id}/rooms/{room.Id}/seats", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<bool>>();
        result!.Data.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateSeatMap_ReturnsForbidden_WhenNotAdmin()
    {
        // Arrange
        AuthenticateAsUser("user-id", "USER");
        var request = new SeatMapUpdateRequestDto
        {
            Rows = 1,
            Columns = 1,
            Seats = new List<SeatRequestDto>()
        };

        // Act
        var response = await _client.PutAsJsonAsync("/api/cinemas/1/rooms/1/seats", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetSeatTemplatesInternal_ReturnsOk_WithSeats()
    {
        // Arrange
        var cinema = new Cinema("Cinema Internal", "Address", null, null);
        _dbContext.Cinemas.Add(cinema);
        await _dbContext.SaveChangesAsync();

        var room = new Room(cinema, "Room Internal", null, null, null, null);
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();
        
        var seatType = await GetOrCreateSeatType();

        var seat = new SeatTemplate(room, seatType, "B", 1, 1, false);
        _dbContext.SeatTemplates.Add(seat);
        await _dbContext.SaveChangesAsync();

        // Act
        var response = await _client.GetAsync($"/internal/rooms/{room.Id}/seats");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<IEnumerable<SeatTemplateDto>>>();
        result.Should().NotBeNull();
        result!.Data.Should().NotBeEmpty();
    }
}
