using FacilityService.Domain.Interfaces;
using FacilityService.Infrastructure.Data;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Infrastructure.Repositories
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly FacilityDbContext _context;
        public ICinemaRepository Cinemas { get; }
        public IRoomRepository Rooms { get; } // Requires RoomRepository implementation later

        public UnitOfWork(FacilityDbContext context, ICinemaRepository cinemas)
        {
            _context = context;
            Cinemas = cinemas;
            Rooms = null!; // Placeholder until IRoomRepository is implemented
        }

        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await _context.SaveChangesAsync(cancellationToken);
        }

        public void Dispose()
        {
            _context.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}
