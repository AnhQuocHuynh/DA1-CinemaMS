using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Application.Exceptions;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Notifications.Commands;

public record MarkNotificationAsReadCommand(string Id, long UserId) : IRequest;

public class MarkNotificationAsReadCommandValidator : AbstractValidator<MarkNotificationAsReadCommand>
{
    public MarkNotificationAsReadCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.UserId).GreaterThan(0);
    }
}

public class MarkNotificationAsReadCommandHandler : IRequestHandler<MarkNotificationAsReadCommand>
{
    private readonly INotificationRepository _notificationRepository;

    public MarkNotificationAsReadCommandHandler(INotificationRepository notificationRepository)
    {
        _notificationRepository = notificationRepository;
    }

    public async Task Handle(MarkNotificationAsReadCommand request, CancellationToken cancellationToken)
    {
        var notification = await _notificationRepository.GetByIdAsync(request.Id, cancellationToken)
            ?? throw new NotificationNotFoundException(request.Id);

        if (notification.UserId != request.UserId)
        {
            throw new UnauthorizedAccessException("Notification does not belong to the user.");
        }

        notification.MarkAsRead();
        await _notificationRepository.UpdateAsync(notification, cancellationToken);
    }
}
