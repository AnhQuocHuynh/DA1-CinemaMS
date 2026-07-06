using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Contracts
{
    public interface IShowtimeServiceClient
    {
        Task<bool> HasFutureShowtimesAsync(IEnumerable<long> roomIds, CancellationToken token = default);
    }
}