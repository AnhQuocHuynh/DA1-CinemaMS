using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Exceptions;
using NotificationService.Application.Features.Templates.Commands;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Application.Features.Templates;

public class UpdateTemplateCommandHandlerTests
{
    private readonly Mock<ITemplateRepository> _templateRepositoryMock;
    private readonly UpdateTemplateCommandHandler _handler;

    public UpdateTemplateCommandHandlerTests()
    {
        _templateRepositoryMock = new Mock<ITemplateRepository>();
        _handler = new UpdateTemplateCommandHandler(_templateRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldUpdateTemplate_WhenTemplateExists()
    {
        // Arrange
        var command = new UpdateTemplateCommand("CODE1", NotificationChannel.SMS, "New Subject", "New Body");
        var template = new NotificationTemplate("CODE1", NotificationChannel.EMAIL, "Old Subject", "Old Body");

        _templateRepositoryMock
            .Setup(x => x.GetByCodeAsync(command.Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync(template);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        template.Subject.Should().Be("New Subject");
        template.BodyTemplate.Should().Be("New Body");
        template.Channel.Should().Be(NotificationChannel.SMS);

        _templateRepositoryMock.Verify(x => x.UpdateAsync(template, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowTemplateNotFoundException_WhenTemplateDoesNotExist()
    {
        // Arrange
        var command = new UpdateTemplateCommand("NON_EXISTENT", NotificationChannel.SMS, "New Subject", "New Body");

        _templateRepositoryMock
            .Setup(x => x.GetByCodeAsync(command.Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync((NotificationTemplate?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<TemplateNotFoundException>()
            .WithMessage("*NON_EXISTENT*");

        _templateRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<NotificationTemplate>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
