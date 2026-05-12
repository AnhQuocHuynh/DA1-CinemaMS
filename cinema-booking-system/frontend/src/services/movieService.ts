// Movie Service
export const movieService = {
  getMovies: async () => {
    // TODO: Uncomment for real implementation
    // const response = await axios.get(`${API_BASE_URL}/movies`);
    // return response.data;

    console.log('🎬 [MOVIE] Fetching movies...');
    const mockMovies = [
      { id: 1, title: 'Interstellar', genre: 'Sci-Fi', rating: 8.6, poster: 'https://via.placeholder.com/300x400?text=Interstellar' },
      { id: 2, title: 'The Dark Knight', genre: 'Action', rating: 9.0, poster: 'https://via.placeholder.com/300x400?text=Dark+Knight' },
      { id: 3, title: 'Inception', genre: 'Sci-Fi', rating: 8.8, poster: 'https://via.placeholder.com/300x400?text=Inception' },
    ];
    console.log('✅ [MOVIE] Movies fetched:', mockMovies);
    return mockMovies;
  },

  getMovieById: async (id: number) => {
    console.log('🎬 [MOVIE] Fetching movie:', id);
    const mockMovie = {
      id,
      title: 'Sample Movie',
      genre: 'Action',
      rating: 8.5,
      description: 'A thrilling movie experience',
      poster: 'https://via.placeholder.com/300x400?text=Movie',
      runtime: 148,
    };
    console.log('✅ [MOVIE] Movie fetched:', mockMovie);
    return mockMovie;
  },
};
