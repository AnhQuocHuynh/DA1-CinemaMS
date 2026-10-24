using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;

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
        // X-User-Id is forwarded by the API Gateway as a header-based claim
        var userId = Context.GetHttpContext()?.Request.Headers["X-User-Id"].ToString();

        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, userId);
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(System.Exception? exception)
    {
        var userId = Context.GetHttpContext()?.Request.Headers["X-User-Id"].ToString();

        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
