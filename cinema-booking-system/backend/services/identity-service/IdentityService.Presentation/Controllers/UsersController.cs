using IdentityService.Application.DTOs;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using IdentityService.Application.Features.Internal.Queries;
using System.Linq;

namespace IdentityService.Presentation.Controllers;

/// <summary>Request body for changing a user's role.</summary>
public record ChangeUserRoleRequest(string NewRole);

public record ReplaceCinemaAssignmentsRequest(IReadOnlyList<CinemaAssignmentInput> Assignments);

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
        var keycloakId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(keycloakId))
        {
            return Unauthorized();
        }

        var query = new GetCurrentUserQuery(keycloakId);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<UserDto>.Ok(result));
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetUserById(long id)
    {
        var query = new GetUserByIdQuery(id);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<UserDto>.Ok(result));
    }

    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var query = new GetUsersQuery(page, pageSize);
        var result = await _mediator.Send(query);
        return Ok(ApiResponse<PagedResult<UserDto>>.Ok(result));
    }

    [HttpPut("{id}/role")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> ChangeUserRole(long id, [FromBody] ChangeUserRoleRequest request)
    {
        var command = new ChangeUserRoleCommand(id, request.NewRole);
        await _mediator.Send(command);
        return NoContent();
    }

    [HttpGet("{id}/cinema-assignments")]
    [Authorize(Roles = "ADMIN,MANAGER")]
    public async Task<IActionResult> GetCinemaAssignments(long id)
    {
        var actorId = await CurrentUserId();
        var roles = User.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToList();
        var result = await _mediator.Send(new GetCinemaAssignmentsQuery(actorId, roles, id));
        return Ok(ApiResponse<IReadOnlyList<CinemaAssignmentDto>>.Ok(result));
    }

    [HttpPut("{id}/cinema-assignments")]
    [Authorize(Roles = "ADMIN,MANAGER")]
    public async Task<IActionResult> ReplaceCinemaAssignments(long id, [FromBody] ReplaceCinemaAssignmentsRequest request)
    {
        var actorId = await CurrentUserId();
        var roles = User.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToList();
        var result = await _mediator.Send(new ReplaceCinemaAssignmentsCommand(
            actorId,
            roles,
            id,
            request.Assignments ?? Array.Empty<CinemaAssignmentInput>()));
        return Ok(ApiResponse<IReadOnlyList<CinemaAssignmentDto>>.Ok(result));
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateCurrentUser([FromBody] UpdateUserProfileCommand command)
    {
        var keycloakId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(keycloakId))
        {
            return Unauthorized();
        }

        var userId = await CurrentUserId();

        command = command with { UserId = userId };

        await _mediator.Send(command);
        return NoContent();
    }

    private async Task<long> CurrentUserId()
    {
        var keycloakId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(keycloakId))
        {
            throw new UnauthorizedAccessException("Authentication is required.");
        }
        return await _mediator.Send(new ResolveKeycloakIdQuery(keycloakId));
    }
}
