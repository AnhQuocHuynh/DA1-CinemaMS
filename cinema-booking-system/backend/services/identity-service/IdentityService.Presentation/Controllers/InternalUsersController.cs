using IdentityService.Application.DTOs;
using IdentityService.Application.Features.Internal.Queries;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
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

    [HttpGet("{id:long}")]
    [AllowAnonymous]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> GetUserById([FromRoute] long id)
    {
        var user = await _mediator.Send(new GetUserByIdQuery(id));
        return Ok(user);
    }

    [HttpGet("{id:long}/cinema-scope")]
    [AllowAnonymous]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> GetUserCinemaScope([FromRoute] long id)
    {
        var user = await _mediator.Send(new GetUserByIdInternalQuery(id));
        var roles = (user.Roles ?? Enumerable.Empty<string>())
            .Select(r => r.ToUpperInvariant())
            .ToHashSet();

        var realmRole = roles.Contains("ADMIN") ? "ADMIN"
                      : roles.Contains("STAFF") ? "STAFF"
                      : "CUSTOMER";

        IReadOnlyList<long> cinemaIds = user.CinemaId.HasValue
            ? new[] { user.CinemaId.Value }
            : Array.Empty<long>();

        var scope = new CinemaScopeDto(realmRole, cinemaIds);
        return Ok(ApiResponse<CinemaScopeDto>.Ok(scope));
    }
}
