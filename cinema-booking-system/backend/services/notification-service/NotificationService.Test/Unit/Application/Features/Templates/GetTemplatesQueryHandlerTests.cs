using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Features.Templates.Queries;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Application.Features.Templates;

public class GetTemplatesQueryHandlerTests
{
    private readonly Mock<ITemplateRepository> _templateRepositoryMock;
    private readonly GetTemplatesQueryHandler _handler;

    public GetTemplatesQueryHandlerTests()
    {
        _templateRepositoryMock = new Mock<ITemplateRepository>();
        _handler = new GetTemplatesQueryHandler(_templateRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnEmptyList_WhenNoTemplatesExist()
    {
        // Arrange
        var query = new GetTemplatesQuery();

        _templateRepositoryMock
            .Setup(x => x.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<NotificationTemplate>());

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ShouldReturnTemplatesList_WhenTemplatesExist()
    {
        // Arrange
        var query = new GetTemplatesQuery();
        var template1 = new NotificationTemplate("CODE1", NotificationChannel.EMAIL, "Sub1", "Body1");
        var template2 = new NotificationTemplate("CODE2", NotificationChannel.SMS, "Sub2", "Body2");

        _templateRepositoryMock
            .Setup(x => x.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<NotificationTemplate> { template1, template2 });

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        
        var list = result.ToList();
        list[0].Code.Should().Be("CODE1");
        list[1].Code.Should().Be("CODE2");
    }
}
