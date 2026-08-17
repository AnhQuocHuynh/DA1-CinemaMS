using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using System.Collections.Generic;
using System.Threading.Tasks;
using FacilityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using FacilityService.Domain.Enum;
using System.Linq;
using System;

namespace FacilityService.Infrastructure.Repositories
{
    public class SeatTypeRepository : ISeatTypeRepository
    {
        private readonly FacilityDbContext _context;
        
        public SeatTypeRepository(FacilityDbContext context)
        {
            _context = context;
        }
        
        public async Task<SeatType?> GetByIdAsync(long id)
        {
            return await _context.SeatTypes.FindAsync(id);
        }

        public async Task<SeatType?> GetByCodeAsync(SeatTypeCode code)
        {
            return await _context.SeatTypes.FirstOrDefaultAsync(st => st.Code == code);
        }

        public async Task<IEnumerable<SeatType>> GetAllAsync()
        {
            return await _context.SeatTypes
            .AsNoTracking()
            .ToListAsync();
        }

        public async Task AddAsync(SeatType seatType)
        {
            await _context.SeatTypes.AddAsync(seatType);
        }

        public void Update(SeatType seatType)
        {
            _context.SeatTypes.Update(seatType);
        }
    }
}
