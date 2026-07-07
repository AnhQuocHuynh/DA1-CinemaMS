using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Features.Rooms.Queries
{
    public class GetRoomByIdQuery : IRequest<RoomDto>
    {
        public long Id { get; set; }
    }

    public class GetRoomByIdQueryHandler : IRequestHandler<GetRoomByIdQuery, RoomDto>
    {
        private readonly IUnitOfWork _unitOfWork;

        public GetRoomByIdQueryHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<RoomDto> Handle(GetRoomByIdQuery request, CancellationToken cancellationToken)
        {
            var room = await _unitOfWork.Rooms.GetByIdAsync(request.Id);
            if (room == null) throw new RoomNotFoundException(request.Id);

            return new RoomDto
            {
                Id = room.Id,
                CinemaId = room.CinemaId,
                Name = room.Name,
                Type = room.Type,
                TotalSeats = room.TotalSeats,
                Rows = room.Rows,
                Columns = room.Columns,
                Active = room.Active,
                UnderMaintenance = room.UnderMaintenance
            };
        }
    }
}
