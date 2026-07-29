using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using FacilityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;


namespace FacilityService.Infrastructure.Repositories
{
    public class SeatTemplateRepository : ISeatTemplateRepository
    {
        private readonly FacilityDbContext _context;
        public SeatTemplateRepository(FacilityDbContext context)
        {
            _context = context;
        }

        public async Task AddRangeAsync(IEnumerable<SeatTemplate> seatTemplates)
        {
            await _context.SeatTemplates.AddRangeAsync(seatTemplates);
        }

        public async Task<IEnumerable<SeatTemplate>> GetByRoomIdAsync(long roomId)
        {
            return await _context.SeatTemplates
                .Include(st => st.SeatType)
                .Where(st => st.RoomId == roomId)
                .ToListAsync();
        }

        public void RemoveRange(IEnumerable<SeatTemplate> seatTemplates)
        {
            _context.SeatTemplates.RemoveRange(seatTemplates);
        }
    }
}