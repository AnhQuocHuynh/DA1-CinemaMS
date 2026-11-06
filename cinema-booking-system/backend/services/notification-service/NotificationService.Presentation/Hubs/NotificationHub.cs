using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace NotificationService.Presentation.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    /// <summary>
    /// When a client connects, join a group named after their userId
    /// so push notifications can be targeted to specific users.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();

        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();

        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private string? GetUserId()
    {
        var header = Context.GetHttpContext()?.Request.Headers["X-User-Id"].ToString();
        if (!string.IsNullOrWhiteSpace(header))
        {
            return header;
        }

        return Context.User?.FindFirst("userId")?.Value 
            ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? Context.User?.FindFirst("sub")?.Value;
    }
}
