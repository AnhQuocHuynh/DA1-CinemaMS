namespace FacilityService.Application.DTOs
{
    public class RoomDto
    {
        public long Id { get; set; }
        public long CinemaId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Type { get; set; }
        public int? TotalSeats { get; set; }
        public int? Rows { get; set; }
        public int? Columns { get; set; }
        public bool Active { get; set; }
        public bool UnderMaintenance { get; set; }
    }
}
