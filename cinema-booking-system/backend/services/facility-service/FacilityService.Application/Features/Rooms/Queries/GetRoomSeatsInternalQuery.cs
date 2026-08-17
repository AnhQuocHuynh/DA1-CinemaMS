using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Features.Rooms.Queries
{
    public class GetRoomSeatsInternalQuery : IRequest<List<InternalRoomSeatsDto>>
    {
        public long RoomId { get; set; }
    }

    public class GetRoomSeatsInternalQueryHandler : IRequestHandler<GetRoomSeatsInternalQuery, List<InternalRoomSeatsDto>>
    {
        private readonly IUnitOfWork _unitOfWork;

        public GetRoomSeatsInternalQueryHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<List<InternalRoomSeatsDto>> Handle(GetRoomSeatsInternalQuery request, CancellationToken cancellationToken)
        {
            var room = await _unitOfWork.Rooms.GetByIdAsync(request.RoomId);
            if (room == null) throw new RoomNotFoundException(request.RoomId);

            var seats = await _unitOfWork.SeatTemplates.GetByRoomIdAsync(request.RoomId);
            
            return seats.Where(s => s.Active).Select(s => new InternalRoomSeatsDto
            {
                Id = s.Id,
                RowLabel = s.RowLabel,
                ColumnNumber = s.ColumnNumber,
                SeatTypeCode = s.SeatType?.Code.ToString(),
                ColumnSpan = s.ColumnSpan,
                Pathway = s.Pathway
            }).ToList();
        }
    }
}
