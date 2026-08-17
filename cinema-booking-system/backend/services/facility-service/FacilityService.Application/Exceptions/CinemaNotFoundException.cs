using System;

namespace FacilityService.Application.Exceptions
{
    public class CinemaNotFoundException : NotFoundException
    {
        public CinemaNotFoundException(long id) : base($"Cinema with id {id} was not found.")
        {
        }
    }
}
