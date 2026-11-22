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

export interface CinemaRoomResponse {
  id: number;
  cinemaId: number;
  name: string;
  cinemaName?: string | null;
  type?: string | null;
  totalSeats?: number | null;
  rows?: number | null;
  columns?: number | null;
  active: boolean;
  underMaintenance: boolean;
}

export interface CinemaWithRoomsResponse extends CinemaResponse {
  rooms: CinemaRoomResponse[];
}

function normalizeCinema(raw: any): CinemaResponse {
  if (!raw) {
    return {
      id: 0,
      name: '',
      address: '',
      city: '',
      phone: '',
      active: false,
    };
  }

  const active =
    raw.active !== undefined
      ? Boolean(raw.active)
      : raw.isActive !== undefined
      ? Boolean(raw.isActive)
      : raw.status !== undefined
      ? raw.status === 'ACTIVE'
      : true;

  return {
    id: Number(raw.id ?? 0),
    name: raw.name ?? '',
    address: raw.address ?? '',
    city: raw.city ?? '',
    phone: raw.phone ?? '',
    active,
  };
}

function normalizeCinemaRoom(raw: any): CinemaRoomResponse {
  if (!raw) {
    return {
      id: 0,
      cinemaId: 0,
      name: '',
      active: false,
      underMaintenance: false,
    };
  }

  const active =
    raw.active !== undefined
      ? Boolean(raw.active)
      : raw.isActive !== undefined
      ? Boolean(raw.isActive)
      : raw.status !== undefined
      ? raw.status === 'ACTIVE'
      : true;

  const room: CinemaRoomResponse = {
    id: Number(raw.id ?? 0),
    cinemaId: Number(raw.cinemaId ?? 0),
    name: raw.name ?? '',
    active,
    underMaintenance: Boolean(raw.underMaintenance),
  };

  if (raw.cinemaName !== undefined) room.cinemaName = raw.cinemaName;
  if (raw.type !== undefined) room.type = raw.type;
  if (raw.totalSeats !== undefined) room.totalSeats = raw.totalSeats != null ? Number(raw.totalSeats) : null;
  if (raw.rows !== undefined) room.rows = raw.rows != null ? Number(raw.rows) : null;
  if (raw.columns !== undefined) room.columns = raw.columns != null ? Number(raw.columns) : null;

  return room;
}

export const cinemaService = {
  getCinemas: async (): Promise<CinemaResponse[]> => {
    const response = await apiClient.get<ApiResponse<CinemaResponse[]>>('/cinemas');
    const list = response.data?.data || [];
    return Array.isArray(list) ? list.map(normalizeCinema) : [];
  },

  getRoomsByCinema: async (cinemaId: number): Promise<CinemaRoomResponse[]> => {
    const response = await apiClient.get<ApiResponse<CinemaRoomResponse[]>>(`/cinemas/${cinemaId}/rooms`);
    const list = response.data?.data || [];
    return Array.isArray(list) ? list.map(normalizeCinemaRoom) : [];
  },

  getCinemasWithRooms: async (): Promise<CinemaWithRoomsResponse[]> => {
    const response = await apiClient.get<ApiResponse<CinemaWithRoomsResponse[]>>('/cinemas/with-rooms');
    const list = response.data?.data || [];
    return Array.isArray(list)
      ? list.map((c: any) => ({
          ...normalizeCinema(c),
          rooms: Array.isArray(c.rooms) ? c.rooms.map(normalizeCinemaRoom) : [],
        }))
      : [];
  },
};
