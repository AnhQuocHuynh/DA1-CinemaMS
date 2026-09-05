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
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr) || !long.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var query = new GetUserByIdQuery(userId);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<UserDto>.Ok(result));
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> GetUserById(long id)
    {
        var query = new GetUserByIdQuery(id);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<UserDto>.Ok(result));
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new GetUsersQuery(page, pageSize);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<PagedResult<UserDto>>.Ok(result));
    }

    [HttpPut("{id}/role")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> ChangeUserRole(long id, [FromBody] ChangeUserRoleRequest request)
    {
        var command = new ChangeUserRoleCommand(id, request.NewRole);
        await _mediator.Send(command);
        return NoContent();
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateCurrentUser([FromBody] UpdateUserProfileCommand command)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr) || !long.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        command = command with { UserId = userId };

        await _mediator.Send(command);
        return NoContent();
    }
}
