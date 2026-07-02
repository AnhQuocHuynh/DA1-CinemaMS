using FacilityService.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Domain.Interfaces
{
    public interface IRoomRepository
    {
        Task<Room?> GetByIdAsync(long id);
        Task<IEnumerable<Room>> GetRoomsByCinemaIdAsync(long cinemaId);
        Task AddAsync(Room room);
        void Update(Room room);
        void Delete(Room room);
    }
}
