using FacilityService.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Domain.Interfaces
{
    public interface ICinemaRepository
    {
        Task<Cinema?> GetByIdAsync(long id);
        Task<IEnumerable<Cinema>> GetAllAsync();
        Task<IEnumerable<Cinema>> GetAllWithRoomsAsync();
        Task AddAsync(Cinema cinema);
        void Update(Cinema cinema);
        void Delete(Cinema cinema);
    }
}
