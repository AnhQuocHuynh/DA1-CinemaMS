import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '../../lib/apiClient';
import {
  cinemaService,
  CinemaResponse,
  CinemaRoomResponse,
  CinemaWithRoomsResponse,
} from '../../services/cinemaService';

vi.mock('../../lib/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('cinemaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCinemas', () => {
    it('calls GET /cinemas and returns cinemas list on success', async () => {
      const mockCinemas: CinemaResponse[] = [
        {
          id: 1,
          name: 'Cinema Central',
          address: '123 Main St',
          city: 'Ho Chi Minh',
          phone: '0123456789',
          active: true,
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockCinemas },
      });

      const result = await cinemaService.getCinemas();

      expect(apiClient.get).toHaveBeenCalledWith('/cinemas');
      expect(result).toEqual(mockCinemas);
    });

    it('normalizes isActive and status field variants to boolean active property', async () => {
      const mockRaw = [
        { id: 1, name: 'Cinema A', address: '123 A', city: 'HCM', phone: '111', isActive: true },
        { id: 2, name: 'Cinema B', address: '456 B', city: 'HN', phone: '222', status: 'ACTIVE' },
        { id: 3, name: 'Cinema C', address: '789 C', city: 'DN', phone: '333', active: false },
        { id: 4, name: 'Cinema D', address: '999 D', city: 'CT', phone: '444', status: 'INACTIVE' },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockRaw },
      });

      const result = await cinemaService.getCinemas();

      expect(result).toHaveLength(4);
      expect(result[0].active).toBe(true);
      expect(result[1].active).toBe(true);
      expect(result[2].active).toBe(false);
      expect(result[3].active).toBe(false);
    });

    it('returns empty array when response data is null/undefined', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: null },
      });

      const result = await cinemaService.getCinemas();
      expect(result).toEqual([]);
    });

    it('propagates error when API call fails', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      await expect(cinemaService.getCinemas()).rejects.toThrow('Network error');
    });
  });

  describe('getRoomsByCinema', () => {
    it('calls GET /cinemas/{cinemaId}/rooms and returns rooms list', async () => {
      const mockRooms: CinemaRoomResponse[] = [
        {
          id: 101,
          cinemaId: 1,
          name: 'Screen 1',
          cinemaName: 'Cinema Central',
          type: '2D',
          totalSeats: 120,
          rows: 10,
          columns: 12,
          active: true,
          underMaintenance: false,
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockRooms },
      });

      const result = await cinemaService.getRoomsByCinema(1);

      expect(apiClient.get).toHaveBeenCalledWith('/cinemas/1/rooms');
      expect(result).toEqual(mockRooms);
    });

    it('returns empty array when response data is null/undefined', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {},
      });

      const result = await cinemaService.getRoomsByCinema(1);
      expect(result).toEqual([]);
    });

    it('propagates error when API call fails', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Failed to fetch rooms'));

      await expect(cinemaService.getRoomsByCinema(99)).rejects.toThrow('Failed to fetch rooms');
    });
  });

  describe('getCinemasWithRooms', () => {
    it('calls GET /cinemas/with-rooms and returns cinemas with rooms', async () => {
      const mockData: CinemaWithRoomsResponse[] = [
        {
          id: 1,
          name: 'Cinema Central',
          address: '123 Main St',
          city: 'Ho Chi Minh',
          phone: '0123456789',
          active: true,
          rooms: [
            {
              id: 101,
              cinemaId: 1,
              name: 'Screen 1',
              type: 'IMAX',
              totalSeats: 200,
              rows: 10,
              columns: 20,
              active: true,
              underMaintenance: false,
            },
          ],
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockData },
      });

      const result = await cinemaService.getCinemasWithRooms();

      expect(apiClient.get).toHaveBeenCalledWith('/cinemas/with-rooms');
      expect(result).toEqual(mockData);
    });

    it('returns empty array when response data is null/undefined', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { data: null },
      });

      const result = await cinemaService.getCinemasWithRooms();
      expect(result).toEqual([]);
    });

    it('propagates error when API call fails', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Server error'));

      await expect(cinemaService.getCinemasWithRooms()).rejects.toThrow('Server error');
    });
  });
});

