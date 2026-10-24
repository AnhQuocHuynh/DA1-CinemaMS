import apiClient from '../lib/apiClient';
import { ApiResponse } from '../types/auth';

export interface CinemaResponse {
  id: number;
  name: string;
  address: string;
  city: string;
  phone: string;
  active: boolean;
}

export const cinemaService = {
  getCinemas: async (): Promise<CinemaResponse[]> => {
    const response = await apiClient.get<ApiResponse<CinemaResponse[]>>('/cinemas');
    return response.data.data || [];
  },
};
