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
    public async Task Handle_StripePayment_ShouldCreatePaymentAndReturnRedirectUrl()
    {
        // Arrange
        var command = new InitiatePaymentCommand(
            OrderId: 1234,
            UserId: 42,
            Amount: 180000m,
            Currency: "VND",
            PaymentMethod: PaymentMethod.STRIPE,
            CancelUrl: "https://app.cinema.com/checkout-canceled",
            SuccessUrl: "https://app.cinema.com/checkout-success");

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(1234, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        _paymentRepoMock
            .Setup(r => r.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        _txLogRepoMock
            .Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var expectedResult = new PaymentInitiationResult(true, "https://checkout.stripe.com/pay/cs_test_xxx", null);
        _gatewayMock.Setup(g => g.InitiateAsync(It.IsAny<PaymentRequest>())).ReturnsAsync(expectedResult);
        _gatewayFactoryMock.Setup(f => f.GetGateway(PaymentMethod.STRIPE)).Returns(_gatewayMock.Object);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("https://checkout.stripe.com/pay/cs_test_xxx", result.RedirectUrl);

        _paymentRepoMock.Verify(r => r.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()), Times.Once);
        _gatewayMock.Verify(g => g.InitiateAsync(It.IsAny<PaymentRequest>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    // ── Happy Path: PayPal ────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_PayPalPayment_ShouldCallGatewayAndReturnApprovalUrl()
    {
        // Arrange
        var command = new InitiatePaymentCommand(
            OrderId: 5678, UserId: 10, Amount: 90000m, Currency: "VND",
            PaymentMethod: PaymentMethod.PAYPAL,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        _paymentRepoMock.Setup(r => r.GetByOrderIdAsync(5678, It.IsAny<CancellationToken>())).ReturnsAsync((Payment?)null);
        _paymentRepoMock.Setup(r => r.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _txLogRepoMock.Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var paypalResult = new PaymentInitiationResult(true, "https://www.sandbox.paypal.com/checkoutnow?token=xxx", null);
        _gatewayMock.Setup(g => g.InitiateAsync(It.IsAny<PaymentRequest>())).ReturnsAsync(paypalResult);
        _gatewayFactoryMock.Setup(f => f.GetGateway(PaymentMethod.PAYPAL)).Returns(_gatewayMock.Object);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Contains("paypal.com", result.RedirectUrl);
        _gatewayFactoryMock.Verify(f => f.GetGateway(PaymentMethod.PAYPAL), Times.Once);
    }

    // ── Happy Path: Cash ──────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_CashPayment_ShouldNotCallGateway_AndReturnSuccessWithSuccessUrl()
    {
        // Arrange
        var command = new InitiatePaymentCommand(
            OrderId: 9999, UserId: 5, Amount: 60000m, Currency: "VND",
            PaymentMethod: PaymentMethod.CASH,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        _paymentRepoMock.Setup(r => r.GetByOrderIdAsync(9999, It.IsAny<CancellationToken>())).ReturnsAsync((Payment?)null);
        _paymentRepoMock.Setup(r => r.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _txLogRepoMock.Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        // Cash: gateway is NOT called
        _gatewayFactoryMock.Verify(f => f.GetGateway(It.IsAny<PaymentMethod>()), Times.Never);
    }

    // ── Duplicate Order Protection ────────────────────────────────────────────

    [Fact]
    public async Task Handle_DuplicateOrder_ShouldThrowInvalidPaymentStateException_WhenExistingPaymentIsNotFailed()
    {
        // Arrange
        var existingPayment = new Payment(1234, 42, 180000m, "VND", PaymentMethod.STRIPE);
        existingPayment.Complete("pi_existing", null);

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(1234, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingPayment);

        var command = new InitiatePaymentCommand(
            OrderId: 1234, UserId: 42, Amount: 180000m, Currency: "VND",
            PaymentMethod: PaymentMethod.STRIPE,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        // Act & Assert
        await Assert.ThrowsAsync<InvalidPaymentStateException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_FailedOrderRetry_ShouldCreateNewPayment_WhenExistingPaymentIsFailed()
    {
        // Arrange — a previously failed payment allows retry
        var failedPayment = new Payment(1234, 42, 180000m, "VND", PaymentMethod.STRIPE);
        failedPayment.Fail("card_declined");

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(1234, It.IsAny<CancellationToken>()))
            .ReturnsAsync(failedPayment);

        _paymentRepoMock.Setup(r => r.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _txLogRepoMock.Setup(t => t.AddAsync(It.IsAny<TransactionLog>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var expectedResult = new PaymentInitiationResult(true, "https://checkout.stripe.com/pay/new_session", null);
        _gatewayMock.Setup(g => g.InitiateAsync(It.IsAny<PaymentRequest>())).ReturnsAsync(expectedResult);
        _gatewayFactoryMock.Setup(f => f.GetGateway(PaymentMethod.STRIPE)).Returns(_gatewayMock.Object);

        var command = new InitiatePaymentCommand(
            OrderId: 1234, UserId: 42, Amount: 180000m, Currency: "VND",
            PaymentMethod: PaymentMethod.STRIPE,
            CancelUrl: "https://cancel.com",
            SuccessUrl: "https://success.com");

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        _paymentRepoMock.Verify(r => r.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
