using FacilityService.Application.DTOs;
using FacilityService.Application.Features.Rooms.Queries;
using FacilityService.Application.Features.SeatTemplates.Queries;
using FacilityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Presentation.Controllers
{
    [ApiController]
    [Route("internal/facility")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public class InternalFacilityController : ControllerBase
    {
        private readonly IMediator _mediator;

        public InternalFacilityController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet("rooms/{roomId}")]
        public async Task<IActionResult> GetRoomInternal(long roomId)
        {
            var result = await _mediator.Send(new GetRoomByIdQuery { Id = roomId });
            return Ok(ApiResponse<RoomDto>.Ok(result));
        }

        [HttpGet("seat-templates/{seatTemplateId}")]
        public async Task<IActionResult> GetSeatTemplateInternal(long seatTemplateId)
        {
            var result = await _mediator.Send(new GetSeatTemplateByIdQuery { Id = seatTemplateId });
            return Ok(ApiResponse<SeatTemplateDto>.Ok(result));
        }

        [HttpGet("rooms/{roomId}/seat-templates")]
        public async Task<IActionResult> GetSeatTemplatesByRoomInternal(long roomId)
        {
            var result = await _mediator.Send(new GetSeatTemplatesByRoomQuery { RoomId = roomId });
            return Ok(ApiResponse<IEnumerable<SeatTemplateDto>>.Ok(result));
        }
    }
}
