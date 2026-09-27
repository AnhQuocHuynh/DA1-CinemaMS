using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using FluentValidation;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.Extensions.Caching.Distributed;

namespace FacilityService.Application.Features.Rooms.Commands
{
    public class CreateRoomCommand : IRequest<RoomDto>
    {
        public required long CinemaId { get; set; }
        public required string Name { get; set; }
        public string? Type { get; set; }
        public int? Rows { get; set; }
        public int? Columns { get; set; }
        public bool Active { get; set; } = true;
        public bool UnderMaintenance { get; set; } = false;
    }

    public class CreateRoomCommandValidator : AbstractValidator<CreateRoomCommand>
    {
        public CreateRoomCommandValidator()
        {
            RuleFor(v => v.CinemaId).GreaterThan(0).WithMessage("CinemaId is required.");
            RuleFor(v => v.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(100);
            RuleFor(v => v.Rows).GreaterThanOrEqualTo(0);
            RuleFor(v => v.Columns).GreaterThanOrEqualTo(0);
        }
    }

    public class CreateRoomCommandHandler : IRequestHandler<CreateRoomCommand, RoomDto>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;

        public CreateRoomCommandHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<RoomDto> Handle(CreateRoomCommand request, CancellationToken cancellationToken)
        {
            var cinema = await _unitOfWork.Cinemas.GetByIdAsync(request.CinemaId);
            if (cinema == null) throw new CinemaNotFoundException(request.CinemaId);

            var room = new Room(cinema, request.Name, request.Type, null, request.Rows, request.Columns);
            if (!request.Active) room.Disable();
            room.SetMaintenance(request.UnderMaintenance);

            var standardType = await _unitOfWork.SeatTypes.GetByCodeAsync(FacilityService.Domain.Enum.SeatTypeCode.STANDARD);
            if (standardType == null)
            {
                standardType = new SeatType(FacilityService.Domain.Enum.SeatTypeCode.STANDARD, "standard", "Standard", 1.0m, 1, "Standard single seat");
                await _unitOfWork.SeatTypes.AddAsync(standardType);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            room.GenerateDefaultSeatMap(standardType);
            await _unitOfWork.Rooms.AddAsync(room);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await _cache.RemoveAsync($"facility:rooms:cinema:{request.CinemaId}", cancellationToken);

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
