using FacilityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace FacilityService.Infrastructure.Data
{
    public class FacilityDbContext : DbContext
    {
        public FacilityDbContext(DbContextOptions<FacilityDbContext> options) : base(options) { }

        public DbSet<Cinema> Cinemas => Set<Cinema>();
        public DbSet<Room> Rooms => Set<Room>();
        public DbSet<SeatType> SeatTypes => Set<SeatType>();
        public DbSet<SeatTemplate> SeatTemplates => Set<SeatTemplate>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
            base.OnModelCreating(builder);
        }
    }
}
