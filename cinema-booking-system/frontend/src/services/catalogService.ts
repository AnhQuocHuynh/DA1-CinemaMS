// TODO: Migrate to src/lib/apiClient.ts
import apiClient from './authService';
import { MovieResponse } from './movieService';
import { EventResponse } from './eventService';

export interface CatalogSearchResponse {
  movies: MovieResponse[];
  events: EventResponse[];
  movieTotalPages: number;
  eventTotalPages: number;
  movieTotalElements: number;
  eventTotalElements: number;
}

export const catalogService = {
  /** GET /catalog/search */
  search: async (params?: { keyword?: string; genreId?: number; fromDate?: string; toDate?: string; page?: number; size?: number }): Promise<CatalogSearchResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.keyword) searchParams.append('keyword', params.keyword);
    if (params?.genreId) searchParams.append('genreId', params.genreId.toString());
    if (params?.fromDate) searchParams.append('fromDate', params.fromDate);
    if (params?.toDate) searchParams.append('toDate', params.toDate);
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.size !== undefined) searchParams.append('size', params.size.toString());

    const response = await apiClient.get<{ success: boolean; data: CatalogSearchResponse }>(`/catalog/search?${searchParams.toString()}`);
    return response.data.data;
  },
};
