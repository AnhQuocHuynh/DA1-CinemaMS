using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Exceptions;
using NotificationService.Application.Features.Templates.Queries;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Application.Features.Templates;

public class GetTemplateByCodeQueryHandlerTests
{
    private readonly Mock<ITemplateRepository> _templateRepositoryMock;
    private readonly GetTemplateByCodeQueryHandler _handler;

    public GetTemplateByCodeQueryHandlerTests()
    {
        _templateRepositoryMock = new Mock<ITemplateRepository>();
        _handler = new GetTemplateByCodeQueryHandler(_templateRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnTemplateDto_WhenTemplateExists()
    {
        // Arrange
        var query = new GetTemplateByCodeQuery("CODE1");
        var template = new NotificationTemplate("CODE1", NotificationChannel.EMAIL, "Subject", "Body");

        _templateRepositoryMock
            .Setup(x => x.GetByCodeAsync(query.Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync(template);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Code.Should().Be(template.Code);
        result.Channel.Should().Be(template.Channel);
        result.Subject.Should().Be(template.Subject);
        result.BodyTemplate.Should().Be(template.BodyTemplate);
        result.Active.Should().Be(template.Active);
    }

    [Fact]
    public async Task Handle_ShouldThrowTemplateNotFoundException_WhenTemplateDoesNotExist()
    {
        // Arrange
        var query = new GetTemplateByCodeQuery("NON_EXISTENT");

        _templateRepositoryMock
            .Setup(x => x.GetByCodeAsync(query.Code, It.IsAny<CancellationToken>()))
            .ReturnsAsync((NotificationTemplate?)null);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<TemplateNotFoundException>()
            .WithMessage("*NON_EXISTENT*");
    }
}
