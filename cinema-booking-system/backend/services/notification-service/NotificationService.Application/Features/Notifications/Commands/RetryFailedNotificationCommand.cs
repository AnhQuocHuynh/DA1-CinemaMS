using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Application.Exceptions;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Notifications.Commands;

public record RetryFailedNotificationCommand(string Id) : IRequest;

public class RetryFailedNotificationCommandValidator : AbstractValidator<RetryFailedNotificationCommand>
{
    public RetryFailedNotificationCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}

public class RetryFailedNotificationCommandHandler : IRequestHandler<RetryFailedNotificationCommand>
{
    private readonly INotificationRepository _notificationRepository;

    public RetryFailedNotificationCommandHandler(INotificationRepository notificationRepository)
    {
        _notificationRepository = notificationRepository;
    }

    public async Task Handle(RetryFailedNotificationCommand request, CancellationToken cancellationToken)
    {
        var notification = await _notificationRepository.GetByIdAsync(request.Id, cancellationToken)
            ?? throw new NotificationNotFoundException(request.Id);

        notification.MarkForRetry();
        
        await _notificationRepository.UpdateAsync(notification, cancellationToken);
    }
}
