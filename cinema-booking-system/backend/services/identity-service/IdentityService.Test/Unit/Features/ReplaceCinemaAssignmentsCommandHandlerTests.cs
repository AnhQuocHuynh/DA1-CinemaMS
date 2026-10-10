using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using FluentAssertions;
using Moq;

namespace IdentityService.Test.Unit.Features;

public class ReplaceCinemaAssignmentsCommandHandlerTests
{
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<ICinemaAssignmentRepository> _assignments = new();
    private readonly Mock<IKeycloakAdminClient> _keycloak = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly ReplaceCinemaAssignmentsCommandHandler _handler;

    public ReplaceCinemaAssignmentsCommandHandlerTests()
    {
        _handler = new ReplaceCinemaAssignmentsCommandHandler(
            _users.Object,
            _assignments.Object,
            _keycloak.Object,
            _unitOfWork.Object);
    }

    [Fact]
    public async Task Handle_ManagerAssignsStaffOutsideCinema_ThrowsForbidden()
    {
        var staff = new User("staff-kc", "staff@cinema.com", "Staff");
        _users.Setup(repo => repo.GetByIdAsync(2, It.IsAny<CancellationToken>())).ReturnsAsync(staff);
        _keycloak.Setup(client => client.GetUserRealmRolesAsync("staff-kc", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { new("sid", "STAFF") });
        _assignments.Setup(repo => repo.ListCinemaIdsAsync(9, AssignmentDuty.MANAGER, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<long> { 1 });
        _assignments.Setup(repo => repo.ListByUserAsync(staff.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<CinemaAssignment>());

        var command = new ReplaceCinemaAssignmentsCommand(
            9,
            new[] { "MANAGER" },
            2,
            new[] { new CinemaAssignmentInput(2, "STAFF") });

        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<ForbiddenOperationException>();
    }

    [Fact]
    public async Task Handle_AdminAssignsManager_ReplacesRows()
    {
        var manager = new User("manager-kc", "manager@cinema.com", "Manager");
        _users.Setup(repo => repo.GetByIdAsync(3, It.IsAny<CancellationToken>())).ReturnsAsync(manager);
        _keycloak.Setup(client => client.GetUserRealmRolesAsync("manager-kc", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { new("mid", "MANAGER") });
        _assignments.Setup(repo => repo.ListByUserAsync(manager.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<CinemaAssignment>());

        var command = new ReplaceCinemaAssignmentsCommand(
            1,
            new[] { "ADMIN" },
            3,
            new[] { new CinemaAssignmentInput(4, "MANAGER") });

        var result = await _handler.Handle(command, CancellationToken.None);

        _assignments.Verify(repo => repo.Add(It.Is<CinemaAssignment>(row => row.CinemaId == 4 && row.Duty == AssignmentDuty.MANAGER)));
        result.Should().BeEmpty();
    }
}
