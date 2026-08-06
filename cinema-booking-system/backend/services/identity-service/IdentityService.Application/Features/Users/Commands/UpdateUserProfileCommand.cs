using FluentValidation;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Messages;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using MassTransit;
using MediatR;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Users.Commands;

public record UpdateUserProfileCommand(
    long UserId,
    string? Phone,
    Gender? Gender,
    DateTime? DateOfBirth
) : IRequest;

public class UpdateUserProfileCommandValidator : AbstractValidator<UpdateUserProfileCommand>
{
    public UpdateUserProfileCommandValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0);
        RuleFor(x => x.Phone)
            .MaximumLength(20).WithMessage("Phone number cannot exceed 20 characters.");
        RuleFor(x => x.DateOfBirth)
            .LessThanOrEqualTo(DateTime.UtcNow.Date).WithMessage("Date of birth cannot be in the future.");
    }
}

public class UpdateUserProfileCommandHandler : IRequestHandler<UpdateUserProfileCommand>
{
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPublishEndpoint _publishEndpoint;

    public UpdateUserProfileCommandHandler(
        IUserRepository userRepository, 
        IUnitOfWork unitOfWork, 
        IPublishEndpoint publishEndpoint)
    {
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _publishEndpoint = publishEndpoint;
    }

    public async Task Handle(UpdateUserProfileCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            throw new UserNotFoundException(request.UserId);

        user.UpdateProfile(request.Phone, request.Gender, request.DateOfBirth);

        _userRepository.Update(user);

        // Publish event via MassTransit Outbox pattern
        var payload = new UserProfileUpdatedPayload(user.Id, user.Email, user.FullName);
        await _publishEndpoint.Publish(payload, cancellationToken);

        // SaveChanges will commit both the User update and the Outbox message in one transaction
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
