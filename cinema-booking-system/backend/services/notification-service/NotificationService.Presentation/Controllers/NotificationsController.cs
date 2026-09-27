using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Features.Notifications.Queries;

namespace NotificationService.Presentation.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly IMediator _mediator;
    public NotificationsController(
        IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> SendNotification([FromBody] SendNotificationCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> GetNotifications([FromQuery] GetNotificationsQuery query)
    {
        var result = await _mediator.Send(query);
        return Ok(result);
    }

    /// <summary>
    /// Get current user's notifications (userId extracted from JWT/Gateway header).
    /// </summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyNotifications()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        
        var result = await _mediator.Send(new GetNotificationsByUserQuery(userId.Value));
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetNotificationById(string id)
    {
        var result = await _mediator.Send(new GetNotificationByIdQuery(id));
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost("{id}/retry")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> RetryFailedNotification(string id)
    {
        await _mediator.Send(new RetryFailedNotificationCommand(id));
        return NoContent();
    }

    [HttpPost("retry-all")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> RetryAllFailed()
    {
        await _mediator.Send(new RetryAllFailedCommand());
        return NoContent();
    }

    /// <summary>
    /// Extracts the internal numeric user ID from the X-User-Id header
    /// (forwarded by the API Gateway).
    /// </summary>
    private long? GetCurrentUserId()
    {
        var header = Request.Headers["X-User-Id"].ToString();
        if (long.TryParse(header, out var userId))
            return userId;
        return null;
    }
}
