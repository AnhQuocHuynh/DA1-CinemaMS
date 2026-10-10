import apiClient from '../lib/apiClient';

export interface EventResponse {
  id: number;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  venue: string;
  imageUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const eventService = {
  /** GET /events */
  getEvents: async (): Promise<EventResponse[]> => {
    const response = await apiClient.get<{ success: boolean; data: EventResponse[] }>('/events');
    return response.data?.data ?? [];
  },

  /** GET /events/all */
  getAllEvents: async (): Promise<EventResponse[]> => {
    const response = await apiClient.get<{ success: boolean; data: EventResponse[] }>('/events/all');
    return response.data?.data ?? [];
  },

  /** GET /events/{id} */
  getEventById: async (id: number | string): Promise<EventResponse> => {
    const response = await apiClient.get<{ success: boolean; data: EventResponse }>(`/events/${id}`);
    return response.data.data;
  },

  /** POST /events */
  createEvent: async (data: Omit<EventResponse, 'id' | 'createdAt' | 'updatedAt'> & { roomId: number; basePrice: number }): Promise<EventResponse> => {
    const response = await apiClient.post<{ success: boolean; data: EventResponse }>('/events', data);
    return response.data.data;
  },

  /** DELETE /events/{id} */
  deleteEvent: async (id: number | string): Promise<void> => {
    await apiClient.delete(`/events/${id}`);
  },
};
