using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Features.Preferences.Commands;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Unit.Application.Features.Preferences;

public class UpdateUserPreferenceCommandHandlerTests
{
    private readonly Mock<IUserPreferenceRepository> _repoMock;
    private readonly UpdateUserPreferenceCommandHandler _handler;

    public UpdateUserPreferenceCommandHandlerTests()
    {
        _repoMock = new Mock<IUserPreferenceRepository>();
        _handler = new UpdateUserPreferenceCommandHandler(_repoMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldCreateNewPreference_WhenItDoesNotExist()
    {
        // Arrange
        _repoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserPreference?)null);

        var command = new UpdateUserPreferenceCommand(123, "test@test.com", "123", false, false, false);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _repoMock.Verify(x => x.UpsertAsync(It.Is<UserPreference>(p => 
            p.UserId == 123 && p.Contact != null && p.Contact.Email == "test@test.com" && !p.EmailEnabled), 
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldUpdateExistingPreference_WhenItExists()
    {
        // Arrange
        var contact = new NotificationService.Domain.ValueObjects.ContactDetails("old@test.com");
        var existingPref = new UserPreference(123, contact, true, true, true);
        _repoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingPref);

        var command = new UpdateUserPreferenceCommand(123, "new@test.com", null, false, true, false);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _repoMock.Verify(x => x.UpsertAsync(It.Is<UserPreference>(p => 
            p.UserId == 123 && p.Contact != null && p.Contact.Email == "new@test.com" && !p.EmailEnabled && p.SmsEnabled && !p.PushEnabled), 
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
