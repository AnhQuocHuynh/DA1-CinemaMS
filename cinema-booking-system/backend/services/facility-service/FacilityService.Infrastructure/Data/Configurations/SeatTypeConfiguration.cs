using FacilityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FacilityService.Infrastructure.Data.Configurations
{
    public class SeatTypeConfiguration : IEntityTypeConfiguration<SeatType>
    {
        public void Configure(EntityTypeBuilder<SeatType> builder)
        {
            builder.ToTable("seat_types");
            
            builder.HasKey(st => st.Id);
            
            builder.Property(st => st.Code)
                .IsRequired()
                .HasConversion<string>()
                .HasMaxLength(30);

            builder.HasIndex(st => st.Code).IsUnique();

            builder.Property(st => st.Name)
                .IsRequired()
                .HasMaxLength(50);

            builder.HasIndex(st => st.Name).IsUnique();

            builder.Property(st => st.DisplayName)
                .HasMaxLength(100);

            builder.Property(st => st.PriceMultiplier)
                .HasColumnType("decimal(12,2)");

            builder.Property(st => st.DefaultColumnSpan)
                .HasDefaultValue(1);

            builder.Property(st => st.Description);
        }
    }
}
