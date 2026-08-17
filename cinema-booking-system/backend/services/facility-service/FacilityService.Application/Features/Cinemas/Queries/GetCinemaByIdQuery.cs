using FacilityService.Application.DTOs;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace FacilityService.Application.Features.Cinemas.Queries
{
    public class GetCinemaByIdQuery : IRequest<CinemaDto>
    {
        public required long Id { get; set; }
    }
    public class GetCinemaByIdQueryHandler : IRequestHandler<GetCinemaByIdQuery, CinemaDto>
    {
        private readonly IUnitOfWork _unitOfWork;
        
        public GetCinemaByIdQueryHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<CinemaDto> Handle(GetCinemaByIdQuery request, CancellationToken cancellationToken)
        {
            var cinema = await _unitOfWork.Cinemas.GetByIdAsync(request.Id);
            if (cinema == null)
            {
                throw new Application.Exceptions.CinemaNotFoundException(request.Id);
            }
            return new CinemaDto 
            { 
                Id = cinema.Id, 
                Name = cinema.Name, 
                Address = cinema.Address, 
                City = cinema.City, 
                Phone = cinema.Phone 
            };
        }
    }
}