using System;

namespace FacilityService.Application.Exceptions
{
    public class RoomNotFoundException : Exception
    {
        public RoomNotFoundException(long id) : base($"Room with id {id} was not found.")
        {
        }
    }
}
