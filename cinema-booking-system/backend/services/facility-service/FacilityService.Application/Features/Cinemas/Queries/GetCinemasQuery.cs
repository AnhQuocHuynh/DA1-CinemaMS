using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.DTOs;
using FacilityService.Domain.Interfaces;
using MediatR;

namespace FacilityService.Application.Features.Cinemas.Queries
{
    public class GetCinemasQuery : IRequest<IEnumerable<CinemaDto>>
    {
    }

    public class GetCinemasQueryHandler : IRequestHandler<GetCinemasQuery, IEnumerable<CinemaDto>>
    {
        private readonly IUnitOfWork _unitOfWork;
        
        public GetCinemasQueryHandler(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<IEnumerable<CinemaDto>> Handle(GetCinemasQuery request, CancellationToken cancellationToken)
        {
            var cinemas = await _unitOfWork.Cinemas.GetAllAsync();
            return cinemas.Where(c => c.Active).Select(c => new CinemaDto 
            { 
                Id = c.Id, 
                Name = c.Name, 
                Address = c.Address, 
                City = c.City, 
                Phone = c.Phone 
            }).ToList();
        }
    }
}
