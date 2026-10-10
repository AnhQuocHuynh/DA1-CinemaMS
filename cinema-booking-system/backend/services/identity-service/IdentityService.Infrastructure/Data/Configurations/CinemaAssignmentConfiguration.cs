using IdentityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IdentityService.Infrastructure.Data.Configurations;

public class CinemaAssignmentConfiguration : IEntityTypeConfiguration<CinemaAssignment>
{
    public void Configure(EntityTypeBuilder<CinemaAssignment> builder)
    {
        builder.ToTable("cinema_assignments");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id").UseIdentityAlwaysColumn();
        builder.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(x => x.CinemaId).HasColumnName("cinema_id").IsRequired();
        builder.Property(x => x.Duty)
            .HasColumnName("duty")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.HasIndex(x => new { x.UserId, x.CinemaId }).IsUnique();
        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
