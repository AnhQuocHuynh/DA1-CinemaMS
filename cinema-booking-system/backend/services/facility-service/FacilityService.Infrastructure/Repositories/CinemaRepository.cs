using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using FacilityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Infrastructure.Repositories
{
    public class CinemaRepository : ICinemaRepository
    {
        private readonly FacilityDbContext _context;

        public CinemaRepository(FacilityDbContext context)
        {
            _context = context;
        }

        public async Task<Cinema?> GetByIdAsync(long id)
        {
            return await _context.Cinemas
                .Include(c => c.Rooms)
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<IEnumerable<Cinema>> GetAllAsync()
        {
            return await _context.Cinemas
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<IEnumerable<Cinema>> GetAllWithRoomsAsync()
        {
            return await _context.Cinemas
                .AsNoTracking()
                .Include(c => c.Rooms)
                .ToListAsync();
        }

        public async Task AddAsync(Cinema cinema)
        {
            await _context.Cinemas
                .AddAsync(cinema);
        }

        public void Update(Cinema cinema)
        {
            _context.Cinemas
                .Update(cinema);
        }

        public void Delete(Cinema cinema)
        {
            _context.Cinemas
                .Remove(cinema);
        }
    }
}
