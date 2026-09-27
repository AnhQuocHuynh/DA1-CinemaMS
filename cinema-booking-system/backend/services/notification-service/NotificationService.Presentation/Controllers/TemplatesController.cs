using MediatR;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Application.Features.Templates.Commands;
using NotificationService.Application.Features.Templates.Queries;

namespace NotificationService.Presentation.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TemplatesController : ControllerBase
{
    private readonly IMediator _mediator;

    public TemplatesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<IActionResult> GetTemplates([FromQuery] GetTemplatesQuery query)
    {
        var result = await _mediator.Send(query);
        return Ok(result);
    }

    [HttpGet("{code}")]
    public async Task<IActionResult> GetTemplateByCode(string code)
    {
        var result = await _mediator.Send(new GetTemplateByCodeQuery(code));
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> CreateTemplate([FromBody] CreateTemplateCommand command)
    {
        var result = await _mediator.Send(command);
        return Ok(result);
    }

    [HttpPut("{code}")]
    public async Task<IActionResult> UpdateTemplate(string code, [FromBody] UpdateTemplateCommand command)
    {
        if (code != command.Code)
        {
            return BadRequest("Code mismatch");
        }
        
        await _mediator.Send(command);
        return NoContent();
    }

    [HttpPatch("{code}/toggle-active")]
    public async Task<IActionResult> ToggleTemplateActive(string code, [FromBody] ToggleTemplateActiveCommand command)
    {
        if (code != command.Code)
        {
            return BadRequest("Code mismatch");
        }

        await _mediator.Send(command);
        return NoContent();
    }
}
