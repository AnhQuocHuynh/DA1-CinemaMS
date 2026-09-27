using System.Net.Http.Json;
using System.Net.Http;
using System.Threading.Tasks;
using Xunit;
using FacilityService.Application.DTOs;
using System.Collections.Generic;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using System.Linq;

namespace FacilityService.Test.Integration.Features
{
    public class CachingIntegrationTests : IClassFixture<CustomWebApplicationFactory>
    {
        private readonly CustomWebApplicationFactory _factory;
        private readonly HttpClient _client;

        public CachingIntegrationTests(CustomWebApplicationFactory factory)
        {
            _factory = factory;
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task CreateCinema_InvalidatesCinemasListCache()
        {
            // Arrange
            var cache = _factory.Services.GetRequiredService<IDistributedCache>();
            var cacheKey = "facility:cinemas:all";

            // Act 1: Fetch cinemas to populate cache
            var getResponse1 = await _client.GetAsync("/api/cinemas");
            getResponse1.EnsureSuccessStatusCode();
            
            // Verify cache is populated
            var cachedData1 = await cache.GetStringAsync(cacheKey);
            Assert.NotNull(cachedData1);

            // Act 2: Create a new cinema
            var newCinema = new { Name = "Test Cinema Cache", Address = "123 Cache St", City = "Cache City" };
            
            // Add Authorization header for creating cinema
            var requestMessage = new HttpRequestMessage(HttpMethod.Post, "/api/cinemas");
            requestMessage.Headers.Add("Authorization", "Test user:ADMIN");
            requestMessage.Content = JsonContent.Create(newCinema);

            var createResponse = await _client.SendAsync(requestMessage);
            createResponse.EnsureSuccessStatusCode();

            // Assert: Cache should be invalidated (null)
            var cachedData2 = await cache.GetStringAsync(cacheKey);
            Assert.Null(cachedData2);

            // Act 3: Fetch again to repopulate cache with new data
            var getResponse2 = await _client.GetAsync("/api/cinemas");
            getResponse2.EnsureSuccessStatusCode();

            // Verify cache is populated again
            var cachedData3 = await cache.GetStringAsync(cacheKey);
            Assert.NotNull(cachedData3);
            
            // Verify new cinema is in the cached data
            var cinemas = JsonSerializer.Deserialize<List<CinemaDto>>(cachedData3, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            Assert.NotNull(cinemas);
            Assert.Contains(cinemas, c => c.Name == "Test Cinema Cache");
        }
    }
}
