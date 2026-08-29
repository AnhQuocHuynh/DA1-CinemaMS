using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Features.Templates.Commands;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Application.Features.Templates;

public class CreateTemplateCommandHandlerTests
{
    private readonly Mock<ITemplateRepository> _templateRepositoryMock;
    private readonly CreateTemplateCommandHandler _handler;

    public CreateTemplateCommandHandlerTests()
    {
        _templateRepositoryMock = new Mock<ITemplateRepository>();
        _handler = new CreateTemplateCommandHandler(_templateRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_WhenTemplateDoesNotExist_CreatesTemplateAndReturnsId()
    {
        // Arrange
        var command = new CreateTemplateCommand("TEST_CODE", NotificationChannel.EMAIL, "Test Subject", "Test Body");
        
        _templateRepositoryMock
            .Setup(x => x.GetByCodeAsync(command.Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync((NotificationTemplate?)null);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        _templateRepositoryMock.Verify(x => x.InsertAsync(It.Is<NotificationTemplate>(t => 
            t.Code == command.Code &&
            t.Channel == command.Channel &&
            t.Subject == command.Subject &&
            t.Active == true
        ), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenTemplateExists_ThrowsException()
    {
        // Arrange
        var command = new CreateTemplateCommand("TEST_CODE", NotificationChannel.EMAIL, "Test Subject", "Test Body");
        var existingTemplate = new NotificationTemplate("TEST_CODE", NotificationChannel.EMAIL, "Old Subject", "Old Body");
        
        _templateRepositoryMock
            .Setup(x => x.GetByCodeAsync(command.Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingTemplate);

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<Exception>().WithMessage($"Template with code {command.Code} already exists.");
        _templateRepositoryMock.Verify(x => x.InsertAsync(It.IsAny<NotificationTemplate>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
