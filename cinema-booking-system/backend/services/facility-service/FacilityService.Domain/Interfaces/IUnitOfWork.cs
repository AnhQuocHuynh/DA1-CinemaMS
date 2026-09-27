using System;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Domain.Interfaces
{
    public interface IUnitOfWork : IDisposable
    {
        ICinemaRepository Cinemas { get; }
        IRoomRepository Rooms { get; }
        ISeatTypeRepository SeatTypes { get; }
        ISeatTemplateRepository SeatTemplates { get; }
        
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
