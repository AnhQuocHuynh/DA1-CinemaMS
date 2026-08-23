using System.Collections.Generic;

namespace FacilityService.Application.DTOs
{
    public class CinemaWithRoomsDto
    {
        public long Id { get; set; }
        public required string Name { get; set; }
        public required string Address { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
        public bool Active { get; set; }
        public IEnumerable<RoomDto> Rooms { get; set; } = new List<RoomDto>();
    }
}
