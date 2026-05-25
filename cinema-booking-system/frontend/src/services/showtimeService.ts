// Showtime Service
export const showtimeService = {
  getShowtimes: async (movieId: number) => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/showtimes/movie/${movieId}`);
    // return response.data;

    console.log('🕐 [SHOWTIME] Fetching showtimes for movie:', movieId);
    const mockShowtimes = [
      { id: 1, time: '10:00 AM', format: '2D', price: 200000 },
      { id: 2, time: '1:30 PM', format: 'IMAX', price: 300000 },
      { id: 3, time: '5:00 PM', format: '2D', price: 200000 },
      { id: 4, time: '8:30 PM', format: 'IMAX', price: 300000 },
    ];
    console.log('✅ [SHOWTIME] Showtimes fetched:', mockShowtimes);
    return mockShowtimes;
  },
};
