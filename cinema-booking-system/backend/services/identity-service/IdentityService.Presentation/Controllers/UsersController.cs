using IdentityService.Application.DTOs;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using IdentityService.Application.Features.Internal.Queries;

namespace IdentityService.Presentation.Controllers;

/// <summary>Request body for changing a user's role.</summary>
public record ChangeUserRoleRequest(string NewRole);

/// <summary>Request body for assigning a user's cinema.</summary>
public record AssignCinemaRequest(long? CinemaId);

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IMediator _mediator;

    public UsersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userId = ResolveUserId();
        if (userId == null) return Unauthorized();
        var query = new GetUserByIdQuery(userId.Value);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<UserDto>.Ok(result));
    }

    [HttpGet("lookup")]
    [Authorize(Roles = "ADMIN,STAFF")]
    public async Task<IActionResult> LookupUserByPhone([FromQuery] string phone)
    {
        var query = new GetUserByPhoneQuery(phone);
        var result = await _mediator.Send(query);
        if (result == null)
        {
            return NotFound(ApiResponse<UserDto>.Error("User not found with provided phone"));
        }
        return Ok(ApiResponse<UserDto>.Ok(result));
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "admin,ADMIN")]
    public async Task<IActionResult> GetUserById(long id)
    {
        var query = new GetUserByIdQuery(id);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<UserDto>.Ok(result));
    }

    [HttpGet]
    [Authorize(Roles = "admin,ADMIN")]
    public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new GetUsersQuery(page, pageSize);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<PagedResult<UserDto>>.Ok(result));
    }

    [HttpPut("{id}/role")]
    [Authorize(Roles = "admin,ADMIN")]
    public async Task<IActionResult> ChangeUserRole(long id, [FromBody] ChangeUserRoleRequest request)
    {
        var command = new ChangeUserRoleCommand(id, request.NewRole);
        await _mediator.Send(command);
        return NoContent();
    }

    [HttpPut("{id}/cinema")]
    [Authorize(Roles = "admin,ADMIN")]
    public async Task<IActionResult> AssignStaffCinema(long id, [FromBody] AssignCinemaRequest request)
    {
        var command = new AssignStaffCinemaCommand(id, request.CinemaId);
        await _mediator.Send(command);
        return NoContent();
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateCurrentUser([FromBody] UpdateUserProfileCommand command)
    {
        var userId = ResolveUserId();
        if (userId == null) return Unauthorized();
        command = command with { UserId = userId.Value };
        await _mediator.Send(command);
        return NoContent();
    }

    private long? ResolveUserId()
    {
        var header = Request.Headers["X-User-Id"].ToString();
        if (long.TryParse(header, out var fromHeader) && fromHeader > 0)
            return fromHeader;

        var internalClaim = User.FindFirstValue("internal_user_id");
        if (long.TryParse(internalClaim, out var fromInternal) && fromInternal > 0)
            return fromInternal;

        var nameId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (long.TryParse(nameId, out var fromNameId) && fromNameId > 0)
            return fromNameId;

        return null;
    }
}
