using System;

namespace FacilityService.Application.Exceptions
{
    public class RoomNotFoundException : NotFoundException
    {
        public RoomNotFoundException(long id) : base($"Room with id {id} was not found.")
        {
        }
    }
}
