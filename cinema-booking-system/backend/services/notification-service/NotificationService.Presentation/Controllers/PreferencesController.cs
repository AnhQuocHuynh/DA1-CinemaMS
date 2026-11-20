using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Application.Features.Preferences.Commands;
using NotificationService.Application.Features.Preferences.Queries;
using System.Security.Claims;

namespace NotificationService.Presentation.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PreferencesController : ControllerBase
{
    private readonly IMediator _mediator;

    public PreferencesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyPreference()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var result = await _mediator.Send(new GetUserPreferenceQuery(userId.Value));
        return Ok(result);
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMyPreference([FromBody] UpdateUserPreferenceCommand command)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        command = command with { UserId = userId.Value };
        await _mediator.Send(command);
        return NoContent();
    }

    [HttpGet("{userId}")]
    public async Task<IActionResult> GetUserPreference(long userId)
    {
        if (!IsAuthorizedForUser(userId))
        {
            return Forbid();
        }
        var result = await _mediator.Send(new GetUserPreferenceQuery(userId));
        return Ok(result);
    }

    [HttpPut("{userId}")]
    public async Task<IActionResult> UpdateUserPreference(long userId, [FromBody] UpdateUserPreferenceCommand command)
    {
        if (!IsAuthorizedForUser(userId))
        {
            return Forbid();
        }

        if (command.UserId != 0 && command.UserId != userId)
        {
            return BadRequest("User ID mismatch");
        }

        command = command with { UserId = userId };
        await _mediator.Send(command);
        return NoContent();
    }

    private long? GetCurrentUserId()
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

    private bool IsAuthorizedForUser(long targetUserId)
    {
        if (User.IsInRole("ADMIN") || User.IsInRole("admin"))
            return true;

        var currentUserId = GetCurrentUserId();
        return currentUserId.HasValue && currentUserId.Value == targetUserId;
    }
}
