using System.Threading;
using System.Threading.Tasks;
using MassTransit;
using Moq;
using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using PaymentService.Application.Features.Payments.Commands;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;
using PaymentService.Application.IntegrationEvents;

namespace PaymentService.Test.Unit.Features;

public class InitiatePaymentCommandHandlerTests
{
    private readonly Mock<IPaymentRepository> _paymentRepoMock;
    private readonly Mock<ITransactionLogRepository> _txLogRepoMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPaymentGatewayFactory> _gatewayFactoryMock;
    private readonly Mock<IPaymentGateway> _gatewayMock;
    private readonly Mock<IPublishEndpoint> _publishEndpointMock;
    private readonly InitiatePaymentCommandHandler _handler;

    public InitiatePaymentCommandHandlerTests()
    {
        _paymentRepoMock = new Mock<IPaymentRepository>();
        _txLogRepoMock = new Mock<ITransactionLogRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _gatewayFactoryMock = new Mock<IPaymentGatewayFactory>();
        _gatewayMock = new Mock<IPaymentGateway>();
        _publishEndpointMock = new Mock<IPublishEndpoint>();

        _handler = new InitiatePaymentCommandHandler(
            _paymentRepoMock.Object,
            _txLogRepoMock.Object,
            _unitOfWorkMock.Object,
            _gatewayFactoryMock.Object,
            _publishEndpointMock.Object);
    }

