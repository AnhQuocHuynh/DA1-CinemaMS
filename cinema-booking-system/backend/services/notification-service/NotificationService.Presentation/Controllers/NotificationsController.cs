using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Features.Notifications.Queries;


namespace NotificationService.Presentation.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly IMediator _mediator;
    public NotificationsController(
        IMediator mediator)
    {
        _mediator = mediator;
    }


    [HttpPost]
    public async Task<IActionResult> SendNotification([FromBody] SendNotificationCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] GetNotificationsQuery query)
    {
        var result = await _mediator.Send(query);
        return Ok(result);
    }

    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetNotificationsByUser(long userId)
    {
        var result = await _mediator.Send(new GetNotificationsByUserQuery(userId));
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
    public async Task<IActionResult> RetryFailedNotification(string id)
    {
        await _mediator.Send(new RetryFailedNotificationCommand(id));
        return NoContent();
    }

    [HttpPost("retry-all")]
    public async Task<IActionResult> RetryAllFailed()
    {
        await _mediator.Send(new RetryAllFailedCommand());
        return NoContent();
    }
}
