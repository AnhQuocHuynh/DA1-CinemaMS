using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Messages;
using NotificationService.Domain.Enums;
using NotificationService.Infrastructure.Messaging;
using NotificationService.Infrastructure.Messaging.Consumers;
using Xunit;

namespace NotificationService.Test.Unit.Infrastructure.Messaging.Consumers;

public class ReviewCreatedEventConsumerTests
{
    private readonly Mock<IRabbitMqConnectionProvider> _connectionProviderMock;
    private readonly Mock<ILogger<ReviewCreatedEventConsumer>> _loggerMock;
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock;
    private readonly Mock<IServiceScope> _scopeMock;
    private readonly Mock<IServiceProvider> _serviceProviderMock;
    private readonly Mock<IMediator> _mediatorMock;
    private readonly ReviewCreatedEventConsumer _consumer;

    public ReviewCreatedEventConsumerTests()
    {
        _connectionProviderMock = new Mock<IRabbitMqConnectionProvider>();
        _loggerMock = new Mock<ILogger<ReviewCreatedEventConsumer>>();
        _scopeFactoryMock = new Mock<IServiceScopeFactory>();
        _scopeMock = new Mock<IServiceScope>();
        _serviceProviderMock = new Mock<IServiceProvider>();
        _mediatorMock = new Mock<IMediator>();

        _scopeFactoryMock.Setup(s => s.CreateScope()).Returns(_scopeMock.Object);
        _scopeMock.Setup(s => s.ServiceProvider).Returns(_serviceProviderMock.Object);
        _serviceProviderMock.Setup(sp => sp.GetService(typeof(IMediator))).Returns(_mediatorMock.Object);

        _consumer = new ReviewCreatedEventConsumer(
            _connectionProviderMock.Object,
            _loggerMock.Object,
            _scopeFactoryMock.Object);
    }

    [Fact]
    public async Task ProcessMessageAsync_WhenStatusIsVisible_ShouldDispatchPublishedNotificationOutOfFive()
    {
        // Arrange
        var envelope = CreateEnvelope(rating: 5, status: "VISIBLE");

        // Act
        await _consumer.ProcessMessageAsync(envelope, CancellationToken.None);

        // Assert
        _mediatorMock.Verify(m => m.Send(
            It.Is<SendNotificationCommand>(cmd =>
                cmd.UserId == 42L &&
                cmd.Channel == NotificationChannel.PUSH &&
                cmd.Type == NotificationType.REVIEW_MODERATION &&
                cmd.Title == "Review Published" &&
                cmd.Body == "Your review (rating: 5/5) has been published." &&
                (long)cmd.Metadata["reviewId"] == 101L &&
                (long)cmd.Metadata["movieId"] == 10L &&
                (int)cmd.Metadata["rating"] == 5 &&
                (string)cmd.Metadata["status"] == "VISIBLE"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessMessageAsync_WhenStatusIsHidden_ShouldDispatchModerationNotificationOutOfFive()
    {
        // Arrange
        var envelope = CreateEnvelope(rating: 4, status: "HIDDEN");

        // Act
        await _consumer.ProcessMessageAsync(envelope, CancellationToken.None);

        // Assert
        _mediatorMock.Verify(m => m.Send(
            It.Is<SendNotificationCommand>(cmd =>
                cmd.UserId == 42L &&
                cmd.Channel == NotificationChannel.PUSH &&
                cmd.Type == NotificationType.REVIEW_MODERATION &&
                cmd.Title == "Review Submitted" &&
                cmd.Body == "Your review (rating: 4/5) has been submitted and is under moderation."),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private static EventEnvelope<ReviewCreatedPayload> CreateEnvelope(int? rating, string? status)
    {
        var payload = new ReviewCreatedPayload(
            ReviewId: 101L,
            UserId: 42L,
            MovieId: 10L,
            EventId: null,
            Rating: rating,
            Status: status,
            CreatedAt: DateTime.UtcNow);

        return new EventEnvelope<ReviewCreatedPayload>
        {
            EventId = Guid.NewGuid(),
            EventType = "review.created",
            Source = "booking-service",
            OccurredAt = DateTime.UtcNow,
            SchemaVersion = 1,
            Payload = payload
        };
    }
}
