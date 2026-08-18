using FacilityService.Application.DTOs;
using FacilityService.Application.Features.SeatTemplates.Commands;
using FacilityService.Application.Features.SeatTemplates.Queries;
using FacilityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Presentation.Controllers
{
    [ApiController]
    public class SeatTemplatesController : ControllerBase
    {
        private readonly IMediator _mediator;

        public SeatTemplatesController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet("api/cinemas/{cinemaId}/rooms/{roomId}/seats")]
        public async Task<IActionResult> GetSeatTemplates(long cinemaId, long roomId)
        {
            var result = await _mediator.Send(new GetSeatTemplatesByRoomQuery { RoomId = roomId });
            return Ok(ApiResponse<IEnumerable<SeatTemplateDto>>.Ok(result));
        }

        [HttpPut("api/cinemas/{cinemaId}/rooms/{roomId}/seats")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> UpdateSeatMap(long cinemaId, long roomId, [FromBody] SeatMapUpdateRequestDto request)
        {
            var command = new UpdateSeatMapCommand
            {
                RoomId = roomId,
                Request = request
            };

            await _mediator.Send(command);
            return Ok(ApiResponse<bool>.Ok(true, "Seat map updated successfully"));
        }

        [HttpGet("internal/rooms/{roomId}/seats")]
        [ApiExplorerSettings(IgnoreApi = true)]
        public async Task<IActionResult> GetSeatTemplatesInternal(long roomId)
        {
            var result = await _mediator.Send(new GetSeatTemplatesByRoomQuery { RoomId = roomId });
            return Ok(ApiResponse<IEnumerable<SeatTemplateDto>>.Ok(result));
        }
    }
}
