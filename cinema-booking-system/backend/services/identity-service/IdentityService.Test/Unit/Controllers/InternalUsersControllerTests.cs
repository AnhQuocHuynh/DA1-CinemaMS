using FluentAssertions;
using IdentityService.Application.Features.Internal.Queries;
using IdentityService.Presentation.Controllers;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Controllers;

public class InternalUsersControllerTests
{
    private readonly Mock<IMediator> _mediatorMock = new();
    private readonly InternalUsersController _controller;

    public InternalUsersControllerTests()
    {
        _controller = new InternalUsersController(_mediatorMock.Object);
    }

    // ─── Normal: valid keycloakId → resolves and returns OK ──────────────────

    [Fact]
    public async Task ResolveKeycloakId_ValidId_ReturnsOkWithUserId()
    {
        _mediatorMock.Setup(m => m.Send(It.IsAny<ResolveKeycloakIdQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(99L);

        var result = await _controller.ResolveKeycloakId("some-kc-id");

        result.Should().BeOfType<OkObjectResult>();
        ((OkObjectResult)result).Value.Should().Be(99L);
        _mediatorMock.Verify(m => m.Send(
            It.Is<ResolveKeycloakIdQuery>(q => q.KeycloakId == "some-kc-id"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Error: empty keycloakId → bad request (no mediator call) ────────────

    [Fact]
    public async Task ResolveKeycloakId_EmptyId_ReturnsBadRequestWithoutCallingMediator()
    {
        var result = await _controller.ResolveKeycloakId("");

        result.Should().BeOfType<BadRequestObjectResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<ResolveKeycloakIdQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Error: null keycloakId → bad request ────────────────────────────────

    [Fact]
    public async Task ResolveKeycloakId_NullId_ReturnsBadRequestWithoutCallingMediator()
    {
        var result = await _controller.ResolveKeycloakId(null!);

        result.Should().BeOfType<BadRequestObjectResult>();
        _mediatorMock.Verify(m => m.Send(It.IsAny<ResolveKeycloakIdQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
