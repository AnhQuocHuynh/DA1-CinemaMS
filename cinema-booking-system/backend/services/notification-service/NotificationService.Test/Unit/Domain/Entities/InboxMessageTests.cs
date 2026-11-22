using System;
using FluentAssertions;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using Xunit;

namespace NotificationService.Test.Domain.Entities;

public class InboxMessageTests
{
    [Fact]
    public void Constructor_ShouldInitializeInboxMessage_WhenParametersAreValid()
    {
        // Arrange
        var messageId = Guid.NewGuid().ToString();
        var consumerName = "TestConsumer";
        var eventType = "OrderPaid";

        // Act
        var inboxMessage = new InboxMessage(messageId, consumerName, eventType);

        // Assert
        inboxMessage.Id.Should().NotBeNullOrWhiteSpace();
        inboxMessage.MessageId.Should().Be(messageId);
        inboxMessage.ConsumerName.Should().Be(consumerName);
        inboxMessage.EventType.Should().Be(eventType);
        inboxMessage.Status.Should().Be(InboxStatus.Processing);
        inboxMessage.ReceivedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
        inboxMessage.ProcessedAt.Should().BeNull();
        inboxMessage.ErrorMessage.Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Constructor_ShouldThrowArgumentException_WhenMessageIdIsInvalid(string? invalidMessageId)
    {
        // Act
        var act = () => new InboxMessage(invalidMessageId!, "TestConsumer", "OrderPaid");

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*MessageId is required.*");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Constructor_ShouldThrowArgumentException_WhenConsumerNameIsInvalid(string? invalidConsumerName)
    {
        // Act
        var act = () => new InboxMessage("MSG-1", invalidConsumerName!, "OrderPaid");

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*ConsumerName is required.*");
    }

    [Fact]
    public void MarkProcessed_ShouldUpdateStatusAndProcessedAt()
    {
        // Arrange
        var inboxMessage = new InboxMessage("MSG-1", "TestConsumer", "OrderPaid");

        // Act
        inboxMessage.MarkProcessed();

        // Assert
        inboxMessage.Status.Should().Be(InboxStatus.Processed);
        inboxMessage.ProcessedAt.Should().NotBeNull();
        inboxMessage.ProcessedAt!.Value.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(2));
        inboxMessage.ErrorMessage.Should().BeNull();
    }

    [Fact]
    public void MarkFailed_ShouldUpdateStatusAndErrorMessage()
    {
        // Arrange
        var inboxMessage = new InboxMessage("MSG-1", "TestConsumer", "OrderPaid");
        var error = "Database timeout error";

        // Act
        inboxMessage.MarkFailed(error);

        // Assert
        inboxMessage.Status.Should().Be(InboxStatus.Failed);
        inboxMessage.ErrorMessage.Should().Be(error);
        inboxMessage.ProcessedAt.Should().BeNull();
    }
}
