using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PaymentService.Infrastructure.Sagas;

namespace PaymentService.Infrastructure.Data.Configurations;

public class PaymentSagaStateConfiguration : IEntityTypeConfiguration<PaymentSagaState>
{
    public void Configure(EntityTypeBuilder<PaymentSagaState> builder)
    {
        builder.ToTable("payment_saga_states");

        builder.HasKey(s => s.CorrelationId);

        builder.Property(s => s.CorrelationId)
            .HasColumnName("correlation_id");

        builder.Property(s => s.CurrentState)
            .HasColumnName("current_state")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(s => s.Version)
            .HasColumnName("version")
            .IsConcurrencyToken();  // Optimistic concurrency for EF Core saga repository

        builder.Property(s => s.PaymentId).HasColumnName("payment_id");
        builder.Property(s => s.OrderId).HasColumnName("order_id");
        builder.Property(s => s.UserId).HasColumnName("user_id");
        builder.Property(s => s.Amount).HasColumnName("amount").HasColumnType("decimal(15,2)");
        builder.Property(s => s.Currency).HasColumnName("currency").HasMaxLength(10);
        builder.Property(s => s.PaymentMethod).HasColumnName("payment_method").HasMaxLength(30);
        builder.Property(s => s.TransactionId).HasColumnName("transaction_id").HasMaxLength(255);
        builder.Property(s => s.FailureReason).HasColumnName("failure_reason").HasColumnType("text");
        builder.Property(s => s.CreatedAt).HasColumnName("created_at");
        builder.Property(s => s.CompletedAt).HasColumnName("completed_at");

        // Fast lookup by payment ID for callback routing
        builder.HasIndex(s => s.PaymentId).HasDatabaseName("idx_saga_payment_id");
        builder.HasIndex(s => s.OrderId).HasDatabaseName("idx_saga_order_id");
        builder.HasIndex(s => s.CurrentState).HasDatabaseName("idx_saga_state");
    }
}
