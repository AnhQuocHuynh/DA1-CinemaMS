using System.Threading.Tasks;

namespace NotificationService.Application.Contracts;

public interface IDashboardBroadcaster
{
    Task BroadcastSalesUpdateAsync(object payload);
    Task BroadcastRefundUpdateAsync(object payload);
}
