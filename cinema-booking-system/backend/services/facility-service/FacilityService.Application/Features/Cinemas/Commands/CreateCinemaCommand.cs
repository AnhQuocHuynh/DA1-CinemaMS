using FacilityService.Application.DTOs;
using MediatR;
using FacilityService.Domain.Interfaces;
using FacilityService.Domain.Entities;

namespace FacilityService.Application.Features.Cinemas.Commands
{
    public class CreateCinemaCommand : IRequest<CinemaDto>
    {
        public required string Name { get; set; }
        public required string Address { get; set; }
        public string? City { get; set; }
        public string? Phone { get; set; }
    }
    
    
    public class CreateCinemaCommandHandler : IRequestHandler<CreateCinemaCommand, CinemaDto>
    {
        private readonly IUnitOfWork _unitOfWork;
        
        public CreateCinemaCommandHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<CinemaDto> Handle(CreateCinemaCommand request, CancellationToken cancellationToken)
        {
            Cinema cinema = new Cinema(request.Name, request.Address, request.City, request.Phone);
            
            
            return new CinemaDto { Name = request.Name, Address = request.Address };
        }
    }
}
