using System;
using System.Collections.Generic;

namespace FacilityService.Domain.Entities
{
    public class Room
    {
        public long Id { get; private set; }
        
        public long CinemaId { get; private set; }
        public Cinema Cinema { get; private set; }
        
        public string Name { get; private set; }
        public string? Type { get; private set; }
        public int? TotalSeats { get; private set; }
        public int? Rows { get; private set; }
        public int? Columns { get; private set; }
        
        public bool Active { get; private set; } = true;
        public bool UnderMaintenance { get; private set; } = false;

        public ICollection<SeatTemplate> SeatTemplates { get; private set; } = new List<SeatTemplate>();

        private Room() 
        { 
            Name = null!;
            Cinema = null!;
        } // EF Core

        public Room(Cinema cinema, string name, string? type, int? totalSeats, int? rows, int? columns)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("Name is required", nameof(name));
            }

            Cinema = cinema ?? throw new ArgumentNullException(nameof(cinema));
            CinemaId = cinema.Id;
            Name = name;
            Type = type;
            TotalSeats = totalSeats;
            Rows = rows;
            Columns = columns;
            Active = true;
            UnderMaintenance = false;
        }

        public void Update(string name, string? type, int? totalSeats, int? rows, int? columns)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("Name is required", nameof(name));
            }

            Name = name;
            Type = type;
            TotalSeats = totalSeats;
            Rows = rows;
            Columns = columns;
        }

        public void ChangeCinema(Cinema cinema)
        {
            Cinema = cinema ?? throw new ArgumentNullException(nameof(cinema));
            CinemaId = cinema.Id;
        }

        public void Disable()
        {
            Active = false;
        }

        public void Enable()
        {
            Active = true;
        }

        public void SetMaintenance(bool underMaintenance)
        {
            UnderMaintenance = underMaintenance;
        }

        public void GenerateDefaultSeatMap(SeatType standardSeatType)
        {
            if (standardSeatType == null) throw new ArgumentNullException(nameof(standardSeatType));
            
            SeatTemplates.Clear();

            int rows = Rows ?? 0;
            int columns = Columns ?? 0;
            int totalSeats = 0;

            for (int r = 0; r < rows; r++)
            {
                string rowLabel = ((char)('A' + r)).ToString();
                for (int c = 1; c <= columns; c++)
                {
                    var template = new SeatTemplate(this, standardSeatType, rowLabel, c, 1, false);
                    SeatTemplates.Add(template);
                    totalSeats++;
                }
            }

            TotalSeats = totalSeats;
        }
    }
}
