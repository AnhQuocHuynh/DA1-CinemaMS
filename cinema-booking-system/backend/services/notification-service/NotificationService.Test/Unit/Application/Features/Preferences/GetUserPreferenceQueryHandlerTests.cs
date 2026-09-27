using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Features.Preferences.Queries;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Unit.Application.Features.Preferences;

public class GetUserPreferenceQueryHandlerTests
{
    private readonly Mock<IUserPreferenceRepository> _repoMock;
    private readonly GetUserPreferenceQueryHandler _handler;

    public GetUserPreferenceQueryHandlerTests()
    {
        _repoMock = new Mock<IUserPreferenceRepository>();
        _handler = new GetUserPreferenceQueryHandler(_repoMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnDefaults_WhenNoPreferenceExists()
    {
        // Arrange
        _repoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserPreference?)null);

        var query = new GetUserPreferenceQuery(123);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.UserId.Should().Be(123);
        result.Email.Should().BeNull();
        result.PhoneNumber.Should().BeNull();
        result.EmailEnabled.Should().BeTrue();
        result.SmsEnabled.Should().BeTrue();
        result.PushEnabled.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ShouldReturnExistingPreference_WhenExists()
    {
        // Arrange
        var contact = new NotificationService.Domain.ValueObjects.ContactDetails("test@test.com", "123");
        var pref = new UserPreference(123, contact, false, true, false);
        _repoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pref);

        var query = new GetUserPreferenceQuery(123);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.UserId.Should().Be(123);
        result.Email.Should().Be("test@test.com");
        result.PhoneNumber.Should().Be("123");
        result.EmailEnabled.Should().BeFalse();
        result.SmsEnabled.Should().BeTrue();
        result.PushEnabled.Should().BeFalse();
    }
}
