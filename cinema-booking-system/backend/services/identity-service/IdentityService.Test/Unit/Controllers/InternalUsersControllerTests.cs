using FluentAssertions;
using IdentityService.Application.DTOs;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Internal.Queries;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Presentation.Controllers;
using IdentityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Controllers;

public class InternalUsersControllerTests
{
    private readonly Mock<IMediator> _mediatorMock = new();
    private readonly InternalUsersController _controller;

    public InternalUsersControllerTests()
    {
        _controller = new InternalUsersController(_mediatorMock.Object);
    }

    // ─── Normal: valid keycloakId → resolves and returns OK ──────────────────

    [Fact]
    public async Task ResolveKeycloakId_ValidId_ReturnsOkWithUserId()
    {
        _mediatorMock.Setup(m => m.Send(It.IsAny<ResolveKeycloakIdQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(99L);

        var result = await _controller.ResolveKeycloakId("some-kc-id");

        result.Should().BeOfType<OkObjectResult>();
        ((OkObjectResult)result).Value.Should().Be(99L);
        _mediatorMock.Verify(m => m.Send(
            It.Is<ResolveKeycloakIdQuery>(q => q.KeycloakId == "some-kc-id"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Error: empty keycloakId → bad request (no mediator call) ────────────

    [Fact]
    public async Task ResolveKeycloakId_EmptyId_ReturnsBadRequestWithoutCallingMediator()
    {
        var result = await _controller.ResolveKeycloakId("");

        result.Should().BeOfType<BadRequestObjectResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<ResolveKeycloakIdQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Error: null keycloakId → bad request ────────────────────────────────

    [Fact]
    public async Task ResolveKeycloakId_NullId_ReturnsBadRequestWithoutCallingMediator()
    {
        var result = await _controller.ResolveKeycloakId(null!);

        result.Should().BeOfType<BadRequestObjectResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<ResolveKeycloakIdQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Normal: valid userId → returns user DTO ─────────────────────────────

    [Fact]
    public async Task GetUserById_ValidId_ReturnsOkWithUser()
    {
        var userDto = new UserDto(123L, "kc-123", "test@test.com", "Test User", null, null, null, true);
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdQuery>(q => q.Id == 123L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(userDto);

        var result = await _controller.GetUserById(123L);

        result.Should().BeOfType<OkObjectResult>();
        ((OkObjectResult)result).Value.Should().Be(userDto);
    }

    // ─── GetUserCinemaScope: Normal Paths ────────────────────────────────────

    [Fact]
    public async Task GetUserCinemaScope_AdminUser_ReturnsAdminScopeWithEmptyCinemaIds()
    {
        // Arrange
        var userDto = new UserDto(
            1L, "kc-admin", "admin@test.com", "Admin User",
            null, null, null, true,
            new[] { "ADMIN" }, null);

        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdInternalQuery>(q => q.Id == 1L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(userDto);

        // Act
        var result = await _controller.GetUserCinemaScope(1L);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CinemaScopeDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data.Should().NotBeNull();
        apiResponse.Data!.RealmRole.Should().Be("ADMIN");
        apiResponse.Data.CinemaIds.Should().BeEmpty();
    }

    [Fact]
    public async Task GetUserCinemaScope_StaffUserWithCinema_ReturnsStaffScopeWithAssignedCinemaId()
    {
        // Arrange
        var userDto = new UserDto(
            4L, "kc-staff", "staff@test.com", "Staff User",
            null, null, null, true,
            new[] { "STAFF" }, 3L);

        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdInternalQuery>(q => q.Id == 4L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(userDto);

        // Act
        var result = await _controller.GetUserCinemaScope(4L);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CinemaScopeDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data.Should().NotBeNull();
        apiResponse.Data!.RealmRole.Should().Be("STAFF");
        apiResponse.Data.CinemaIds.Should().ContainSingle().Which.Should().Be(3L);
    }

    [Fact]
    public async Task GetUserCinemaScope_CustomerUser_ReturnsCustomerScopeWithEmptyCinemaIds()
    {
        // Arrange
        var userDto = new UserDto(
            7L, "kc-customer", "customer@test.com", "Customer User",
            null, null, null, true,
            new[] { "CUSTOMER" }, null);

        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdInternalQuery>(q => q.Id == 7L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(userDto);

        // Act
        var result = await _controller.GetUserCinemaScope(7L);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CinemaScopeDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data.Should().NotBeNull();
        apiResponse.Data!.RealmRole.Should().Be("CUSTOMER");
        apiResponse.Data.CinemaIds.Should().BeEmpty();
    }

    // ─── GetUserCinemaScope: Abnormal Paths (Edge Cases) ─────────────────────

    [Fact]
    public async Task GetUserCinemaScope_NullRolesAndNullCinema_DefaultsToCustomerAndEmptyCinemaIds()
    {
        // Arrange
        var userDto = new UserDto(
            8L, "kc-null", "nullroles@test.com", "Null Roles User",
            null, null, null, true,
            null, null);

        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdInternalQuery>(q => q.Id == 8L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(userDto);

        // Act
        var result = await _controller.GetUserCinemaScope(8L);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CinemaScopeDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data.Should().NotBeNull();
        apiResponse.Data!.RealmRole.Should().Be("CUSTOMER");
        apiResponse.Data.CinemaIds.Should().BeEmpty();
    }

    [Fact]
    public async Task GetUserCinemaScope_MixedCaseCustomerAndStaffRoles_PrioritizesStaffRole()
    {
        // Arrange
        var userDto = new UserDto(
            9L, "kc-mixed", "mixed@test.com", "Mixed Roles User",
            null, null, null, true,
            new[] { "customer", "staff" }, 7L);

        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdInternalQuery>(q => q.Id == 9L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(userDto);

        // Act
        var result = await _controller.GetUserCinemaScope(9L);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<CinemaScopeDto>>().Subject;
        apiResponse.Success.Should().BeTrue();
        apiResponse.Data.Should().NotBeNull();
        apiResponse.Data!.RealmRole.Should().Be("STAFF");
        apiResponse.Data.CinemaIds.Should().ContainSingle().Which.Should().Be(7L);
    }

    // ─── GetUserCinemaScope: Error Path ──────────────────────────────────────

    [Fact]
    public async Task GetUserCinemaScope_UserNotFound_ThrowsUserNotFoundException()
    {
        // Arrange
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdInternalQuery>(q => q.Id == 404L), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new UserNotFoundException(404L));

        // Act
        Func<Task> act = () => _controller.GetUserCinemaScope(404L);

        // Assert
        await act.Should().ThrowAsync<UserNotFoundException>();
    }
}

