using MediatR;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Application.Features.Preferences.Commands;
using NotificationService.Application.Features.Preferences.Queries;

namespace NotificationService.Presentation.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PreferencesController : ControllerBase
{
    private readonly IMediator _mediator;

    public PreferencesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("{userId}")]
    public async Task<IActionResult> GetUserPreference(long userId)
    {
        var result = await _mediator.Send(new GetUserPreferenceQuery(userId));
        return Ok(result);
    }

    [HttpPut("{userId}")]
    public async Task<IActionResult> UpdateUserPreference(long userId, [FromBody] UpdateUserPreferenceCommand command)
    {
        if (userId != command.UserId)
        {
            return BadRequest("User ID mismatch");
        }
        
        await _mediator.Send(command);
        return NoContent();
    }
}
