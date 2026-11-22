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
    /// Creates a controller whose HttpContext.User carries the given userId claim.
    /// Pass null to simulate a request with no NameIdentifier claim.
    /// </summary>
    private UsersController CreateController(string? userIdClaim = "1")
    {
        var controller = new UsersController(_mediatorMock.Object);
        var claims = userIdClaim is not null
            ? new List<Claim> { new(ClaimTypes.NameIdentifier, userIdClaim) }
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
    public async Task GetCurrentUser_WithValidUserIdClaim_ReturnsOkWithDto()
    {
        var dto = new UserDto(1, "test-kc-id", "test@test.com", "Test", null, null, null, true);
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdQuery>(q => q.Id == 1L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(dto);

        var result = await CreateController("1").GetCurrentUser();

        result.Should().BeOfType<OkObjectResult>();
        var wrapper = ((OkObjectResult)result).Value.Should().BeOfType<ApiResponse<UserDto>>().Subject;
        wrapper.Success.Should().BeTrue();
        wrapper.Data.Should().Be(dto);
    }

    [Fact]
    public async Task GetCurrentUser_MissingUserIdClaim_ReturnsUnauthorized()
    {
        var result = await CreateController(userIdClaim: null).GetCurrentUser();

        result.Should().BeOfType<UnauthorizedResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<GetUserByIdQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetCurrentUser_NonNumericUserIdClaim_ReturnsUnauthorized()
    {
        var result = await CreateController(userIdClaim: "non-numeric").GetCurrentUser();

        result.Should().BeOfType<UnauthorizedResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<GetUserByIdQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetCurrentUser_WithXUserIdHeader_ReturnsOkWithDto()
    {
        var dto = new UserDto(99, "test-kc-id", "test@test.com", "Test", null, null, null, true);
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdQuery>(q => q.Id == 99L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(dto);

        var controller = CreateController(userIdClaim: null);
        controller.HttpContext.Request.Headers["X-User-Id"] = "99";

        var result = await controller.GetCurrentUser();

        result.Should().BeOfType<OkObjectResult>();
        var wrapper = ((OkObjectResult)result).Value.Should().BeOfType<ApiResponse<UserDto>>().Subject;
        wrapper.Success.Should().BeTrue();
        wrapper.Data.Should().Be(dto);
    }

    [Fact]
    public async Task GetCurrentUser_WithInternalUserIdClaim_ReturnsOkWithDto()
    {
        var dto = new UserDto(77, "test-kc-id", "test@test.com", "Test", null, null, null, true);
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserByIdQuery>(q => q.Id == 77L), It.IsAny<CancellationToken>()))
            .ReturnsAsync(dto);

        var controller = new UsersController(_mediatorMock.Object);
        var claims = new List<Claim> { new("internal_user_id", "77") };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };

        var result = await controller.GetCurrentUser();

        result.Should().BeOfType<OkObjectResult>();
        var wrapper = ((OkObjectResult)result).Value.Should().BeOfType<ApiResponse<UserDto>>().Subject;
        wrapper.Success.Should().BeTrue();
        wrapper.Data.Should().Be(dto);
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

    // ─── PUT /api/users/{id}/cinema ───────────────────────────────────────────

    [Fact]
    public async Task AssignStaffCinema_ValidRequest_SendsCommandAndReturnsNoContent()
    {
        _mediatorMock.Setup(m => m.Send(It.IsAny<AssignStaffCinemaCommand>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await CreateController().AssignStaffCinema(4L, new AssignCinemaRequest(3L));

        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<AssignStaffCinemaCommand>(c => c.UserId == 4L && c.CinemaId == 3L),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── PUT /api/users/me ────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateCurrentUser_ValidRequest_ResolvesUserIdAndReturnsNoContent()
    {
        _mediatorMock.Setup(m => m.Send(It.IsAny<UpdateUserProfileCommand>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var command = new UpdateUserProfileCommand(0, "123", null, null);
        var result = await CreateController("42").UpdateCurrentUser(command);

        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<UpdateUserProfileCommand>(c => c.UserId == 42L),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateCurrentUser_MissingUserIdClaim_ReturnsUnauthorized()
    {
        var command = new UpdateUserProfileCommand(0, "123", null, null);

        var result = await CreateController(userIdClaim: null).UpdateCurrentUser(command);

        result.Should().BeOfType<UnauthorizedResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<UpdateUserProfileCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
