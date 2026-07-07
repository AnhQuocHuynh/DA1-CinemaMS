using FacilityService.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Domain.Interfaces
{
    public interface ISeatTypeRepository
    {
        Task<SeatType?> GetByIdAsync(long id);
        Task<SeatType?> GetByCodeAsync(FacilityService.Domain.Enum.SeatTypeCode code);
        Task<IEnumerable<SeatType>> GetAllAsync();
        Task AddAsync(SeatType seatType);
        void Update(SeatType seatType);
    }
}
