using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.DTOs;
using FacilityService.Application.Features.Cinemas.Queries;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Cinemas
{
    public class GetCinemasQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly GetCinemasQueryHandler _handler;

        public GetCinemasQueryHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new GetCinemasQueryHandler(_mockUnitOfWork.Object, new Mock<Microsoft.Extensions.Caching.Distributed.IDistributedCache>().Object);
        }

        [Fact]
        public async Task Handle_ReturnsOnlyActiveCinemasMappedToDto()
        {
            // Arrange
            var activeCinema = new Cinema("Active", "Addr", null, null);
            var inactiveCinema = new Cinema("Inactive", "Addr", null, null);
            inactiveCinema.Disable();
            // Need to set Id via reflection or mock if required, but for this test we'll just check counting and fields.

            _mockUnitOfWork.Setup(u => u.Cinemas.GetAllAsync())
                .ReturnsAsync(new List<Cinema> { activeCinema, inactiveCinema });

            var query = new GetCinemasQuery();

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result);
            Assert.Equal("Active", result.First().Name);
        }
    }
}

