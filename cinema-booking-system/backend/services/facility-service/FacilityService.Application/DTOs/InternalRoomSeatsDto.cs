namespace FacilityService.Application.DTOs
{
    public class InternalRoomSeatsDto
    {
        public long Id { get; set; }
        public string RowLabel { get; set; } = string.Empty;
        public int ColumnNumber { get; set; }
        public string? SeatTypeCode { get; set; }
        public int? ColumnSpan { get; set; }
        public bool Pathway { get; set; }
    }
}
