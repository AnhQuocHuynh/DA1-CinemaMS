using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PaymentService.Domain.Entities;

namespace PaymentService.Infrastructure.Data.Configurations;

public class RefundConfiguration : IEntityTypeConfiguration<Refund>
{
    public void Configure(EntityTypeBuilder<Refund> builder)
    {
        builder.ToTable("refunds");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(r => r.PaymentId)
            .HasColumnName("payment_id")
            .IsRequired();

        builder.Property(r => r.Amount)
            .HasColumnName("amount")
            .HasColumnType("decimal(15,2)")
            .IsRequired();

        builder.Property(r => r.Reason)
            .HasColumnName("reason")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(r => r.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired()
            .HasDefaultValue(Domain.Enums.RefundStatus.PENDING);

        builder.Property(r => r.ProcessedAt)
            .HasColumnName("processed_at");

        builder.Property(r => r.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");
    }
}
