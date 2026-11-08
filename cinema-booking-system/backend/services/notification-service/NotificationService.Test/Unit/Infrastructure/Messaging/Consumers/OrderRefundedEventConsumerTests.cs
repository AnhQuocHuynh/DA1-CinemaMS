using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using NotificationService.Application.Contracts;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Messages;
using NotificationService.Domain.Enums;
using NotificationService.Infrastructure.Messaging;
using NotificationService.Infrastructure.Messaging.Consumers;
using Xunit;

namespace NotificationService.Test.Unit.Infrastructure.Messaging.Consumers;

public class OrderRefundedEventConsumerTests
{
    private readonly Mock<IRabbitMqConnectionProvider> _connectionProviderMock;
    private readonly Mock<ILogger<OrderRefundedEventConsumer>> _loggerMock;
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock;
    private readonly Mock<IServiceScope> _scopeMock;
    private readonly Mock<IServiceProvider> _serviceProviderMock;
    private readonly Mock<IDashboardBroadcaster> _broadcasterMock;
    private readonly Mock<IMediator> _mediatorMock;
    private readonly OrderRefundedEventConsumer _consumer;

    public OrderRefundedEventConsumerTests()
    {
        _connectionProviderMock = new Mock<IRabbitMqConnectionProvider>();
        _loggerMock = new Mock<ILogger<OrderRefundedEventConsumer>>();
        _scopeFactoryMock = new Mock<IServiceScopeFactory>();
        _scopeMock = new Mock<IServiceScope>();
        _serviceProviderMock = new Mock<IServiceProvider>();
        _broadcasterMock = new Mock<IDashboardBroadcaster>();
        _mediatorMock = new Mock<IMediator>();

        _scopeFactoryMock.Setup(s => s.CreateScope()).Returns(_scopeMock.Object);
        _scopeMock.Setup(s => s.ServiceProvider).Returns(_serviceProviderMock.Object);
        _serviceProviderMock.Setup(sp => sp.GetService(typeof(IDashboardBroadcaster))).Returns(_broadcasterMock.Object);
        _serviceProviderMock.Setup(sp => sp.GetService(typeof(IMediator))).Returns(_mediatorMock.Object);

        _consumer = new OrderRefundedEventConsumer(
            _connectionProviderMock.Object,
            _loggerMock.Object,
            _scopeFactoryMock.Object);
    }

    [Fact]
    public async Task ProcessMessageAsync_ShouldDispatchDualChannelRefundNotifications()
    {
        // Arrange
        var payload = new OrderRefundedPayload(
            OrderId: 202L,
            UserId: 55L,
            ShowtimeId: 600L,
            FinalAmount: 150000m,
            TicketCount: 2);

        var envelope = new EventEnvelope<OrderRefundedPayload>
        {
            EventId = Guid.NewGuid(),
            EventType = "order.refunded",
            Source = "booking-service",
            OccurredAt = DateTime.UtcNow,
            SchemaVersion = 1,
            Payload = payload
        };

        // Act
        await _consumer.ProcessMessageAsync(envelope, CancellationToken.None);

        // Assert
        _broadcasterMock.Verify(b => b.BroadcastRefundUpdateAsync(It.IsAny<object>()), Times.Once);

        // Verify Email command dispatched with ORDER_REFUNDED
        _mediatorMock.Verify(m => m.Send(
            It.Is<SendNotificationCommand>(cmd =>
                cmd.UserId == 55L &&
                cmd.Channel == NotificationChannel.EMAIL &&
                cmd.Type == NotificationType.ORDER_REFUNDED),
            It.IsAny<CancellationToken>()), Times.Once);

        // Verify Real-time Push command dispatched with ORDER_REFUNDED
        _mediatorMock.Verify(m => m.Send(
            It.Is<SendNotificationCommand>(cmd =>
                cmd.UserId == 55L &&
                cmd.Channel == NotificationChannel.PUSH &&
                cmd.Type == NotificationType.ORDER_REFUNDED &&
                cmd.Metadata.ContainsKey("actionType") &&
                (string)cmd.Metadata["actionType"] == "ORDER_REFUNDED"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
