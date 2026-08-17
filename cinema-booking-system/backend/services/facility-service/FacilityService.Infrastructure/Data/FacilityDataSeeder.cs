using FacilityService.Domain.Entities;
using FacilityService.Domain.Enum;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace FacilityService.Infrastructure.Data
{
    public static class FacilityDataSeeder
    {
        public static async Task SeedAsync(FacilityDbContext context)
        {
            if (!await context.SeatTypes.AnyAsync())
            {
                var standard = new SeatType(SeatTypeCode.STANDARD, "standard", "Standard", 1.0m, 1, "Standard single seat");
                var vip = new SeatType(SeatTypeCode.VIP, "vip", "VIP", 1.30m, 1, "Premium single seat with better position");
                var couple = new SeatType(SeatTypeCode.COUPLE, "couple", "Couple", 2.00m, 2, "Couple seat represented as one logical seat spanning two columns");

                await context.SeatTypes.AddRangeAsync(standard, vip, couple);
                await context.SaveChangesAsync();
            }

            if (!await context.Cinemas.AnyAsync())
            {
                var hcmCinema = new Cinema("CGV HUNG VUONG PLAZA", "126 Hung Vuong, Quan 5", "Ho Chi Minh", "02838350000");
                var thuDucCinema = new Cinema("BETA THU DUC", "Vo Van Ngan, Thu Duc", "Ho Chi Minh", "02873000001");

                await context.Cinemas.AddRangeAsync(hcmCinema, thuDucCinema);
                await context.SaveChangesAsync();
                
                var seatTypes = await context.SeatTypes.ToListAsync();
                var standard = seatTypes.First(x => x.Code == SeatTypeCode.STANDARD);
                var vip = seatTypes.First(x => x.Code == SeatTypeCode.VIP);
                var couple = seatTypes.First(x => x.Code == SeatTypeCode.COUPLE);

                var roomA = SeedRoom(hcmCinema, "Phong A1", "2D", 6, 8, standard, vip, couple);
                var roomB = SeedRoom(hcmCinema, "Phong A2", "IMAX", 5, 7, standard, vip, couple);
                var roomC = SeedRoom(thuDucCinema, "Phong B1", "3D", 6, 6, standard, vip, couple);
                var roomD = SeedRoomWithPathway(hcmCinema, "Phong A3 (Pathway)", "2D", 6, 9, standard, vip, couple);

                await context.Rooms.AddRangeAsync(roomA, roomB, roomC, roomD);
                await context.SaveChangesAsync();
            }
        }

        private static Room SeedRoom(Cinema cinema, string name, string type, int rows, int columns, SeatType standard, SeatType vip, SeatType couple)
        {
            var room = new Room(cinema, name, type, rows * columns, rows, columns);
            
            for (int r = 0; r < rows; r++)
            {
                string rowLabel = ((char)('A' + r)).ToString();
                int c = 1;
                while (c <= columns)
                {
                    var seatType = ResolveSeatTypeForRow(r, rows, standard, vip, couple);
                    int columnSpan = seatType.DefaultColumnSpan ?? 1;
                    
                    var template = new SeatTemplate(room, seatType, rowLabel, c, columnSpan, false);
                    room.SeatTemplates.Add(template);
                    c += columnSpan;
                }
            }
            return room;
        }

        private static Room SeedRoomWithPathway(Cinema cinema, string name, string type, int rows, int columns, SeatType standard, SeatType vip, SeatType couple)
        {
            var room = new Room(cinema, name, type, rows * columns, rows, columns);
            
            for (int r = 0; r < rows; r++)
            {
                string rowLabel = ((char)('A' + r)).ToString();
                int c = 1;
                while (c <= columns)
                {
                    bool isPathway = (c == 5 && r < rows - 1);
                    var seatType = ResolveSeatTypeForRow(r, rows, standard, vip, couple);
                    int columnSpan = seatType.DefaultColumnSpan ?? 1;

                    var template = new SeatTemplate(room, seatType, rowLabel, c, isPathway ? 1 : columnSpan, isPathway);
                    room.SeatTemplates.Add(template);
                    
                    c += isPathway ? 1 : columnSpan;
                }
            }
            return room;
        }

        private static SeatType ResolveSeatTypeForRow(int rowIndex, int totalRows, SeatType standard, SeatType vip, SeatType couple)
        {
            if (rowIndex == totalRows - 1)
            {
                return couple;
            }
            if (rowIndex >= Math.Max(0, totalRows - 3))
            {
                return vip;
            }
            return standard;
        }
    }
}
