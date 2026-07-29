using FluentAssertions;
using FluentValidation;
using IdentityService.Application.Behaviors;
using IdentityService.Application.Features.Users.Queries;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Behaviors;

/// <summary>
/// ValidationBehavior&lt;TRequest, TResponse&gt; requires TRequest : IRequest&lt;TResponse&gt;.
/// GetCurrentUserQuery returns UserDto, making it ideal for testing the pipeline
/// because its return type is a concrete class (not MediatR.Unit).
/// </summary>
public class ValidationBehaviorTests
{
    // ─── No validators ───────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_NoValidators_CallsNext()
    {
        var behavior = new ValidationBehavior<GetCurrentUserQuery, IdentityService.Application.DTOs.UserDto>(
            new List<IValidator<GetCurrentUserQuery>>());

        var nextCalled = false;
        Task<IdentityService.Application.DTOs.UserDto> Next()
        {
            nextCalled = true;
            return Task.FromResult(new IdentityService.Application.DTOs.UserDto(1, "kc", "e@e.com", "N", null, null, null, true));
        }

        var query = new GetCurrentUserQuery("kc-1");
        await behavior.Handle(query, Next, CancellationToken.None);

        nextCalled.Should().BeTrue();
    }

    // ─── Valid request ───────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_ValidRequest_WithValidators_CallsNext()
    {
        // GetCurrentUserQuery has no validator registered — we provide an empty list to simulate
        var behavior = new ValidationBehavior<GetCurrentUserQuery, IdentityService.Application.DTOs.UserDto>(
            new List<IValidator<GetCurrentUserQuery>> { new AlwaysPassValidator() });

        var nextCalled = false;
        Task<IdentityService.Application.DTOs.UserDto> Next()
        {
            nextCalled = true;
            return Task.FromResult(new IdentityService.Application.DTOs.UserDto(1, "kc", "e@e.com", "N", null, null, null, true));
        }

        await behavior.Handle(new GetCurrentUserQuery("kc-1"), Next, CancellationToken.None);

        nextCalled.Should().BeTrue();
    }

    // ─── Invalid request ─────────────────────────────────────────────────────

    [Fact]
    public async Task Handle_InvalidRequest_ThrowsValidationException_DoesNotCallNext()
    {
        var behavior = new ValidationBehavior<GetCurrentUserQuery, IdentityService.Application.DTOs.UserDto>(
            new List<IValidator<GetCurrentUserQuery>> { new AlwaysFailValidator() });

        var nextCalled = false;
        Task<IdentityService.Application.DTOs.UserDto> Next()
        {
            nextCalled = true;
            return Task.FromResult(new IdentityService.Application.DTOs.UserDto(1, "kc", "e@e.com", "N", null, null, null, true));
        }

        await FluentActions.Invoking(() => behavior.Handle(new GetCurrentUserQuery("kc-1"), Next, CancellationToken.None))
            .Should().ThrowAsync<ValidationException>();

        nextCalled.Should().BeFalse();
    }

    // ─── Multiple validators aggregate failures ───────────────────────────────

    [Fact]
    public async Task Handle_MultipleValidators_AggregatesAllFailures()
    {
        var behavior = new ValidationBehavior<GetCurrentUserQuery, IdentityService.Application.DTOs.UserDto>(
            new List<IValidator<GetCurrentUserQuery>> { new AlwaysFailValidator(), new AnotherFailValidator() });

        var ex = await FluentActions.Invoking(() =>
                behavior.Handle(new GetCurrentUserQuery("kc"), () =>
                    Task.FromResult(new IdentityService.Application.DTOs.UserDto(1, "k", "e@e.com", "N", null, null, null, true)),
                    CancellationToken.None))
            .Should().ThrowAsync<ValidationException>();

        ex.Which.Errors.Should().HaveCountGreaterThanOrEqualTo(2);
    }

    // ─── Test validators ─────────────────────────────────────────────────────

    private sealed class AlwaysPassValidator : AbstractValidator<GetCurrentUserQuery>
    {
        public AlwaysPassValidator()
        {
            RuleFor(x => x.KeycloakId).NotEmpty();
        }
    }

    private sealed class AlwaysFailValidator : AbstractValidator<GetCurrentUserQuery>
    {
        public AlwaysFailValidator()
        {
            RuleFor(x => x.KeycloakId).Must(_ => false).WithMessage("Fail from validator 1");
        }
    }

    private sealed class AnotherFailValidator : AbstractValidator<GetCurrentUserQuery>
    {
        public AnotherFailValidator()
        {
            RuleFor(x => x.KeycloakId).Must(_ => false).WithMessage("Fail from validator 2");
        }
    }
}
