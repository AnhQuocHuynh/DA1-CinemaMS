using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using NotificationService.Application.DTOs;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Features.Notifications.Queries;
using NotificationService.Presentation.Controllers;
using Xunit;

namespace NotificationService.Test.Unit.Presentation.Controllers;

public class NotificationsControllerTests
{
    private readonly Mock<IMediator> _mediatorMock;
    private readonly NotificationsController _controller;

    public NotificationsControllerTests()
    {
        _mediatorMock = new Mock<IMediator>();
        _controller = new NotificationsController(_mediatorMock.Object);
    }

    [Fact]
    public async Task GetMyNotifications_ShouldReturnUnauthorized_WhenUserIdHeaderIsMissing()
    {
        // Arrange
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        // Act
        var result = await _controller.GetMyNotifications();

        // Assert
        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task GetMyNotifications_ShouldReturnOk_WhenUserIdHeaderIsPresent()
    {
        // Arrange
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["X-User-Id"] = "42";
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        var dtoList = new List<NotificationDto>
        {
            new() { Id = "notif-1", UserId = 42, Title = "Test Notif", IsRead = false }
        };

        _mediatorMock.Setup(m => m.Send(It.Is<GetNotificationsByUserQuery>(q => q.UserId == 42), It.IsAny<CancellationToken>()))
            .ReturnsAsync(dtoList);

        // Act
        var result = await _controller.GetMyNotifications();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(dtoList);
    }

    [Fact]
    public async Task MarkAsRead_ShouldReturnUnauthorized_WhenUserIdHeaderIsMissing()
    {
        // Arrange
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        // Act
        var result = await _controller.MarkAsRead("notif-1");

        // Assert
        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task MarkAsRead_ShouldReturnNoContent_WhenUserIdHeaderIsPresent()
    {
        // Arrange
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["X-User-Id"] = "42";
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        // Act
        var result = await _controller.MarkAsRead("notif-1");

        // Assert
        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<MarkNotificationAsReadCommand>(c => c.Id == "notif-1" && c.UserId == 42),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkAllAsRead_ShouldReturnUnauthorized_WhenUserIdHeaderIsMissing()
    {
        // Arrange
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        // Act
        var result = await _controller.MarkAllAsRead();

        // Assert
        result.Should().BeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task MarkAllAsRead_ShouldReturnNoContent_WhenUserIdHeaderIsPresent()
    {
        // Arrange
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers["X-User-Id"] = "42";
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        // Act
        var result = await _controller.MarkAllAsRead();

        // Assert
        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<MarkAllNotificationsAsReadCommand>(c => c.UserId == 42),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
