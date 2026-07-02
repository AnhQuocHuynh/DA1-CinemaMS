using FacilityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FacilityService.Infrastructure.Data.Configurations
{
    public class CinemaConfiguration : IEntityTypeConfiguration<Cinema>
    {
        public void Configure(EntityTypeBuilder<Cinema> builder)
        {
            builder.ToTable("cinemas");
            
            builder.HasKey(c => c.Id);
            
            builder.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(150);

            builder.Property(c => c.Address)
                .IsRequired()
                .HasMaxLength(255);
                
            // Relationships
            builder.HasMany(c => c.Rooms)
                .WithOne(r => r.Cinema)
                .HasForeignKey(r => r.CinemaId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
