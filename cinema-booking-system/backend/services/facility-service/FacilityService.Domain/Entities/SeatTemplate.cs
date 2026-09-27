using System;

namespace FacilityService.Domain.Entities
{
    public class SeatTemplate
    {
        public long Id { get; private set; }
        
        public long RoomId { get; private set; }
        public Room Room { get; private set; }
        
        public long? SeatTypeId { get; private set; }
        public SeatType? SeatType { get; private set; }
        
        public string RowLabel { get; private set; }
        public int ColumnNumber { get; private set; }
        public int? ColumnSpan { get; private set; } = 1;
        public bool Pathway { get; private set; } = false;
        public bool Active { get; private set; } = true;

        private SeatTemplate() 
        { 
            Room = null!;
            RowLabel = null!;
        } // EF Core

        public SeatTemplate(Room room, SeatType? seatType, string rowLabel, int columnNumber, int? columnSpan = 1, bool pathway = false)
        {
            if (string.IsNullOrWhiteSpace(rowLabel))
            {
                throw new ArgumentException("RowLabel is required", nameof(rowLabel));
            }
            if (columnNumber <= 0)
            {
                throw new ArgumentException("ColumnNumber must be greater than 0", nameof(columnNumber));
            }

            Room = room ?? throw new ArgumentNullException(nameof(room));
            RoomId = room.Id;
            SeatType = seatType;
            SeatTypeId = seatType?.Id;
            RowLabel = rowLabel;
            ColumnNumber = columnNumber;
            ColumnSpan = columnSpan ?? 1;
            Pathway = pathway;
            Active = true;
        }

        public void Update(int? columnSpan, bool pathway, bool active)
        {
            ColumnSpan = columnSpan ?? 1;
            Pathway = pathway;
            Active = active;
        }

        public void Disable()
        {
            Active = false;
        }

        public void Enable()
        {
            Active = true;
        }
    }
}
