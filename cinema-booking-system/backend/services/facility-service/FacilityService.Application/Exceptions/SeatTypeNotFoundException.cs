namespace FacilityService.Application.Exceptions
{
    public class SeatTypeNotFoundException : NotFoundException
    {
        public SeatTypeNotFoundException(string code) : base($"Seat type with code {code} was not found.")
        {
        }
    }
}
