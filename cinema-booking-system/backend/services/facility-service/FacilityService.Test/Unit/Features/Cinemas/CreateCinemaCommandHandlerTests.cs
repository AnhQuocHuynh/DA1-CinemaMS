using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Features.Cinemas.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Cinemas
{
    public class CreateCinemaCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly CreateCinemaCommandHandler _handler;

        public CreateCinemaCommandHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new CreateCinemaCommandHandler(_mockUnitOfWork.Object);
        }

        [Fact]
        public async Task Handle_ValidRequest_CreatesCinemaAndReturnsDto()
        {
            // Arrange
            var command = new CreateCinemaCommand
            {
                Name = "New Cinema",
                Address = "123 Main St",
                City = "City",
                Phone = "123"
            };

            _mockUnitOfWork.Setup(u => u.Cinemas.AddAsync(It.IsAny<Cinema>()))
                .Returns(Task.CompletedTask);

            _mockUnitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(1); // 1 row affected

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(command.Name, result.Name);
            Assert.Equal(command.Address, result.Address);
            Assert.Equal(command.City, result.City);
            Assert.Equal(command.Phone, result.Phone);

            _mockUnitOfWork.Verify(u => u.Cinemas.AddAsync(It.Is<Cinema>(c => c.Name == command.Name && c.Address == command.Address)), Times.Once);
            _mockUnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
