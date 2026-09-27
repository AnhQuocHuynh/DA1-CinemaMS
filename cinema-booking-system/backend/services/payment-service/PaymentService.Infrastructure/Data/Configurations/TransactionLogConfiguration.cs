using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PaymentService.Domain.Entities;

namespace PaymentService.Infrastructure.Data.Configurations;

public class TransactionLogConfiguration : IEntityTypeConfiguration<TransactionLog>
{
    public void Configure(EntityTypeBuilder<TransactionLog> builder)
    {
        builder.ToTable("transaction_logs");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(t => t.PaymentId)
            .HasColumnName("payment_id")
            .IsRequired();

        builder.Property(t => t.Action)
            .HasColumnName("action")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(t => t.Request)
            .HasColumnName("request")
            .HasColumnType("text");

        builder.Property(t => t.Response)
            .HasColumnName("response")
            .HasColumnType("text");

        builder.Property(t => t.StatusCode)
            .HasColumnName("status_code");

        builder.Property(t => t.Timestamp)
            .HasColumnName("timestamp")
            .IsRequired()
            .HasDefaultValueSql("NOW()");

        builder.HasOne<Payment>()
            .WithMany()
            .HasForeignKey(t => t.PaymentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
