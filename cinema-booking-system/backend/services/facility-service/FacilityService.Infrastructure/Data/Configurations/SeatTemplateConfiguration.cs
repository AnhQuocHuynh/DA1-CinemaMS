using FacilityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FacilityService.Infrastructure.Data.Configurations
{
    public class SeatTemplateConfiguration : IEntityTypeConfiguration<SeatTemplate>
    {
        public void Configure(EntityTypeBuilder<SeatTemplate> builder)
        {
            builder.ToTable("seat_templates");
            
            builder.HasKey(st => st.Id);

            builder.Property(st => st.RowLabel)
                .IsRequired()
                .HasMaxLength(5);

            builder.Property(st => st.ColumnNumber)
                .IsRequired();

            builder.Property(st => st.ColumnSpan)
                .HasDefaultValue(1);

            builder.Property(st => st.Pathway)
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(st => st.Active)
                .IsRequired()
                .HasDefaultValue(true);

            // Relationships
            builder.HasOne(st => st.Room)
                .WithMany(r => r.SeatTemplates)
                .HasForeignKey(st => st.RoomId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(st => st.SeatType)
                .WithMany()
                .HasForeignKey(st => st.SeatTypeId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Unique Constraint
            builder.HasIndex(st => new { st.RoomId, st.RowLabel, st.ColumnNumber })
                .IsUnique();
        }
    }
}
