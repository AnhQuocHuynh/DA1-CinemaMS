using FacilityService.Application.DTOs;
using FluentValidation;
using MediatR;
using FacilityService.Domain.Interfaces;
using FacilityService.Domain.Entities;
using FacilityService.Application.Exceptions;
using Microsoft.Extensions.Caching.Distributed;

namespace FacilityService.Application.Features.Cinemas.Commands
{
    public class UpdateCinemaCommand : IRequest<CinemaDto>
    {
        public required long Id { get; set; }
        public required string Name { get; set; }
        public required string Address { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
    }

    public class UpdateCinemaCommandValidator : AbstractValidator<UpdateCinemaCommand>
    {
        public UpdateCinemaCommandValidator()
        {
            RuleFor(v => v.Id)
                .NotEmpty().WithMessage("Id is required.");

            RuleFor(v => v.Name)
                .NotEmpty().WithMessage("Name is required.")
                .MaximumLength(150).WithMessage("Name cannot exceed 150 characters.");

            RuleFor(v => v.Address)
                .NotEmpty().WithMessage("Address is required.")
                .MaximumLength(255).WithMessage("Address cannot exceed 255 characters.");

            RuleFor(v => v.City)
                .MaximumLength(100).WithMessage("City cannot exceed 100 characters.");

            RuleFor(v => v.Phone)
                .MaximumLength(20).WithMessage("Phone cannot exceed 20 characters.");
        }
    }
    
    
    public class UpdateCinemaCommandHandler : IRequestHandler<UpdateCinemaCommand, CinemaDto>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;
        
        public UpdateCinemaCommandHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<CinemaDto> Handle(UpdateCinemaCommand request, CancellationToken cancellationToken)
        {
            Cinema? cinema = await _unitOfWork.Cinemas.GetByIdAsync(request.Id);
            if (cinema == null)
            {
                throw new CinemaNotFoundException(request.Id);
            }

            cinema.Update(request.Name, request.Address, request.City, request.Phone);
            
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await _cache.RemoveAsync($"facility:cinema:{request.Id}", cancellationToken);
            await _cache.RemoveAsync("facility:cinemas:all", cancellationToken);

            return new CinemaDto { Id = cinema.Id, Name = cinema.Name, Address = cinema.Address, City = cinema.City, Phone = cinema.Phone };
        }
    }
}
