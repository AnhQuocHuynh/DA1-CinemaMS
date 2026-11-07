namespace FacilityService.Application.DTOs
{
    public class SeatTemplateDto
    {
        public long Id { get; set; }
        public long SeatTemplateId => Id;
        public string RowLabel { get; set; } = string.Empty;
        public int ColumnNumber { get; set; }
        public string? SeatTypeCode { get; set; }
        public string? SeatType => SeatTypeCode?.ToLowerInvariant();
        public string? SeatTypeName => SeatTypeCode;
        public int? ColumnSpan { get; set; }
        public bool Active { get; set; }
        public bool Pathway { get; set; }
        public decimal? PriceMultiplier { get; set; }
    }
}
