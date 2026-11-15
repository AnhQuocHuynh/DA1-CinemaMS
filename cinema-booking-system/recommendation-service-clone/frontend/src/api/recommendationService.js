import { apiFetch } from "./fetchConfig";

function mapRecommendation(row) {
  return {
    movieId: row?.movieId || row?.movie_id || null,
    title: row?.title || "",
    posterUrl: row?.posterUrl || row?.poster_url || "",
    predictedRating: Number(row?.predictedRating ?? row?.predicted_rating ?? 0),
    uncertaintyScore: Number(row?.uncertaintyScore ?? row?.uncertainty_score ?? 0),
    nearestMovieId: row?.nearestMovieId || row?.nearest_movie_id || null,
    nearestMovieTitle: row?.nearestMovieTitle || row?.nearest_movie_title || null,
    nearestMoviePosterUrl: row?.nearestMoviePosterUrl || row?.nearest_movie_poster_url || null,
  };
}

export async function getTopKRecommendations(k = 5) {
  const safeK = Number.isFinite(Number(k)) ? Math.max(1, Number(k)) : 5;
  const res = await apiFetch(`/recommendations/top-k?k=${safeK}`);
  const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  return data.map(mapRecommendation);
}
