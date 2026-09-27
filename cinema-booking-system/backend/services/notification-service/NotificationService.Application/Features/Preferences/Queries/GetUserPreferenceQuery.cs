using System.Threading;
using System.Threading.Tasks;
using MediatR;
using NotificationService.Application.DTOs;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Preferences.Queries;

public record GetUserPreferenceQuery(long UserId) : IRequest<PreferenceDto>;

public class GetUserPreferenceQueryHandler : IRequestHandler<GetUserPreferenceQuery, PreferenceDto>
{
    private readonly IUserPreferenceRepository _preferenceRepository;

    public GetUserPreferenceQueryHandler(IUserPreferenceRepository preferenceRepository)
    {
        _preferenceRepository = preferenceRepository;
    }

    public async Task<PreferenceDto> Handle(GetUserPreferenceQuery request, CancellationToken cancellationToken)
    {
        var pref = await _preferenceRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        
        // If no preference found, return default (all true)
        if (pref == null)
        {
            return new PreferenceDto
            {
                UserId = request.UserId,
                Email = null,
                PhoneNumber = null,
                EmailEnabled = true,
                SmsEnabled = true,
                PushEnabled = true
            };
        }

        return new PreferenceDto
        {
            UserId = pref.UserId,
            Email = pref.Contact?.Email,
            PhoneNumber = pref.Contact?.PhoneNumber,
            EmailEnabled = pref.EmailEnabled,
            SmsEnabled = pref.SmsEnabled,
            PushEnabled = pref.PushEnabled
        };
    }
}
