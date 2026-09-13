using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;

namespace NotificationService.Presentation.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    // Clients will connect here to listen for real-time events.
    // Methods can be added if clients need to send messages to the server,
    // but mostly the server will broadcast to clients.
}
