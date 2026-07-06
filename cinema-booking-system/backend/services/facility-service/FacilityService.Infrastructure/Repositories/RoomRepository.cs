using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using FacilityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FacilityService.Infrastructure.Repositories
{
    public class RoomRepository : IRoomRepository
    {
        private readonly FacilityDbContext _context;

        public RoomRepository(FacilityDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(Room room)
        {
            await _context.Rooms
                .AddAsync(room);
        }

        public void Delete(Room room)
        {
            return; // Soft delete is handled in the Room entity itself, so no action is needed here.
        }

        public async Task<Room?> GetByIdAsync(long id)
        {
            return await _context.Rooms
                .Include(r => r.SeatTemplates)
                .FirstOrDefaultAsync(r => r.Id == id);
        }

        public async Task<IEnumerable<Room>> GetRoomsByCinemaIdAsync(long cinemaId)
        {
            return await _context.Rooms
                .AsNoTracking()
                .Where(r => r.CinemaId == cinemaId)
                .ToListAsync();
        }

        public void Update(Room room)
        {
            return; // Updates are tracked automatically by EF Core, so no action is needed here.
        }
    }
}
