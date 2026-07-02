using FacilityService.Application.DTOs;
using FacilityService.Application.Features.Cinemas.Commands;
using FacilityService.Application.Features.Cinemas.Queries;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace FacilityService.Presentation.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CinemasController : ControllerBase
    {
        /*
        private readonly IMediator _mediator;

        public CinemasController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet]
        public async Task<IActionResult> GetCinemas()
        {
            var cinemas = await _mediator.Send(new GetCinemasQuery());
            return Ok(cinemas);
        }

        [HttpPost]
        public async Task<IActionResult> CreateCinema(CreateCinemaCommand command)
        {
            var result = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetCinemas), new { id = result.Id }, result);
        }
        */
    }
}
