using FluentValidation;
using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Messages;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
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
    private readonly IEventPublisher _eventPublisher;

    public UpdateUserProfileCommandHandler(
        IUserRepository userRepository, 
        IUnitOfWork unitOfWork, 
        IEventPublisher eventPublisher)
    {
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _eventPublisher = eventPublisher;
    }

    public async Task Handle(UpdateUserProfileCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            throw new UserNotFoundException(request.UserId);

        user.UpdateProfile(request.Phone, request.Gender, request.DateOfBirth);

        _userRepository.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Publish event to RabbitMQ so other services know
        var payload = new UserProfileUpdatedPayload(user.Id, user.Email, user.FullName);
        await _eventPublisher.PublishAsync(payload, cancellationToken);
    }
}
