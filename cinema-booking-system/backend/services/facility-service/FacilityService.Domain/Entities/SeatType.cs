using System;
using FacilityService.Domain.Enum;

namespace FacilityService.Domain.Entities
{
    public class SeatType
    {
        public long Id { get; private set; }
        public SeatTypeCode Code { get; private set; }
        public string Name { get; private set; }
        public string? DisplayName { get; private set; }
        public decimal? PriceMultiplier { get; private set; }
        public int? DefaultColumnSpan { get; private set; } = 1;
        public string? Description { get; private set; }

        private SeatType() 
        { 
            Name = null!;
        } // EF Core

        public SeatType(SeatTypeCode code, string name, string? displayName, decimal? priceMultiplier, int? defaultColumnSpan, string? description)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("Name is required", nameof(name));
            }
            
            Code = code;
            Name = name;
            DisplayName = displayName;
            PriceMultiplier = priceMultiplier;
            DefaultColumnSpan = defaultColumnSpan ?? 1;
            Description = description;
        }

        public void Update(string name, string? displayName, decimal? priceMultiplier, int? defaultColumnSpan, string? description)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("Name is required", nameof(name));
            }

            Name = name;
            DisplayName = displayName;
            PriceMultiplier = priceMultiplier;
            DefaultColumnSpan = defaultColumnSpan ?? 1;
            Description = description;
        }
    }
}
