using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using NotificationService.Application.DTOs;
using NotificationService.Application.Features.Preferences.Commands;
using NotificationService.Application.Features.Preferences.Queries;
using NotificationService.Presentation.Controllers;
using Xunit;

namespace NotificationService.Test.Unit.Presentation.Controllers;

public class PreferencesControllerTests
{
    private readonly Mock<IMediator> _mediatorMock;
    private readonly PreferencesController _controller;

    public PreferencesControllerTests()
    {
        _mediatorMock = new Mock<IMediator>();
        _controller = new PreferencesController(_mediatorMock.Object);
    }

    private void SetUserContext(string? headerUserId = null, string? internalClaim = null, string? nameIdClaim = null, string? role = null)
    {
        var httpContext = new DefaultHttpContext();
        if (headerUserId is not null)
        {
            httpContext.Request.Headers["X-User-Id"] = headerUserId;
        }

        var claims = new List<Claim>();
        if (internalClaim is not null)
        {
            claims.Add(new Claim("internal_user_id", internalClaim));
        }
        if (nameIdClaim is not null)
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, nameIdClaim));
        }
        if (role is not null)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        _controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    // ─── GET /api/preferences/{userId} ───────────────────────────────────────

    [Fact]
    public async Task GetUserPreference_WhenUserIsNotAuthorized_ReturnsForbid()
    {
        // Arrange: User 42 requesting User 99's preferences
        SetUserContext(headerUserId: "42");

        // Act
        var result = await _controller.GetUserPreference(99);

        // Assert
        result.Should().BeOfType<ForbidResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<GetUserPreferenceQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetUserPreference_WhenAuthorizedAsOwner_ReturnsOk()
    {
        // Arrange
        SetUserContext(headerUserId: "42");
        var expectedDto = new PreferenceDto { UserId = 42, EmailEnabled = true, SmsEnabled = true, PushEnabled = true };
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserPreferenceQuery>(q => q.UserId == 42), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDto);

        // Act
        var result = await _controller.GetUserPreference(42);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(expectedDto);
    }

    [Fact]
    public async Task GetUserPreference_WhenAuthorizedAsAdmin_ReturnsOk()
    {
        // Arrange: Admin requesting preferences for user 99
        SetUserContext(role: "ADMIN");
        var expectedDto = new PreferenceDto { UserId = 99, EmailEnabled = true, SmsEnabled = false, PushEnabled = true };
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserPreferenceQuery>(q => q.UserId == 99), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDto);

        // Act
        var result = await _controller.GetUserPreference(99);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(expectedDto);
    }

    // ─── PUT /api/preferences/{userId} ───────────────────────────────────────

    [Fact]
    public async Task UpdateUserPreference_WhenUserIsNotAuthorized_ReturnsForbid()
    {
        // Arrange: User 42 trying to update User 99
        SetUserContext(headerUserId: "42");
        var command = new UpdateUserPreferenceCommand(0, "test@example.com", null, true, true, false);

        // Act
        var result = await _controller.UpdateUserPreference(99, command);

        // Assert
        result.Should().BeOfType<ForbidResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<UpdateUserPreferenceCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateUserPreference_WhenUserIdMismatch_ReturnsBadRequest()
    {
        // Arrange: User 42 updating User 42, but command body has UserId = 99
        SetUserContext(headerUserId: "42");
        var command = new UpdateUserPreferenceCommand(99, "test@example.com", null, true, true, false);

        // Act
        var result = await _controller.UpdateUserPreference(42, command);

        // Assert
        var badRequestResult = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        badRequestResult.Value.Should().Be("User ID mismatch");
        _mediatorMock.Verify(m => m.Send(It.IsAny<UpdateUserPreferenceCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateUserPreference_WhenUserIdIsZero_SetsUserIdAndReturnsNoContent()
    {
        // Arrange: User 42 updating User 42, command.UserId == 0 (omitted from body)
        SetUserContext(headerUserId: "42");
        var command = new UpdateUserPreferenceCommand(0, "test@example.com", null, true, true, false);

        // Act
        var result = await _controller.UpdateUserPreference(42, command);

        // Assert
        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<UpdateUserPreferenceCommand>(c => c.UserId == 42 && c.Email == "test@example.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateUserPreference_WhenUserIdMatches_ReturnsNoContent()
    {
        // Arrange: User 42 updating User 42 with matching UserId
        SetUserContext(headerUserId: "42");
        var command = new UpdateUserPreferenceCommand(42, "test@example.com", null, true, true, false);

        // Act
        var result = await _controller.UpdateUserPreference(42, command);

        // Assert
        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<UpdateUserPreferenceCommand>(c => c.UserId == 42 && c.Email == "test@example.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateUserPreference_WhenAuthorizedAsAdmin_ReturnsNoContent()
    {
        // Arrange: Admin updating user 99 with command.UserId == 0
        SetUserContext(role: "ADMIN");
        var command = new UpdateUserPreferenceCommand(0, "admin-updated@example.com", null, false, false, true);

        // Act
        var result = await _controller.UpdateUserPreference(99, command);

        // Assert
        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<UpdateUserPreferenceCommand>(c => c.UserId == 99 && c.Email == "admin-updated@example.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── GET /api/preferences/me ─────────────────────────────────────────────

    [Fact]
    public async Task GetMyPreference_WhenUserIdIsNull_ReturnsUnauthorized()
    {
        // Arrange: No user ID header or claim
        SetUserContext();

        // Act
        var result = await _controller.GetMyPreference();

        // Assert
        result.Should().BeOfType<UnauthorizedResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<GetUserPreferenceQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetMyPreference_WhenUserIdIsPresent_ReturnsOk()
    {
        // Arrange: User ID present in header
        SetUserContext(headerUserId: "42");
        var expectedDto = new PreferenceDto { UserId = 42, EmailEnabled = true, SmsEnabled = true, PushEnabled = true };
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserPreferenceQuery>(q => q.UserId == 42), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDto);

        // Act
        var result = await _controller.GetMyPreference();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(expectedDto);
    }

    [Fact]
    public async Task GetMyPreference_WhenUserIdResolvedFromInternalClaim_ReturnsOk()
    {
        // Arrange: User ID present in internal_user_id claim
        SetUserContext(internalClaim: "55");
        var expectedDto = new PreferenceDto { UserId = 55, EmailEnabled = true, SmsEnabled = true, PushEnabled = true };
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserPreferenceQuery>(q => q.UserId == 55), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDto);

        // Act
        var result = await _controller.GetMyPreference();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(expectedDto);
    }

    [Fact]
    public async Task GetMyPreference_WhenUserIdResolvedFromNameIdentifier_ReturnsOk()
    {
        // Arrange: User ID present in NameIdentifier claim
        SetUserContext(nameIdClaim: "66");
        var expectedDto = new PreferenceDto { UserId = 66, EmailEnabled = true, SmsEnabled = true, PushEnabled = true };
        _mediatorMock.Setup(m => m.Send(It.Is<GetUserPreferenceQuery>(q => q.UserId == 66), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedDto);

        // Act
        var result = await _controller.GetMyPreference();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().BeEquivalentTo(expectedDto);
    }

    // ─── PUT /api/preferences/me ─────────────────────────────────────────────

    [Fact]
    public async Task UpdateMyPreference_WhenUserIdIsNull_ReturnsUnauthorized()
    {
        // Arrange
        SetUserContext();
        var command = new UpdateUserPreferenceCommand(0, "test@example.com", null, true, true, false);

        // Act
        var result = await _controller.UpdateMyPreference(command);

        // Assert
        result.Should().BeOfType<UnauthorizedResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<UpdateUserPreferenceCommand>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateMyPreference_WhenUserIdIsPresent_ReturnsNoContent()
    {
        // Arrange
        SetUserContext(headerUserId: "42");
        var command = new UpdateUserPreferenceCommand(0, "updated@example.com", null, false, true, true);

        // Act
        var result = await _controller.UpdateMyPreference(command);

        // Assert
        result.Should().BeOfType<NoContentResult>();
        _mediatorMock.Verify(m => m.Send(
            It.Is<UpdateUserPreferenceCommand>(c => c.UserId == 42 && c.Email == "updated@example.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
