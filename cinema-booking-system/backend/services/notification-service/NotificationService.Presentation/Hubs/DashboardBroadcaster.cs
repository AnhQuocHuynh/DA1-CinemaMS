using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using NotificationService.Application.Contracts;

namespace NotificationService.Presentation.Hubs;

public class DashboardBroadcaster : IDashboardBroadcaster
{
    private readonly IHubContext<NotificationHub> _hubContext;

    public DashboardBroadcaster(IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task BroadcastSalesUpdateAsync(object payload)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveSalesUpdate", payload);
    }

    public async Task BroadcastRefundUpdateAsync(object payload)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveRefundUpdate", payload);
    }
}
