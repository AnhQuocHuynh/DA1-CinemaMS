using FacilityService.Application.DTOs;
using FacilityService.Application.Features.Rooms.Commands;
using FacilityService.Application.Features.Rooms.Queries;
using FacilityService.Presentation.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FacilityService.Presentation.Controllers
{
    [ApiController]
    [Route("api/cinemas/{cinemaId}/[controller]")]
    public class RoomsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public RoomsController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet]
        public async Task<IActionResult> GetRoomsByCinema(long cinemaId)
        {
            var result = await _mediator.Send(new GetRoomsByCinemaQuery { CinemaId = cinemaId });
            return Ok(ApiResponse<IEnumerable<RoomDto>>.Ok(result));
        }

        [HttpGet("{roomId}")]
        public async Task<IActionResult> GetRoomById(long cinemaId, long roomId)
        {
            var result = await _mediator.Send(new GetRoomByIdQuery { Id = roomId });
            // In a real app we might verify cinemaId matches the room.CinemaId, but standard is fine for now.
            return Ok(ApiResponse<RoomDto>.Ok(result));
        }

        [HttpPost]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> CreateRoom(long cinemaId, [FromBody] CreateRoomCommand command)
        {
            if (command.CinemaId == 0)
            {
                command.CinemaId = cinemaId;
            }
            else if (command.CinemaId != cinemaId)
            {
                return BadRequest(ApiResponse<object>.Error("CinemaId mismatch in path and body"));
            }

            var result = await _mediator.Send(command);
            return Ok(ApiResponse<RoomDto>.Ok(result, "Room created successfully"));
        }

        [HttpPut("{roomId}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> UpdateRoom(long cinemaId, long roomId, [FromBody] UpdateRoomCommand command)
        {
            if (roomId != command.Id)
            {
                return BadRequest(ApiResponse<object>.Error("RoomId mismatch in path and body"));
            }
            if (cinemaId != command.CinemaId)
            {
                return BadRequest(ApiResponse<object>.Error("CinemaId mismatch in path and body"));
            }

            var result = await _mediator.Send(command);
            return Ok(ApiResponse<RoomDto>.Ok(result, "Room updated successfully"));
        }

        [HttpDelete("{roomId}")]
        [Authorize(Roles = "ADMIN")]
        public async Task<IActionResult> DeleteRoom(long cinemaId, long roomId)
        {
            await _mediator.Send(new DeleteRoomCommand { Id = roomId });
            return Ok(ApiResponse<bool>.Ok(true, "Room deleted successfully"));
        }
    }
}
