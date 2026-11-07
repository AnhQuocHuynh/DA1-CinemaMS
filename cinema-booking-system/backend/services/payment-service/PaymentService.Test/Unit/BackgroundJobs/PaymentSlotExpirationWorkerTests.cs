using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MassTransit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Interfaces;
using PaymentService.Infrastructure.BackgroundJobs;
using Xunit;

namespace PaymentService.Test.Unit.BackgroundJobs;

public class PaymentSlotExpirationWorkerTests
{
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock;
    private readonly Mock<IServiceScope> _scopeMock;
    private readonly Mock<IServiceProvider> _serviceProviderMock;
    private readonly Mock<IPaymentRepository> _paymentRepositoryMock;
    private readonly Mock<IPublishEndpoint> _publishEndpointMock;
    private readonly Mock<ILogger<PaymentSlotExpirationWorker>> _loggerMock;
    private readonly IConfiguration _configuration;

    public PaymentSlotExpirationWorkerTests()
    {
        _scopeFactoryMock = new Mock<IServiceScopeFactory>();
        _scopeMock = new Mock<IServiceScope>();
        _serviceProviderMock = new Mock<IServiceProvider>();
        _paymentRepositoryMock = new Mock<IPaymentRepository>();
        _publishEndpointMock = new Mock<IPublishEndpoint>();
        _loggerMock = new Mock<ILogger<PaymentSlotExpirationWorker>>();

        _scopeFactoryMock.Setup(f => f.CreateScope()).Returns(_scopeMock.Object);
        _scopeMock.Setup(s => s.ServiceProvider).Returns(_serviceProviderMock.Object);

        _serviceProviderMock
            .Setup(p => p.GetService(typeof(IPaymentRepository)))
            .Returns(_paymentRepositoryMock.Object);

        _serviceProviderMock
            .Setup(p => p.GetService(typeof(IPublishEndpoint)))
            .Returns(_publishEndpointMock.Object);

        var configValues = new Dictionary<string, string?>
        {
            { "Payment:ExpirationCheckIntervalSeconds", "30" },
            { "Payment:SlotTimeoutMinutes", "15" }
        };
        _configuration = new ConfigurationBuilder().AddInMemoryCollection(configValues).Build();
    }

    [Fact]
    public async Task ProcessExpiredSlotsAsync_WhenNoExpiredSlots_ShouldNotPublish()
    {
        // Arrange
        _paymentRepositoryMock
            .Setup(r => r.ClaimExpiredPaymentsAsync(It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<(long Id, Guid SagaId)>());

        var worker = new PaymentSlotExpirationWorker(_scopeFactoryMock.Object, _loggerMock.Object, _configuration);

        // Act
        var processedCount = await worker.ProcessExpiredSlotsAsync(CancellationToken.None);

        // Assert
        processedCount.Should().Be(0);
        _publishEndpointMock.Verify(
            p => p.Publish(It.IsAny<PaymentSlotExpired>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ProcessExpiredSlotsAsync_WhenExpiredSlotsClaimed_ShouldPublishEventForEachSlot()
    {
        // Arrange
        var saga1 = Guid.NewGuid();
        var saga2 = Guid.NewGuid();
        var claimedSlots = new List<(long Id, Guid SagaId)>
        {
            (101L, saga1),
            (102L, saga2)
        };

        _paymentRepositoryMock
            .Setup(r => r.ClaimExpiredPaymentsAsync(It.IsAny<DateTime>(), 50, It.IsAny<CancellationToken>()))
            .ReturnsAsync(claimedSlots);

        var worker = new PaymentSlotExpirationWorker(_scopeFactoryMock.Object, _loggerMock.Object, _configuration);

        // Act
        var processedCount = await worker.ProcessExpiredSlotsAsync(CancellationToken.None);

        // Assert
        processedCount.Should().Be(2);

        _publishEndpointMock.Verify(
            p => p.Publish(
                It.Is<PaymentSlotExpired>(e => e.CorrelationId == saga1),
                It.IsAny<CancellationToken>()),
            Times.Once);

        _publishEndpointMock.Verify(
            p => p.Publish(
                It.Is<PaymentSlotExpired>(e => e.CorrelationId == saga2),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ProcessExpiredSlotsAsync_ShouldUseCutoff15MinutesAgo()
    {
        // Arrange
        DateTime capturedCutoff = DateTime.MinValue;

        _paymentRepositoryMock
            .Setup(r => r.ClaimExpiredPaymentsAsync(It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Callback<DateTime, int, CancellationToken>((cutoff, _, _) => capturedCutoff = cutoff)
            .ReturnsAsync(new List<(long Id, Guid SagaId)>());

        var worker = new PaymentSlotExpirationWorker(_scopeFactoryMock.Object, _loggerMock.Object, _configuration);

        // Act
        var beforeCall = DateTime.UtcNow;
        await worker.ProcessExpiredSlotsAsync(CancellationToken.None);
        var afterCall = DateTime.UtcNow;

        // Assert — captured cutoff should be within [beforeCall - 15m, afterCall - 15m]
        capturedCutoff.Should().BeOnOrAfter(beforeCall.AddMinutes(-15).AddSeconds(-1));
        capturedCutoff.Should().BeOnOrBefore(afterCall.AddMinutes(-15).AddSeconds(1));
    }
}
