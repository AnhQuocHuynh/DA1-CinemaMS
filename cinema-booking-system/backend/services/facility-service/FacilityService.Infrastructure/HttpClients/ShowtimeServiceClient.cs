using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using FacilityService.Application.Contracts;

namespace FacilityService.Infrastructure.HttpClients
{
    public class ShowtimeServiceClient : IShowtimeServiceClient
    {
        private readonly HttpClient _httpClient;

        public ShowtimeServiceClient(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<bool> HasFutureShowtimesAsync(IEnumerable<long> roomIds, CancellationToken token = default)
        {
            if(roomIds == null || !roomIds.Any())
            {
                return false;
            }

            // var queryString = string.Join("&", roomIds.Select(id => $"roomIds={id}"));
            // var response = await _httpClient.GetAsync($"/api/internal/showtimes/check-active?{queryString}", token);
            // response.EnsureSuccessStatusCode();
            // var result = await response.Content.ReadFromJsonAsync<CheckActiveShowtimesResponse>(cancellationToken: token);
            // return result?.HasFutureShowtimes ?? false;

            // FAKE DATA FOR TESTING
            return await Task.FromResult(false);
        }
        // private record CheckActiveShowtimesResponse(bool HasFutureShowtimes);
    }

}
