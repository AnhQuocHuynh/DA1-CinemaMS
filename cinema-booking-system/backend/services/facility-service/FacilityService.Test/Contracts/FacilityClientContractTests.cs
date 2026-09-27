using System.IO;
using System.Threading.Tasks;
using Xunit;

namespace FacilityService.Test.Contracts
{
    public class FacilityClientContractTests
    {
        // Path relative to where the test DLL is executed (usually bin/Debug/net9.0/)
        // We traverse up to the backend/shared/contracts directory
        private static readonly string ShowtimeContractPath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "..", "..", "..", "..", "..", "..", "shared", "contracts", "showtime-service.openapi.yml"
        );

        [Fact]
        public async Task ShowtimeContract_ExposesInternalFutureExistsEndpoint_UsedByFacility()
        {
            // Arrange
            Assert.True(File.Exists(ShowtimeContractPath), $"Contract file not found at: {ShowtimeContractPath}");
            var contractContent = await File.ReadAllTextAsync(ShowtimeContractPath);

            // Act & Assert
            
            // 1. Verify the endpoint that FacilityService calls exists in the Showtime contract
            AssertContains(contractContent, "/internal/showtimes/rooms/future-exists:");
            
            // 2. Verify that Showtime requires the internal token for communication
            AssertContains(contractContent, "internalToken:");
            AssertContains(contractContent, "name: X-Internal-Token");
        }

        private static void AssertContains(string content, string expected)
        {
            Assert.True(content.Contains(expected), $"Missing contract fragment: {expected}");
        }
    }
}
