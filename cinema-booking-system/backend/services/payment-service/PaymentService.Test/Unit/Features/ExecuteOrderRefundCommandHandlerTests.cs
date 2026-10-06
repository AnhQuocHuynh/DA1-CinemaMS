using System;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using PaymentService.Application.Contracts;
using PaymentService.Application.Exceptions;
using PaymentService.Application.Features.Refunds.Commands;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;
using Xunit;

namespace PaymentService.Test.Unit.Features;

public class ExecuteOrderRefundCommandHandlerTests
{
    private readonly Mock<IPaymentRepository> _paymentRepoMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPaymentGatewayFactory> _gatewayFactoryMock;
    private readonly Mock<IPaymentGateway> _gatewayMock;
    private readonly ExecuteOrderRefundCommandHandler _handler;

    public ExecuteOrderRefundCommandHandlerTests()
    {
        _paymentRepoMock = new Mock<IPaymentRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _gatewayFactoryMock = new Mock<IPaymentGatewayFactory>();
        _gatewayMock = new Mock<IPaymentGateway>();

        _gatewayFactoryMock
            .Setup(f => f.GetGateway(It.IsAny<PaymentMethod>()))
            .Returns(_gatewayMock.Object);

        _handler = new ExecuteOrderRefundCommandHandler(
            _paymentRepoMock.Object,
            _unitOfWorkMock.Object,
            _gatewayFactoryMock.Object);
    }

    [Fact]
    public async Task Handle_PaymentNotFound_ShouldThrowPaymentNotFoundException()
    {
        // Arrange
        var command = new ExecuteOrderRefundCommand(100, 150000m, "Customer cancelled");
        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(100, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        // Act & Assert
        await Assert.ThrowsAsync<PaymentNotFoundException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_InvalidPaymentStatus_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var command = new ExecuteOrderRefundCommand(100, 150000m, "Customer cancelled");
        var payment = new Payment(100, 42, 150000m, "VND", PaymentMethod.STRIPE);
        // Status is PENDING by default

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(100, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_StripePayment_GatewaySuccess_ShouldMarkRefundedAndSave()
    {
        // Arrange
        var command = new ExecuteOrderRefundCommand(100, 150000m, "Customer cancelled");
        var payment = new Payment(100, 42, 150000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_stripe_123", "{}");

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(100, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var refundResult = new RefundResult(true, null);
        _gatewayMock
            .Setup(g => g.RefundAsync("pi_stripe_123", 150000m, "VND"))
            .ReturnsAsync(refundResult);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(150000m, result.Amount);
        Assert.Equal(RefundStatus.PROCESSED, result.Status);
        Assert.Equal(PaymentStatus.REFUNDED, payment.Status);

        _gatewayMock.Verify(g => g.RefundAsync("pi_stripe_123", 150000m, "VND"), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_CashPayment_ShouldNotCallGatewayAndMarkRefunded()
    {
        // Arrange
        var command = new ExecuteOrderRefundCommand(200, 90000m, "Customer cancelled cash order");
        var payment = new Payment(200, 42, 90000m, "VND", PaymentMethod.CASH);
        payment.Complete("CASH_REF", "{}");

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(200, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(90000m, result.Amount);
        Assert.Equal(RefundStatus.PROCESSED, result.Status);
        Assert.Equal(PaymentStatus.REFUNDED, payment.Status);

        _gatewayMock.Verify(g => g.RefundAsync(It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<string>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_GatewayRefundFails_ShouldThrowPaymentGatewayException()
    {
        // Arrange
        var command = new ExecuteOrderRefundCommand(300, 120000m, "Customer cancelled");
        var payment = new Payment(300, 42, 120000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_stripe_fail", "{}");

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(300, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var failResult = new RefundResult(false, "Card declined or insufficient balance");
        _gatewayMock
            .Setup(g => g.RefundAsync("pi_stripe_fail", 120000m, "VND"))
            .ReturnsAsync(failResult);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<PaymentGatewayException>(() =>
            _handler.Handle(command, CancellationToken.None));

        Assert.Contains("Gateway refund failed", ex.Message);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
