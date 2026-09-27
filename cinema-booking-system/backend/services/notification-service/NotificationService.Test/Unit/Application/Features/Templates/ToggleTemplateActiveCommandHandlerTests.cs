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

public class ToggleTemplateActiveCommandHandlerTests
{
    private readonly Mock<ITemplateRepository> _templateRepositoryMock;
    private readonly ToggleTemplateActiveCommandHandler _handler;

    public ToggleTemplateActiveCommandHandlerTests()
    {
        _templateRepositoryMock = new Mock<ITemplateRepository>();
        _handler = new ToggleTemplateActiveCommandHandler(_templateRepositoryMock.Object);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Handle_ShouldToggleActiveStatus_WhenTemplateExists(bool activeStatus)
    {
        // Arrange
        var command = new ToggleTemplateActiveCommand("CODE1", activeStatus);
        var template = new NotificationTemplate("CODE1", NotificationChannel.EMAIL, "Subject", "Body");

        // Set initial state to opposite so we can verify toggle
        template.ToggleActive(!activeStatus);

        _templateRepositoryMock
            .Setup(x => x.GetByCodeAsync(command.Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync(template);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        template.Active.Should().Be(activeStatus);

        _templateRepositoryMock.Verify(x => x.UpdateAsync(template, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowTemplateNotFoundException_WhenTemplateDoesNotExist()
    {
        // Arrange
        var command = new ToggleTemplateActiveCommand("NON_EXISTENT", false);

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
