using FacilityService.Application.DTOs;
using FluentValidation;
using MediatR;
using FacilityService.Domain.Interfaces;
using FacilityService.Domain.Entities;
using FacilityService.Application.Contracts;
using FacilityService.Application.Exceptions;

namespace FacilityService.Application.Features.Cinemas.Commands
{
    public class DeleteCinemaCommand : IRequest<bool>
    {
        public required long Id { get; set; }
    }

    public class DeleteCinemaCommandValidator : AbstractValidator<DeleteCinemaCommand>
    {
        public DeleteCinemaCommandValidator()
        {
            RuleFor(v => v.Id)
                .NotEmpty().WithMessage("Id is required.");
        }
    }


    public class DeleteCinemaCommandHandler : IRequestHandler<DeleteCinemaCommand, bool>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IShowtimeServiceClient _showtimeServiceClient;

        public DeleteCinemaCommandHandler(IUnitOfWork unitOfWork, IShowtimeServiceClient showtimeServiceClient)
        {
            _unitOfWork = unitOfWork;
            _showtimeServiceClient = showtimeServiceClient;
        }

        public async Task<bool> Handle(DeleteCinemaCommand request, CancellationToken cancellationToken)
        {
            Cinema? cinema = await _unitOfWork.Cinemas.GetByIdAsync(request.Id);
            if (cinema == null)
            {
                throw new CinemaNotFoundException(request.Id);
            }
            // Validate if the cinema has any rooms associated with it or if there's any showtimes scheduled in the future. If so, throw an exception or return an error response.
            if(cinema.Active)
            {
                var roomIds = cinema.Rooms.Where(r => r.Active).Select(r => r.Id).ToList();

                if(roomIds.Any())
                {
                    var hasFutureShowtimes = await _showtimeServiceClient.HasFutureShowtimesAsync(roomIds, cancellationToken);
                    if (hasFutureShowtimes)
                    {
                        throw new BadRequestException("Cannot delete cinema with future showtimes scheduled.");
                    }
                }
                cinema.Disable();
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }


            

            return true;
        }
    }
}
