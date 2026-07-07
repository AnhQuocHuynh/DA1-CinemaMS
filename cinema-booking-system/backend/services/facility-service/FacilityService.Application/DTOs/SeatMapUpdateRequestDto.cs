using System.Collections.Generic;

namespace FacilityService.Application.DTOs
{
    public class SeatMapUpdateRequestDto
    {
        public int Rows { get; set; }
        public int Columns { get; set; }
        public List<SeatRequestDto> Seats { get; set; } = new();
    }

    public class SeatRequestDto
    {
        public string RowLabel { get; set; } = string.Empty;
        public int ColumnNumber { get; set; }
        public string SeatTypeCode { get; set; } = string.Empty;
    }
}