    // ── Happy Path: Stripe ────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_StripePayment_ShouldInitiatePaymentAndReturnRedirectUrl()
    {
        // Arrange
        var command = new InitiatePaymentCommand(
            OrderId: 1234,
            UserId: 42,
            PaymentMethod: PaymentMethod.STRIPE,
            CancelUrl: "https://app.cinema.com/checkout-canceled",
            SuccessUrl: "https://app.cinema.com/checkout-success");

        var payment = new Payment(1234, 42, 180000m, "VND");

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(1234, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _txLogRepoMock
            .Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var expectedResult = new PaymentInitiationResult(true, "https://checkout.stripe.com/pay/cs_test_xxx", null, "cs_test_xxx");
        _gatewayMock.Setup(g => g.InitiateAsync(It.IsAny<PaymentRequest>())).ReturnsAsync(expectedResult);
        _gatewayFactoryMock.Setup(f => f.GetGateway(PaymentMethod.STRIPE)).Returns(_gatewayMock.Object);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("https://checkout.stripe.com/pay/cs_test_xxx", result.RedirectUrl);
        Assert.Equal(PaymentStatus.PENDING, payment.Status);
        Assert.Equal("cs_test_xxx", payment.GatewaySessionId);

        _gatewayMock.Verify(g => g.InitiateAsync(It.IsAny<PaymentRequest>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ── Happy Path: PayPal ────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_PayPalPayment_ShouldCallGatewayAndReturnApprovalUrl()
    {
        // Arrange
        var command = new InitiatePaymentCommand(
            OrderId: 5678, UserId: 10,
            PaymentMethod: PaymentMethod.PAYPAL,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        var payment = new Payment(5678, 10, 90000m, "VND");

        _paymentRepoMock.Setup(r => r.GetByOrderIdAsync(5678, It.IsAny<CancellationToken>())).ReturnsAsync(payment);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _txLogRepoMock.Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var paypalResult = new PaymentInitiationResult(true, "https://www.sandbox.paypal.com/checkoutnow?token=xxx", null, "token_xxx");
        _gatewayMock.Setup(g => g.InitiateAsync(It.IsAny<PaymentRequest>())).ReturnsAsync(paypalResult);
        _gatewayFactoryMock.Setup(f => f.GetGateway(PaymentMethod.PAYPAL)).Returns(_gatewayMock.Object);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Contains("paypal.com", result.RedirectUrl);
        Assert.Equal(PaymentStatus.PENDING, payment.Status);
        _gatewayFactoryMock.Verify(f => f.GetGateway(PaymentMethod.PAYPAL), Times.Once);
    }

    // ── Happy Path: Cash ──────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_CashPayment_WhenStaff_ShouldSettleImmediatelyAndReturnCompleted()
    {
        // Arrange
        var command = new InitiatePaymentCommand(
            OrderId: 9999, UserId: 5,
            PaymentMethod: PaymentMethod.CASH,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com",
            IsStaffOrAdmin: true);

        var payment = new Payment(9999, 5, 60000m, "VND");

        _paymentRepoMock.Setup(r => r.GetByOrderIdAsync(9999, It.IsAny<CancellationToken>())).ReturnsAsync(payment);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _txLogRepoMock.Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("https://success.com", result.RedirectUrl);
        Assert.Equal(PaymentStatus.COMPLETED, payment.Status);
        Assert.Equal(PaymentMethod.CASH, payment.PaymentMethod);
        Assert.NotNull(result.GatewaySessionId);
        Assert.StartsWith("CASH-9999-", result.GatewaySessionId);
        _gatewayFactoryMock.Verify(f => f.GetGateway(It.IsAny<PaymentMethod>()), Times.Never);
        _publishEndpointMock.Verify(p => p.Publish(It.IsAny<PaymentInitiated>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_CashPayment_WhenNotStaffOrAdmin_ShouldThrowForbiddenAccessException()
    {
        // Arrange
        var command = new InitiatePaymentCommand(
            OrderId: 9999, UserId: 5,
            PaymentMethod: PaymentMethod.CASH,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com",
            IsStaffOrAdmin: false);

        // Act & Assert
        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_CashPayment_WhenStaffForDifferentUser_ShouldSucceed()
    {
        // Arrange - order belongs to walk-in user (0) or customer (100), but cashier is user 5
        var command = new InitiatePaymentCommand(
            OrderId: 9999, UserId: 5,
            PaymentMethod: PaymentMethod.CASH,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com",
            IsStaffOrAdmin: true);

        var payment = new Payment(9999, 0, 60000m, "VND");

        _paymentRepoMock.Setup(r => r.GetByOrderIdAsync(9999, It.IsAny<CancellationToken>())).ReturnsAsync(payment);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _txLogRepoMock.Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(PaymentStatus.COMPLETED, payment.Status);
        Assert.NotNull(result.GatewaySessionId);
        Assert.StartsWith("CASH-9999-", result.GatewaySessionId);
    }

    // ── Ownership Protection ──────────────────────────────────────────────────

    [Fact]
    public async Task Handle_UnauthorizedUser_ShouldThrowUnauthorizedAccessException()
    {
        // Arrange
        var payment = new Payment(1234, 999, 180000m, "VND");
        _paymentRepoMock.Setup(r => r.GetByOrderIdAsync(1234, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var command = new InitiatePaymentCommand(
            OrderId: 1234, UserId: 42,
            PaymentMethod: PaymentMethod.STRIPE,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    // ── Expired Order Protection ──────────────────────────────────────────────

    [Fact]
    public async Task Handle_ExpiredOrder_ShouldThrowInvalidPaymentStateException()
    {
        // Arrange
        var existingPayment = new Payment(1234, 42, 180000m, "VND");
        existingPayment.Expire();

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(1234, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingPayment);

        var command = new InitiatePaymentCommand(
            OrderId: 1234, UserId: 42,
            PaymentMethod: PaymentMethod.STRIPE,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        // Act & Assert
        await Assert.ThrowsAsync<InvalidPaymentStateException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    // ── Pending Order Idempotent Retry ────────────────────────────────────────

    [Fact]
    public async Task Handle_PendingOrderRetry_ShouldReturnExistingSessionUrl()
    {
        // Arrange
        var pendingPayment = new Payment(1234, 42, 180000m, "VND");
        pendingPayment.Initiate(PaymentMethod.STRIPE, "sess_existing_123");

        _paymentRepoMock.Setup(r => r.GetByOrderIdAsync(1234, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pendingPayment);

        _gatewayMock.Setup(g => g.GetExistingSessionUrlAsync("sess_existing_123", It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://checkout.stripe.com/pay/sess_existing_123");
        _gatewayFactoryMock.Setup(f => f.GetGateway(PaymentMethod.STRIPE)).Returns(_gatewayMock.Object);

        var command = new InitiatePaymentCommand(
            OrderId: 1234, UserId: 42,
            PaymentMethod: PaymentMethod.STRIPE,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("https://checkout.stripe.com/pay/sess_existing_123", result.RedirectUrl);
        _gatewayMock.Verify(g => g.GetExistingSessionUrlAsync("sess_existing_123", It.IsAny<CancellationToken>()), Times.Once);
        _gatewayMock.Verify(g => g.InitiateAsync(It.IsAny<PaymentRequest>()), Times.Never);
    }

    // ── Failed Order Retry ────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_FailedOrderRetry_ShouldReinitiate_WhenExistingPaymentIsFailed()
    {
        // Arrange — a previously failed payment allows retry
        var failedPayment = new Payment(1234, 42, 180000m, "VND");
        failedPayment.Initiate(PaymentMethod.STRIPE, "old_session");
        failedPayment.Fail("card_declined");

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(1234, It.IsAny<CancellationToken>()))
            .ReturnsAsync(failedPayment);

        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _txLogRepoMock.Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var expectedResult = new PaymentInitiationResult(true, "https://checkout.stripe.com/pay/new_session", null, "new_session");
        _gatewayMock.Setup(g => g.InitiateAsync(It.IsAny<PaymentRequest>())).ReturnsAsync(expectedResult);
        _gatewayFactoryMock.Setup(f => f.GetGateway(PaymentMethod.STRIPE)).Returns(_gatewayMock.Object);

        var command = new InitiatePaymentCommand(
            OrderId: 1234, UserId: 42,
            PaymentMethod: PaymentMethod.STRIPE,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(PaymentStatus.PENDING, failedPayment.Status);
        Assert.Equal("new_session", failedPayment.GatewaySessionId);
    }
}
