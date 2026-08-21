using System;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Features.Cinemas.Queries;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Cinemas
{
    public class GetCinemaByIdQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly GetCinemaByIdQueryHandler _handler;

        public GetCinemaByIdQueryHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new GetCinemaByIdQueryHandler(_mockUnitOfWork.Object, new Mock<Microsoft.Extensions.Caching.Distributed.IDistributedCache>().Object);
        }

        [Fact]
        public async Task Handle_ValidId_ReturnsCinemaDto()
        {
            // Arrange
            var cinema = new Cinema("Test Name", "Test Address", "Test City", "123456789");
            
            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(1))
                .ReturnsAsync(cinema);

            var query = new GetCinemaByIdQuery { Id = 1 };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Test Name", result.Name);
            Assert.Equal("Test Address", result.Address);
            Assert.Equal("Test City", result.City);
            Assert.Equal("123456789", result.Phone);
        }

        [Fact]
        public async Task Handle_CinemaNotFound_ThrowsException()
        {
            // Arrange
            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(1))
                .ReturnsAsync((Cinema?)null);

            var query = new GetCinemaByIdQuery { Id = 1 };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<Application.Exceptions.CinemaNotFoundException>(() => _handler.Handle(query, CancellationToken.None));
            Assert.Contains("Cinema with id 1 was not found", ex.Message);
        }
    }
}

