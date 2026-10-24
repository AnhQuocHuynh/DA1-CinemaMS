using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Contracts;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using NotificationService.Domain.ValueObjects;
using Xunit;

namespace NotificationService.Test.Unit.Application.Features.Notifications;

public class SendNotificationCommandHandlerTests
{
    private readonly Mock<INotificationRepository> _notifRepoMock;
    private readonly Mock<IUserPreferenceRepository> _prefRepoMock;
    private readonly Mock<ITemplateRepository> _templateRepoMock;
    private readonly Mock<ITemplateRenderer> _templateRendererMock;
    private readonly SendNotificationCommandHandler _handler;

    public SendNotificationCommandHandlerTests()
    {
        _notifRepoMock = new Mock<INotificationRepository>();
        _prefRepoMock = new Mock<IUserPreferenceRepository>();
        _templateRepoMock = new Mock<ITemplateRepository>();
        _templateRendererMock = new Mock<ITemplateRenderer>();
        _handler = new SendNotificationCommandHandler(
            _notifRepoMock.Object,
            _prefRepoMock.Object,
            _templateRepoMock.Object,
            _templateRendererMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldSkip_WhenChannelIsDisabled()
    {
        // Arrange
        var pref = new UserPreference(123, emailEnabled: false);
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pref);

        var command = new SendNotificationCommand(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Title", "Body", new Dictionary<string, object>());

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().Be("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldSend_WhenChannelIsEnabled()
    {
        // Arrange
        var pref = new UserPreference(123, emailEnabled: true);
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pref);

        var command = new SendNotificationCommand(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Title", "Body", new Dictionary<string, object>());

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldSend_WhenPreferenceDoesNotExist()
    {
        // Arrange
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserPreference?)null);

        var command = new SendNotificationCommand(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Title", "Body", new Dictionary<string, object>());

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldUseTemplate_WhenActiveTemplateExists()
    {
        // Arrange
        var pref = new UserPreference(123, emailEnabled: true);
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pref);

        var template = new NotificationTemplate("BOOKING_CONFIRMED", NotificationChannel.EMAIL, "Booking #{{orderId}}", "<h1>Hi {{name}}</h1>");
        _templateRepoMock.Setup(x => x.GetByCodeAsync("BOOKING_CONFIRMED", It.IsAny<CancellationToken>()))
            .ReturnsAsync(template);

        var metadata = new Dictionary<string, object> { { "orderId", 42 }, { "name", "John" } };
        _templateRendererMock.Setup(x => x.Render("Booking #{{orderId}}", metadata)).Returns("Booking #42");
        _templateRendererMock.Setup(x => x.Render("<h1>Hi {{name}}</h1>", metadata)).Returns("<h1>Hi John</h1>");

        var command = new SendNotificationCommand(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Fallback Title", "Fallback Body", metadata);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(
            It.Is<Notification>(n => n.Title == "Booking #42" && n.Body == "<h1>Hi John</h1>"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldEnrichMetadataWithEmail_WhenUserPreferenceHasEmailAndMetadataDoesNot()
    {
        // Arrange
        var contact = new ContactDetails("user@cinema.com", "0901234567");
        var pref = new UserPreference(123, contact, emailEnabled: true);
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pref);

        var metadata = new Dictionary<string, object> { { "orderId", 42 } };
        var command = new SendNotificationCommand(123, NotificationType.PAYMENT_RECEIPT, NotificationChannel.EMAIL, "Order Confirmed", "Payment receipt", metadata);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(
            It.Is<Notification>(n => n.Metadata != null && n.Metadata.ContainsKey("Email") && (string)n.Metadata["Email"] == "user@cinema.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldEnrichMetadataWithPhone_WhenUserPreferenceHasPhoneAndChannelIsSms()
    {
        // Arrange
        var contact = new ContactDetails("user@cinema.com", "0901234567");
        var pref = new UserPreference(123, contact, smsEnabled: true);
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pref);

        var metadata = new Dictionary<string, object> { { "code", "1234" } };
        var command = new SendNotificationCommand(123, NotificationType.SHOWTIME_REMINDER, NotificationChannel.SMS, "Reminder", "Showtime reminder", metadata);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(
            It.Is<Notification>(n => n.Metadata != null && n.Metadata.ContainsKey("Phone") && (string)n.Metadata["Phone"] == "0901234567"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldFallbackToUserResolver_WhenPreferenceHasNoEmail()
    {
        // Arrange
        var resolverMock = new Mock<IKeycloakUserResolver>();
        resolverMock.Setup(r => r.GetUserContactAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserContactDto(123, "resolved@cinema.com", "Resolved User", "0911223344"));

        var handlerWithResolver = new SendNotificationCommandHandler(
            _notifRepoMock.Object,
            _prefRepoMock.Object,
            _templateRepoMock.Object,
            _templateRendererMock.Object,
            resolverMock.Object);

        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserPreference?)null);

        var command = new SendNotificationCommand(123, NotificationType.PAYMENT_RECEIPT, NotificationChannel.EMAIL, "Receipt", "Paid", new Dictionary<string, object>());

        // Act
        var result = await handlerWithResolver.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(
            It.Is<Notification>(n => n.Metadata != null && n.Metadata.ContainsKey("Email") && (string)n.Metadata["Email"] == "resolved@cinema.com"),
            It.IsAny<CancellationToken>()), Times.Once);
        _prefRepoMock.Verify(x => x.UpsertAsync(
            It.Is<UserPreference>(p => p.Contact != null && p.Contact.Email == "resolved@cinema.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
