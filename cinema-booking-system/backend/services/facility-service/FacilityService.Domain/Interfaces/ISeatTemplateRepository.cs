using FacilityService.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Domain.Interfaces
{
    public interface ISeatTemplateRepository
    {
        Task<IEnumerable<SeatTemplate>> GetByRoomIdAsync(long roomId);
        Task AddRangeAsync(IEnumerable<SeatTemplate> seatTemplates);
        void RemoveRange(IEnumerable<SeatTemplate> seatTemplates);
    }
}
