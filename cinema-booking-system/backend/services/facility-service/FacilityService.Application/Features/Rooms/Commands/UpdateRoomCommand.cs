using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Interfaces;
using FluentValidation;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Features.Rooms.Commands
{
    public class UpdateRoomCommand : IRequest<RoomDto>
    {
        public long Id { get; set; }
        public required long CinemaId { get; set; }
        public required string Name { get; set; }
        public string? Type { get; set; }
        public int? Rows { get; set; }
        public int? Columns { get; set; }
        public bool Active { get; set; } = true;
        public bool UnderMaintenance { get; set; } = false;
    }

    public class UpdateRoomCommandValidator : AbstractValidator<UpdateRoomCommand>
    {
        public UpdateRoomCommandValidator()
        {
            RuleFor(v => v.Id).GreaterThan(0);
            RuleFor(v => v.CinemaId).GreaterThan(0);
            RuleFor(v => v.Name).NotEmpty().MaximumLength(100);
        }
    }

    public class UpdateRoomCommandHandler : IRequestHandler<UpdateRoomCommand, RoomDto>
    {
        private readonly IUnitOfWork _unitOfWork;

        public UpdateRoomCommandHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<RoomDto> Handle(UpdateRoomCommand request, CancellationToken cancellationToken)
        {
            var room = await _unitOfWork.Rooms.GetByIdAsync(request.Id);
            if (room == null) throw new RoomNotFoundException(request.Id);

            if (room.CinemaId != request.CinemaId)
            {
                var cinema = await _unitOfWork.Cinemas.GetByIdAsync(request.CinemaId);
                if (cinema == null) throw new CinemaNotFoundException(request.CinemaId);
                room.ChangeCinema(cinema);
            }

            room.Update(request.Name, request.Type, room.TotalSeats, request.Rows, request.Columns);
            if (request.Active) room.Enable();
            else room.Disable();
            room.SetMaintenance(request.UnderMaintenance);
            _unitOfWork.Rooms.Update(room);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

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
