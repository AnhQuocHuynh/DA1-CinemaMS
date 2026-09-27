using IdentityService.Application.Features.Internal.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace IdentityService.Presentation.Controllers;

[ApiController]
[Route("internal/users")]
public class InternalUsersController : ControllerBase
{
    private readonly IMediator _mediator;

    public InternalUsersController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("resolve")]
    [AllowAnonymous] // Internal endpoint, blocked from external access by Gateway
    [ApiExplorerSettings(IgnoreApi = true)] // Hide from Swagger
    public async Task<IActionResult> ResolveKeycloakId([FromQuery] string keycloakId)
    {
        if (string.IsNullOrEmpty(keycloakId))
        {
            return BadRequest("KeycloakId is required");
        }

        var userId = await _mediator.Send(new ResolveKeycloakIdQuery(keycloakId));
        return Ok(userId);
    }
}
