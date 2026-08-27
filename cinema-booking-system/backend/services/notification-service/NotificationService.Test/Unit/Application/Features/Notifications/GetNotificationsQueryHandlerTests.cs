using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using NotificationService.Application.Features.Notifications.Queries;
using Xunit;

namespace NotificationService.Test.Application.Features.Notifications;

public class GetNotificationsQueryHandlerTests
{
    private readonly GetNotificationsQueryHandler _handler;

    public GetNotificationsQueryHandlerTests()
    {
        _handler = new GetNotificationsQueryHandler();
    }

    [Fact]
    public async Task Handle_ShouldReturnEmptyPagedResult_AsStub()
    {
        // Arrange
        var query = new GetNotificationsQuery(1, 10);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().BeEmpty();
    }
}
