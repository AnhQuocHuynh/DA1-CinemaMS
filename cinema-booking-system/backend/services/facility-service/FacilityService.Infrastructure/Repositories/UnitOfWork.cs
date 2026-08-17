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
        public IRoomRepository Rooms { get; }
        public ISeatTypeRepository SeatTypes { get; }
        public ISeatTemplateRepository SeatTemplates { get; }

        public UnitOfWork(
            FacilityDbContext context, 
            ICinemaRepository cinemas, 
            IRoomRepository rooms,
            ISeatTypeRepository seatTypes,
            ISeatTemplateRepository seatTemplates)
        {
            _context = context;
            Cinemas = cinemas;
            Rooms = rooms;
            SeatTypes = seatTypes;
            SeatTemplates = seatTemplates;
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
