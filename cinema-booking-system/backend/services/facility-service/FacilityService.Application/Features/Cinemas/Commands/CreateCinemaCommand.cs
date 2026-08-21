using FacilityService.Application.DTOs;
using FluentValidation;
using MediatR;
using FacilityService.Domain.Interfaces;
using FacilityService.Domain.Entities;
using Microsoft.Extensions.Caching.Distributed;

namespace FacilityService.Application.Features.Cinemas.Commands
{
    public class CreateCinemaCommand : IRequest<CinemaDto>
    {
        public required string Name { get; set; }
        public required string Address { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
    }

    public class CreateCinemaCommandValidator : AbstractValidator<CreateCinemaCommand>
    {
        public CreateCinemaCommandValidator()
        {
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
    
    
    public class CreateCinemaCommandHandler : IRequestHandler<CreateCinemaCommand, CinemaDto>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;
        
        public CreateCinemaCommandHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<CinemaDto> Handle(CreateCinemaCommand request, CancellationToken cancellationToken)
        {
            Cinema cinema = new Cinema(request.Name, request.Address, request.City, request.Phone);
            
            await _unitOfWork.Cinemas.AddAsync(cinema);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await _cache.RemoveAsync("facility:cinemas:all", cancellationToken);

            return new CinemaDto { Id = cinema.Id, Name = cinema.Name, Address = cinema.Address, City = cinema.City, Phone = cinema.Phone };
        }
    }
}
