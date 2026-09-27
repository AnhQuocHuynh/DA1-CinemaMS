using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Interfaces;
using NotificationService.Domain.ValueObjects;

namespace NotificationService.Application.Features.Preferences.Commands;

public record UpdateUserPreferenceCommand(
    long UserId,
    string? Email,
    string? PhoneNumber,
    bool EmailEnabled,
    bool SmsEnabled,
    bool PushEnabled) : IRequest;

public class UpdateUserPreferenceCommandValidator : AbstractValidator<UpdateUserPreferenceCommand>
{
    public UpdateUserPreferenceCommandValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0);
    }
}

public class UpdateUserPreferenceCommandHandler : IRequestHandler<UpdateUserPreferenceCommand>
{
    private readonly IUserPreferenceRepository _preferenceRepository;

    public UpdateUserPreferenceCommandHandler(IUserPreferenceRepository preferenceRepository)
    {
        _preferenceRepository = preferenceRepository;
    }

    public async Task Handle(UpdateUserPreferenceCommand request, CancellationToken cancellationToken)
    {
        var pref = await _preferenceRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        
        ContactDetails? contact = null;
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            contact = new ContactDetails(request.Email, request.PhoneNumber);
        }

        if (pref == null)
        {
            pref = new UserPreference(
                request.UserId,
                contact,
                request.EmailEnabled,
                request.SmsEnabled,
                request.PushEnabled
            );
        }
        else
        {
            pref.UpdatePreferences(
                contact,
                request.EmailEnabled,
                request.SmsEnabled,
                request.PushEnabled
            );
        }

        await _preferenceRepository.UpsertAsync(pref, cancellationToken);
    }
}
