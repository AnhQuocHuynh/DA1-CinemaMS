using FluentValidation;
using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Users.Commands;

public record AssignStaffCinemaCommand(long UserId, long? CinemaId) : IRequest;

public class AssignStaffCinemaCommandValidator : AbstractValidator<AssignStaffCinemaCommand>
{
    public AssignStaffCinemaCommandValidator()
    {
        RuleFor(x => x.UserId)
            .GreaterThan(0).WithMessage("UserId must be a positive number.");

        When(x => x.CinemaId.HasValue, () =>
        {
            RuleFor(x => x.CinemaId!.Value)
                .GreaterThan(0).WithMessage("CinemaId must be a positive number.");
        });
    }
}

public class AssignStaffCinemaCommandHandler : IRequestHandler<AssignStaffCinemaCommand>
{
    private readonly IUserRepository _userRepository;
    private readonly IKeycloakAdminClient _keycloakAdmin;
    private readonly IUnitOfWork _unitOfWork;

    public AssignStaffCinemaCommandHandler(
        IUserRepository userRepository,
        IKeycloakAdminClient keycloakAdmin,
        IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _keycloakAdmin = keycloakAdmin;
        _unitOfWork = unitOfWork;
    }

    public async Task Handle(AssignStaffCinemaCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken)
            ?? throw new UserNotFoundException(request.UserId);

        // 1. Persist to local DB
        user.AssignCinema(request.CinemaId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // 2. Sync to Keycloak user attribute (so JWT carries cinema_id at login)
        var attributeValue = request.CinemaId?.ToString() ?? string.Empty;
        await _keycloakAdmin.SetUserAttributeAsync(user.KeycloakId, "cinema_id", attributeValue, cancellationToken);
    }
}
