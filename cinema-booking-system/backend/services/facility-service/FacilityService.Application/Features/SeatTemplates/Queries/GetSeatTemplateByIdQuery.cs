using FacilityService.Application.DTOs;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Features.SeatTemplates.Queries
{
    public class GetSeatTemplateByIdQuery : IRequest<SeatTemplateDto>
    {
        public long Id { get; set; }
    }

    public class GetSeatTemplateByIdQueryHandler : IRequestHandler<GetSeatTemplateByIdQuery, SeatTemplateDto>
    {
        private readonly IUnitOfWork _unitOfWork;

        public GetSeatTemplateByIdQueryHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<SeatTemplateDto> Handle(GetSeatTemplateByIdQuery request, CancellationToken cancellationToken)
        {
            var seat = await _unitOfWork.SeatTemplates.GetByIdAsync(request.Id);
            if (seat == null) throw new System.Exception($"Seat template {request.Id} not found");

            return new SeatTemplateDto
            {
                Id = seat.Id,
                RowLabel = seat.RowLabel,
                ColumnNumber = seat.ColumnNumber,
                SeatTypeCode = seat.SeatType?.Code.ToString(),
                ColumnSpan = seat.ColumnSpan,
                Active = seat.Active
            };
        }
    }
}
