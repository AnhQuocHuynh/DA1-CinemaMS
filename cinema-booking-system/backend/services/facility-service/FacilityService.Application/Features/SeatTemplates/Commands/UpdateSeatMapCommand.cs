using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using FluentValidation;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Features.SeatTemplates.Commands
{
    public class UpdateSeatMapCommand : IRequest<bool>
    {
        public long RoomId { get; set; }
        public required SeatMapUpdateRequestDto Request { get; set; }
    }

    public class UpdateSeatMapCommandValidator : AbstractValidator<UpdateSeatMapCommand>
    {
        public UpdateSeatMapCommandValidator()
        {
            RuleFor(v => v.RoomId).GreaterThan(0);
            RuleFor(v => v.Request).NotNull();
            RuleFor(v => v.Request.Rows).GreaterThan(0).When(v => v.Request != null);
            RuleFor(v => v.Request.Columns).GreaterThan(0).When(v => v.Request != null);
        }
    }

    public class UpdateSeatMapCommandHandler : IRequestHandler<UpdateSeatMapCommand, bool>
    {
        private readonly IUnitOfWork _unitOfWork;

        public UpdateSeatMapCommandHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<bool> Handle(UpdateSeatMapCommand request, CancellationToken cancellationToken)
        {
            var room = await _unitOfWork.Rooms.GetByIdAsync(request.RoomId);
            if (room == null) throw new RoomNotFoundException(request.RoomId);

            room.Update(room.Name, room.Type, room.TotalSeats, request.Request.Rows, request.Request.Columns);
            
            var existingTemplates = await _unitOfWork.SeatTemplates.GetByRoomIdAsync(room.Id);
            _unitOfWork.SeatTemplates.RemoveRange(existingTemplates);

            if (request.Request.Seats != null && request.Request.Seats.Any())
            {
                var newTemplates = new System.Collections.Generic.List<SeatTemplate>();
                foreach (var seatReq in request.Request.Seats)
                {
                    FacilityService.Domain.Enum.SeatTypeCode codeCode;
                    if (!System.Enum.TryParse(seatReq.SeatTypeCode.ToUpper(), out codeCode))
                    {
                        throw new System.Exception("Invalid seat type");
                    }

                    var seatType = await _unitOfWork.SeatTypes.GetByCodeAsync(codeCode);
                    if (seatType == null) throw new System.Exception("Invalid seat type");

                    int span = (codeCode == FacilityService.Domain.Enum.SeatTypeCode.COUPLE) ? 2 : 1;

                    var template = new SeatTemplate(room, seatType, seatReq.RowLabel, seatReq.ColumnNumber, span, false);
                    newTemplates.Add(template);
                }
                await _unitOfWork.SeatTemplates.AddRangeAsync(newTemplates);
            }

            _unitOfWork.Rooms.Update(room);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return true;
        }
    }
}
