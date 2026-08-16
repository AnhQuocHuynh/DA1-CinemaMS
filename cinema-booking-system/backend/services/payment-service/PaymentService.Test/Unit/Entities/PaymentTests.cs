using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;

namespace PaymentService.Test.Unit.Entities;

public class PaymentTests
{
    // ── Constructor ────────────────────────────────────────────────────────────

    [Fact]
    public void Constructor_ShouldCreatePendingPayment_WithCorrectProperties()
    {
        // Arrange & Act
        var payment = new Payment(orderId: 1, userId: 42, amount: 180000m, currency: "VND", paymentMethod: PaymentMethod.STRIPE);

        // Assert
        Assert.Equal(1, payment.OrderId);
        Assert.Equal(42, payment.UserId);
        Assert.Equal(180000m, payment.Amount);
        Assert.Equal("VND", payment.Currency);
        Assert.Equal(PaymentMethod.STRIPE, payment.PaymentMethod);
        Assert.Equal(PaymentStatus.PENDING, payment.Status);
        Assert.Null(payment.TransactionId);
        Assert.Null(payment.PaidAt);
        Assert.Empty(payment.Refunds);
    }

    // ── Complete ───────────────────────────────────────────────────────────────

    [Fact]
    public void Complete_ShouldSetStatusToCompleted_WhenPaymentIsPending()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);

        // Act
        payment.Complete("pi_test123", "{\"status\":\"succeeded\"}");

        // Assert
        Assert.Equal(PaymentStatus.COMPLETED, payment.Status);
        Assert.Equal("pi_test123", payment.TransactionId);
        Assert.NotNull(payment.PaidAt);
        Assert.NotNull(payment.UpdatedAt);
    }

    [Fact]
    public void Complete_ShouldBeIdempotent_WhenCalledTwice()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_test123", null);

        // Act — should not throw
        var exception = Record.Exception(() => payment.Complete("pi_test456", null));

        // Assert
        Assert.Null(exception);
        Assert.Equal("pi_test123", payment.TransactionId); // Original ID preserved
    }

    [Fact]
    public void Complete_ShouldThrow_WhenPaymentIsAlreadyFailed()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Fail("card_declined");

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => payment.Complete("pi_test", null));
    }

    // ── Fail ──────────────────────────────────────────────────────────────────

    [Fact]
    public void Fail_ShouldSetStatusToFailed_WhenPaymentIsPending()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);

        // Act
        payment.Fail("card_declined");

        // Assert
        Assert.Equal(PaymentStatus.FAILED, payment.Status);
        Assert.Equal("card_declined", payment.GatewayResponse);
        Assert.NotNull(payment.UpdatedAt);
    }

    [Fact]
    public void Fail_ShouldThrow_WhenPaymentIsNotPending()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_test", null);

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => payment.Fail("some_error"));
    }

    // ── AddRefund ─────────────────────────────────────────────────────────────

    [Fact]
    public void AddRefund_ShouldAddRefundToCollection_WhenPaymentIsCompleted()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_test", null);

        // Act
        var refund = payment.AddRefund(90000m, "User requested partial refund");

        // Assert
        Assert.Single(payment.Refunds);
        Assert.Equal(90000m, refund.Amount);
        Assert.Equal("User requested partial refund", refund.Reason);
        Assert.Equal(RefundStatus.PENDING, refund.Status);
    }

    [Fact]
    public void AddRefund_ShouldThrow_WhenPaymentIsNotCompleted()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => payment.AddRefund(90000m, "reason"));
    }

    [Fact]
    public void AddRefund_ShouldThrow_WhenRefundExceedsPaymentAmount()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_test", null);

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => payment.AddRefund(200000m, "too much"));
    }

    // ── MarkAsRefunded ────────────────────────────────────────────────────────

    [Fact]
    public void MarkAsRefunded_ShouldSetStatusToRefunded_WhenFullAmountRefunded()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_test", null);
        var refund = payment.AddRefund(180000m, "Full refund");
        refund.Approve();
        refund.Process();

        // Act
        payment.MarkAsRefunded();

        // Assert
        Assert.Equal(PaymentStatus.REFUNDED, payment.Status);
    }

    [Fact]
    public void MarkAsRefunded_ShouldSetStatusToPartiallyRefunded_WhenPartialAmountRefunded()
    {
        // Arrange
        var payment = new Payment(1, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_test", null);
        var refund = payment.AddRefund(90000m, "Partial refund");
        refund.Approve();
        refund.Process();

        // Act
        payment.MarkAsRefunded();

        // Assert
        Assert.Equal(PaymentStatus.PARTIALLY_REFUNDED, payment.Status);
    }

    // ── CASH payment ──────────────────────────────────────────────────────────

    [Fact]
    public void Constructor_ShouldCreateCashPayment_WithCashMethod()
    {
        // Arrange & Act
        var payment = new Payment(10, 7, 150000m, "VND", PaymentMethod.CASH);

        // Assert
        Assert.Equal(PaymentMethod.CASH, payment.PaymentMethod);
        Assert.Equal(PaymentStatus.PENDING, payment.Status);
    }
}
