using FacilityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FacilityService.Infrastructure.Data.Configurations
{
    public class RoomConfiguration : IEntityTypeConfiguration<Room>
    {
        public void Configure(EntityTypeBuilder<Room> builder)
        {
            builder.ToTable("rooms");
            
            builder.HasKey(r => r.Id);
            
            builder.Property(r => r.TotalSeats)
                .IsRequired(false);

            builder.Property(r => r.Name)
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(r => r.Type)
                .HasMaxLength(30);

            builder.Property(r => r.Rows);
            builder.Property(r => r.Columns);

            builder.Property(r => r.Active)
                .IsRequired()
                .HasDefaultValue(true);

            builder.Property(r => r.UnderMaintenance)
                .IsRequired()
                .HasDefaultValue(false);
                
            // Relationships
            builder.HasOne(r => r.Cinema)
                .WithMany(c => c.Rooms)
                .HasForeignKey(r => r.CinemaId)
                .OnDelete(DeleteBehavior.Cascade);
                
            builder.HasMany(r => r.SeatTemplates)
                .WithOne(st => st.Room)
                .HasForeignKey(st => st.RoomId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}