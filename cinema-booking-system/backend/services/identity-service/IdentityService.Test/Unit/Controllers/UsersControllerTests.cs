using FluentAssertions;
using IdentityService.Application.DTOs;
using IdentityService.Application.Features.Internal.Queries;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Presentation.Controllers;
using IdentityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Controllers;

public class UsersControllerTests
{
    private readonly Mock<IMediator> _mediatorMock = new();

    /// <summary>
    /// Creates a controller whose HttpContext.User carries the given keycloakId claim.
    /// Pass null to simulate a request with no NameIdentifier claim.
    /// </summary>
    private UsersController CreateController(string? keycloakId = "test-kc-id")
    {
        var controller = new UsersController(_mediatorMock.Object);
        var claims = keycloakId is not null
            ? new List<Claim> { new(ClaimTypes.NameIdentifier, keycloakId) }
            : new List<Claim>();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
        return controller;
    }

    // ─── GET /api/users/me ────────────────────────────────────────────────────

    [Fact]
    public async Task GetCurrentUser_WithValidKeycloakIdClaim_ReturnsOkWithDto()
    {
        var dto = new UserDto(1, "test-kc-id", "test@test.com", "Test", null, null, null, true);
        _mediatorMock.Setup(m => m.Send(It.IsAny<GetCurrentUserQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(dto);

        var result = await CreateController().GetCurrentUser();

        result.Should().BeOfType<OkObjectResult>();
        var wrapper = ((OkObjectResult)result).Value.Should().BeOfType<ApiResponse<UserDto>>().Subject;
        wrapper.Success.Should().BeTrue();
        wrapper.Data.Should().Be(dto);
    }

    [Fact]
    public async Task GetCurrentUser_MissingKeycloakIdClaim_ReturnsUnauthorized()
    {
        var result = await CreateController(keycloakId: null).GetCurrentUser();

        result.Should().BeOfType<UnauthorizedResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<GetCurrentUserQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── GET /api/users/{id} ──────────────────────────────────────────────────

    [Fact]
    public async Task GetUserById_ReturnsOkWithDto()
    {
        var dto = new UserDto(5, "kc-5", "admin@test.com", "Admin", null, null, null, true);
        _mediatorMock.Setup(m => m.Send(It.IsAny<GetUserByIdQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(dto);

        var result = await CreateController().GetUserById(5);

        result.Should().BeOfType<OkObjectResult>();
        var wrapper = ((OkObjectResult)result).Value.Should().BeOfType<ApiResponse<UserDto>>().Subject;
        wrapper.Success.Should().BeTrue();
        wrapper.Data.Should().Be(dto);
    }

    // ─── GET /api/users ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetUsers_ReturnsOkWithPagedResult()
    {
        var paged = new PagedResult<UserDto>(new List<UserDto>(), 0, 1, 10);
        _mediatorMock.Setup(m => m.Send(It.IsAny<GetUsersQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(paged);

        var result = await CreateController().GetUsers(1, 10);

        result.Should().BeOfType<OkObjectResult>();
        var wrapper = ((OkObjectResult)result).Value.Should().BeOfType<ApiResponse<PagedResult<UserDto>>>().Subject;
        wrapper.Success.Should().BeTrue();
        wrapper.Data.Should().Be(paged);
    }

    // ─── PUT /api/users/{id}/role ─────────────────────────────────────────────

    [Fact]
    public async Task ChangeUserRole_ValidRequest_ReturnsNoContent()
    {
        _mediatorMock.Setup(m => m.Send(It.IsAny<ChangeUserRoleCommand>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await CreateController().ChangeUserRole(1, new ChangeUserRoleRequest("ADMIN"));

        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<ChangeUserRoleCommand>(c => c.UserId == 1 && c.NewRole == "ADMIN"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── PUT /api/users/me ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateCurrentUser_ValidRequest_ResolvesUserIdAndReturnsNoContent()
    {
        _mediatorMock.Setup(m => m.Send(It.IsAny<ResolveKeycloakIdQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(42L);
        _mediatorMock.Setup(m => m.Send(It.IsAny<UpdateUserProfileCommand>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new UpdateUserProfileCommand(0, "123", null, null);
        var result = await CreateController("test-kc-id").UpdateCurrentUser(command);

        result.Should().BeOfType<NoContentResult>();
        // The controller resolves userId=42 and replaces the placeholder 0
        _mediatorMock.Verify(m => m.Send(
            It.Is<UpdateUserProfileCommand>(c => c.UserId == 42),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateCurrentUser_MissingKeycloakIdClaim_ReturnsUnauthorized()
    {
        var command = new UpdateUserProfileCommand(0, "123", null, null);

        var result = await CreateController(keycloakId: null).UpdateCurrentUser(command);

        result.Should().BeOfType<UnauthorizedResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<ResolveKeycloakIdQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
