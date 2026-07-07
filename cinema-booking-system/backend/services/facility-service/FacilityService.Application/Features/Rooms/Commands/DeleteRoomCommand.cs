using FacilityService.Application.Contracts;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Interfaces;
using FluentValidation;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace FacilityService.Application.Features.Rooms.Commands
{
    public class DeleteRoomCommand : IRequest<bool>
    {
        public required long Id { get; set; }
    }

    public class DeleteRoomCommandValidator : AbstractValidator<DeleteRoomCommand>
    {
        public DeleteRoomCommandValidator()
        {
            RuleFor(v => v.Id).GreaterThan(0);
        }
    }

    public class DeleteRoomCommandHandler : IRequestHandler<DeleteRoomCommand, bool>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IShowtimeServiceClient _showtimeServiceClient;

        public DeleteRoomCommandHandler(IUnitOfWork unitOfWork, IShowtimeServiceClient showtimeServiceClient)
        {
            _unitOfWork = unitOfWork;
            _showtimeServiceClient = showtimeServiceClient;
        }

        public async Task<bool> Handle(DeleteRoomCommand request, CancellationToken cancellationToken)
        {
            var room = await _unitOfWork.Rooms.GetByIdAsync(request.Id);
            if (room == null) throw new RoomNotFoundException(request.Id);

            if (room.Active)
            {
                var hasFutureShowtimes = await _showtimeServiceClient.HasFutureShowtimesAsync(new List<long> { room.Id }, cancellationToken);
                if (hasFutureShowtimes)
                {
                    throw new System.Exception("Cannot delete room with future showtimes scheduled.");
                }

                room.Disable();
                _unitOfWork.Rooms.Update(room);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return true;
        }
    }
}
