using FacilityService.Application.DTOs;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Features.Rooms.Queries
{
    public class GetRoomsByCinemaQuery : IRequest<List<RoomDto>>
    {
        public long CinemaId { get; set; }
    }

    public class GetRoomsByCinemaQueryHandler : IRequestHandler<GetRoomsByCinemaQuery, List<RoomDto>>
    {
        private readonly IUnitOfWork _unitOfWork;

        public GetRoomsByCinemaQueryHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<List<RoomDto>> Handle(GetRoomsByCinemaQuery request, CancellationToken cancellationToken)
        {
            var rooms = await _unitOfWork.Rooms.GetRoomsByCinemaIdAsync(request.CinemaId);
            
            return rooms.Select(r => new RoomDto
            {
                Id = r.Id,
                CinemaId = r.CinemaId,
                Name = r.Name,
                Type = r.Type,
                TotalSeats = r.TotalSeats,
                Rows = r.Rows,
                Columns = r.Columns,
                Active = r.Active,
                UnderMaintenance = r.UnderMaintenance
            }).ToList();
        }
    }
}
