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

            var requestBody = new { roomIds = roomIds.ToList() };
            var response = await _httpClient.PostAsJsonAsync("/internal/showtimes/rooms/future-exists", requestBody, token);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<ApiResponse<bool>>(cancellationToken: token);
            return result?.Data ?? false;
        }
    }
    
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public T Data { get; set; }
    }

}
