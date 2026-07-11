using FacilityService.Application.DTOs;
using FacilityService.Application.Features.Cinemas.Commands;
using FacilityService.Application.Features.Cinemas.Queries;
using FacilityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Presentation.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CinemasController : ControllerBase
    {
        private readonly IMediator _mediator;

        public CinemasController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet]
        public async Task<IActionResult> GetCinemas()
        {
            var cinemas = await _mediator.Send(new GetCinemasQuery());
            return Ok(ApiResponse<IEnumerable<CinemaDto>>.Ok(cinemas));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetCinemaById(long id)
        {
            var result = await _mediator.Send(new GetCinemaByIdQuery { Id = id });
            return Ok(ApiResponse<object>.Ok(result));
        }

        [HttpPost]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> CreateCinema([FromBody] CreateCinemaCommand command)
        {
            var result = await _mediator.Send(command);
            return Ok(ApiResponse<CinemaDto>.Ok(result, "Cinema created successfully"));
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> UpdateCinema(long id, [FromBody] UpdateCinemaCommand command)
        {
            if (id != command.Id)
            {
                return BadRequest(ApiResponse<object>.Error("Id mismatch"));
            }

            var result = await _mediator.Send(command);
            return Ok(ApiResponse<CinemaDto>.Ok(result, "Cinema updated successfully"));
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> DeleteCinema(long id)
        {
            await _mediator.Send(new DeleteCinemaCommand { Id = id });
            return Ok(ApiResponse<bool>.Ok(true, "Cinema deleted successfully"));
        }
    }
}
