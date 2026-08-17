using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Features.SeatTemplates.Queries
{
    public class GetSeatTemplatesByRoomQuery : IRequest<List<SeatTemplateDto>>
    {
        public long RoomId { get; set; }
    }

    public class GetSeatTemplatesByRoomQueryHandler : IRequestHandler<GetSeatTemplatesByRoomQuery, List<SeatTemplateDto>>
    {
        private readonly IUnitOfWork _unitOfWork;

        public GetSeatTemplatesByRoomQueryHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<List<SeatTemplateDto>> Handle(GetSeatTemplatesByRoomQuery request, CancellationToken cancellationToken)
        {
            var room = await _unitOfWork.Rooms.GetByIdAsync(request.RoomId);
            if (room == null) throw new RoomNotFoundException(request.RoomId);

            var seats = await _unitOfWork.SeatTemplates.GetByRoomIdAsync(request.RoomId);
            
            return seats.Where(s => s.Active).Select(s => new SeatTemplateDto
            {
                Id = s.Id,
                RowLabel = s.RowLabel,
                ColumnNumber = s.ColumnNumber,
                SeatTypeCode = s.SeatType?.Code.ToString(),
                ColumnSpan = s.ColumnSpan,
                Active = s.Active
            }).ToList();
        }
    }
}
