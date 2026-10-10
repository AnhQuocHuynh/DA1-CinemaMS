using IdentityService.Domain.Enums;

namespace IdentityService.Domain.Entities;

public class CinemaAssignment
{
    public long Id { get; private set; }
    public long UserId { get; private set; }
    public User User { get; private set; } = null!;
    public long CinemaId { get; private set; }
    public AssignmentDuty Duty { get; private set; }

    private CinemaAssignment()
    {
    }

    public CinemaAssignment(User user, long cinemaId, AssignmentDuty duty)
    {
        User = user ?? throw new ArgumentNullException(nameof(user));
        UserId = user.Id;
        CinemaId = cinemaId;
        Duty = duty;
    }
}
