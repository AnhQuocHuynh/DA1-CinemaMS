using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using System.Collections.Generic;
using System.Threading.Tasks;
using FacilityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
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

        public Task<SeatType?> GetByCodeAsync(FacilityService.Domain.Enum.SeatTypeCode code)
        {
            throw new NotImplementedException();
        }

        public async Task<IEnumerable<SeatType>> GetAllAsync()
        {
            return await _context.SeatTypes
            .AsNoTracking()
            .ToListAsync();
        }

        public Task AddAsync(SeatType seatType)
        {
            throw new NotImplementedException();
        }

        public void Update(SeatType seatType)
        {
            throw new NotImplementedException();
        }
    }
}
