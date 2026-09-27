using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PaymentService.Domain.Entities;

namespace PaymentService.Infrastructure.Data.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(p => p.SagaId)
            .HasColumnName("saga_id")
            .IsRequired();

        // Index for saga correlation lookups
        builder.HasIndex(p => p.SagaId)
            .IsUnique()
            .HasDatabaseName("idx_payments_saga_id");

        builder.Property(p => p.OrderId)
            .HasColumnName("order_id")
            .IsRequired();

        builder.Property(p => p.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(p => p.TransactionId)
            .HasColumnName("transaction_id")
            .HasMaxLength(255);

        builder.HasIndex(p => p.TransactionId)
            .IsUnique()
            .HasFilter("transaction_id IS NOT NULL"); // Partial unique index allows multiple NULLs

        builder.Property(p => p.Amount)
            .HasColumnName("amount")
            .HasColumnType("decimal(15,2)")
            .IsRequired();

        builder.Property(p => p.Currency)
            .HasColumnName("currency")
            .HasMaxLength(10)
            .IsRequired()
            .HasDefaultValue("VND");

        builder.Property(p => p.PaymentMethod)
            .HasColumnName("payment_method")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(p => p.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired()
            .HasDefaultValue(Domain.Enums.PaymentStatus.PENDING);

        builder.Property(p => p.GatewayResponse)
            .HasColumnName("gateway_response")
            .HasColumnType("text");

        builder.Property(p => p.PaidAt)
            .HasColumnName("paid_at");

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        builder.Property(p => p.UpdatedAt)
            .HasColumnName("updated_at");

        // Relationships
        builder.HasMany(p => p.Refunds)
            .WithOne()
            .HasForeignKey(r => r.PaymentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        builder.HasIndex(p => p.OrderId).HasDatabaseName("idx_payments_order_id");
        builder.HasIndex(p => p.UserId).HasDatabaseName("idx_payments_user_id");
        builder.HasIndex(p => p.Status).HasDatabaseName("idx_payments_status");
    }
}
