using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Enum;
using FacilityService.Domain.Interfaces;
using FluentValidation;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using System.Collections.Generic;

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
        private readonly IDistributedCache _cache;

        public UpdateSeatMapCommandHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
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
                var newTemplates = new List<SeatTemplate>();
                foreach (var seatReq in request.Request.Seats)
                {
                    SeatTypeCode codeCode;
                    if (!Enum.TryParse(seatReq.SeatTypeCode.ToUpper(), out codeCode))
                    {
                        throw new BadRequestException("Invalid seat type");
                    }

                    var seatType = await _unitOfWork.SeatTypes.GetByCodeAsync(codeCode);
                    if (seatType == null) throw new SeatTypeNotFoundException(seatReq.SeatTypeCode);
                    int span = (codeCode == SeatTypeCode.COUPLE) ? 2 : 1;

                    var template = new SeatTemplate(room, seatType, seatReq.RowLabel, seatReq.ColumnNumber, span, false);
                    newTemplates.Add(template);
                }
                await _unitOfWork.SeatTemplates.AddRangeAsync(newTemplates);
            }

            _unitOfWork.Rooms.Update(room);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            foreach (var existingTemplate in existingTemplates)
            {
                await _cache.RemoveAsync($"facility:seattemplate:{existingTemplate.Id}", cancellationToken);
            }
            await _cache.RemoveAsync($"facility:seattemplates:room:{room.Id}", cancellationToken);
            await _cache.RemoveAsync($"facility:roomseats:{room.Id}", cancellationToken);

            return true;
        }
    }
}
