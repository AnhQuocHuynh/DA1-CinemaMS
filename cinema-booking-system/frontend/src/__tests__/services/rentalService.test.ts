import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '../../lib/apiClient';
import rentalService from '../../services/rentalService';
import {
  RentalCreateRequest,
  RentalWindowRequest,
} from '../../types/rental';

vi.mock('../../lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('rentalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quote', () => {
    it('calls POST /rentals/quote and normalizes BigDecimal strings to numbers', async () => {
      const mockRequest: RentalWindowRequest = {
        roomId: 1,
        movieId: 5,
        startTime: '2026-11-10T10:00:00Z',
        endTime: '2026-11-10T12:00:00Z',
      };

      const mockApiResponse = {
        data: {
          success: true,
          data: {
            roomId: '1',
            cinemaId: '10',
            roomName: 'Hall 1',
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: '250000.50',
            billedHours: '2',
            totalAmount: '500001.00',
            available: true,
            unavailableCode: null,
          },
        },
      };

      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockApiResponse);

      const result = await rentalService.quote(mockRequest);

      expect(apiClient.post).toHaveBeenCalledWith('/rentals/quote', mockRequest);
      expect(result).toEqual({
        roomId: 1,
        cinemaId: 10,
        roomName: 'Hall 1',
        startTime: '2026-11-10T10:00:00Z',
        endTime: '2026-11-10T12:00:00Z',
        pricePerHour: 250000.5,
        billedHours: 2,
        totalAmount: 500001,
        available: true,
        unavailableCode: null,
      });
    });

    it('handles null / missing fields in quote response gracefully', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            roomId: 2,
            cinemaId: null,
            roomName: null,
            startTime: null,
            endTime: null,
            pricePerHour: null,
            billedHours: null,
            totalAmount: null,
            available: false,
            unavailableCode: 'ROOM_RATE_MISSING',
          },
        },
      });

      const result = await rentalService.quote({
        roomId: 2,
        startTime: '2026-11-10T10:00:00Z',
        endTime: '2026-11-10T12:00:00Z',
      });

      expect(result.pricePerHour).toBeNull();
      expect(result.totalAmount).toBeNull();
      expect(result.billedHours).toBe(0);
      expect(result.available).toBe(false);
      expect(result.unavailableCode).toBe('ROOM_RATE_MISSING');
    });

    it('propagates API rejection error', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network Error'));

      await expect(
        rentalService.quote({
          roomId: 1,
          startTime: '2026-11-10T10:00:00Z',
          endTime: '2026-11-10T12:00:00Z',
        })
      ).rejects.toThrow('Network Error');
    });
  });

  describe('create', () => {
    it('calls POST /rentals and returns normalized RentalView', async () => {
      const request: RentalCreateRequest = {
        roomId: 1,
        movieId: null,
        startTime: '2026-11-10T14:00:00Z',
        endTime: '2026-11-10T16:00:00Z',
        userId: 100,
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            id: '50',
            userId: '100',
            cinemaId: '5',
            roomId: '1',
            movieId: null,
            startTime: '2026-11-10T14:00:00Z',
            endTime: '2026-11-10T16:00:00Z',
            pricePerHour: '300000',
            totalAmount: '600000',
            status: 'PENDING_APPROVAL',
            paymentMethod: null,
            decisionReason: null,
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      };

      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

      const result = await rentalService.create(request);

      expect(apiClient.post).toHaveBeenCalledWith('/rentals', request);
      expect(result.id).toBe(50);
      expect(result.userId).toBe(100);
      expect(result.pricePerHour).toBe(300000);
      expect(result.totalAmount).toBe(600000);
      expect(result.status).toBe('PENDING_APPROVAL');
    });

    it('propagates error when create fails', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Validation error'));

      await expect(
        rentalService.create({
          roomId: 1,
          startTime: '2026-11-10T14:00:00Z',
          endTime: '2026-11-10T16:00:00Z',
        })
      ).rejects.toThrow('Validation error');
    });
  });

  describe('getMyRentals', () => {
    it('calls GET /rentals/me and normalizes list', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: [
            {
              id: '1',
              userId: '10',
              cinemaId: '2',
              roomId: '3',
              movieId: '7',
              startTime: '2026-11-10T10:00:00Z',
              endTime: '2026-11-10T12:00:00Z',
              pricePerHour: '200000',
              totalAmount: '400000',
              status: 'CONFIRMED',
              paymentMethod: 'VNPAY',
              decisionReason: null,
              expiresAt: null,
              refundAmount: '0',
              refundStatus: 'NONE',
            },
          ],
        },
      });

      const result = await rentalService.getMyRentals();

      expect(apiClient.get).toHaveBeenCalledWith('/rentals/me');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].movieId).toBe(7);
      expect(result[0].totalAmount).toBe(400000);
    });

    it('returns empty array when response data is empty or null', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { data: null },
      });

      const result = await rentalService.getMyRentals();
      expect(result).toEqual([]);
    });

    it('propagates error on failure', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(rentalService.getMyRentals()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getRoomAvailability', () => {
    it('calls GET /rentals/rooms/{roomId}/availability with from and to params', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            roomId: '5',
            from: '2026-11-10T00:00:00Z',
            to: '2026-11-10T23:59:59Z',
            pricePerHour: '180000',
            busy: [
              {
                source: 'RENTAL',
                startTime: '2026-11-10T10:00:00Z',
                endTime: '2026-11-10T12:00:00Z',
                status: 'CONFIRMED',
              },
              {
                source: 'SHOWTIME',
                startTime: '2026-11-10T14:00:00Z',
                endTime: '2026-11-10T16:00:00Z',
                status: 'SCHEDULED',
              },
            ],
          },
        },
      });

      const result = await rentalService.getRoomAvailability(5, '2026-11-10T00:00:00Z', '2026-11-10T23:59:59Z');

      expect(apiClient.get).toHaveBeenCalledWith('/rentals/rooms/5/availability', {
        params: { from: '2026-11-10T00:00:00Z', to: '2026-11-10T23:59:59Z' },
      });
      expect(result.roomId).toBe(5);
      expect(result.pricePerHour).toBe(180000);
      expect(result.busy).toHaveLength(2);
      expect(result.busy[0].source).toBe('RENTAL');
    });

    it('handles empty/null data gracefully', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { data: null } });

      const result = await rentalService.getRoomAvailability(5, '2026-11-10T00:00:00Z', '2026-11-10T23:59:59Z');
      expect(result.roomId).toBe(0);
      expect(result.pricePerHour).toBe(0);
      expect(result.busy).toEqual([]);
    });
  });

  describe('search', () => {
    it('strips undefined, null, and empty string params', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { data: [] },
      });

      await rentalService.search({
        cinemaId: 3,
        roomId: undefined,
        status: 'CONFIRMED',
        from: '',
        userId: 42,
      });

      expect(apiClient.get).toHaveBeenCalledWith('/rentals', {
        params: {
          cinemaId: 3,
          status: 'CONFIRMED',
          userId: 42,
        },
      });
    });

    it('calls GET /rentals with empty params when params is omitted', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { data: [] },
      });

      const result = await rentalService.search();

      expect(apiClient.get).toHaveBeenCalledWith('/rentals', { params: {} });
      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('calls GET /rentals/{id} and returns normalized RentalView', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 88,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: '200000',
            totalAmount: '400000',
            status: 'AWAITING_PAYMENT',
            paymentMethod: null,
            decisionReason: null,
            expiresAt: '2026-11-10T11:00:00Z',
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      const result = await rentalService.getById(88);

      expect(apiClient.get).toHaveBeenCalledWith('/rentals/88');
      expect(result.id).toBe(88);
      expect(result.status).toBe('AWAITING_PAYMENT');
    });
  });

  describe('approve', () => {
    it('calls POST /rentals/{id}/approve and returns approved view', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 12,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: 200000,
            totalAmount: 400000,
            status: 'AWAITING_PAYMENT',
            paymentMethod: null,
            decisionReason: null,
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      const result = await rentalService.approve(12);

      expect(apiClient.post).toHaveBeenCalledWith('/rentals/12/approve');
      expect(result.id).toBe(12);
      expect(result.status).toBe('AWAITING_PAYMENT');
    });
  });

  describe('reject', () => {
    it('calls POST /rentals/{id}/reject with reason and returns rejected view', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 12,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: 200000,
            totalAmount: 400000,
            status: 'REJECTED',
            paymentMethod: null,
            decisionReason: 'Maintenance required',
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      const result = await rentalService.reject(12, 'Maintenance required');

      expect(apiClient.post).toHaveBeenCalledWith('/rentals/12/reject', {
        reason: 'Maintenance required',
      });
      expect(result.status).toBe('REJECTED');
      expect(result.decisionReason).toBe('Maintenance required');
    });
  });

  describe('pay and confirmOnlinePayment', () => {
    it('pay calls POST /rentals/{id}/pay with paymentMethod', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 15,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: 200000,
            totalAmount: 400000,
            status: 'CONFIRMED',
            paymentMethod: 'CASH',
            decisionReason: null,
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      const result = await rentalService.pay(15, 'CASH');

      expect(apiClient.post).toHaveBeenCalledWith('/rentals/15/pay', {
        paymentMethod: 'CASH',
      });
      expect(result.status).toBe('CONFIRMED');
      expect(result.paymentMethod).toBe('CASH');
    });

    it('confirmOnlinePayment calls POST /rentals/{id}/pay/confirm with paymentMethod', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 15,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: 200000,
            totalAmount: 400000,
            status: 'CONFIRMED',
            paymentMethod: 'VNPAY',
            decisionReason: null,
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      const result = await rentalService.confirmOnlinePayment(15, 'VNPAY');

      expect(apiClient.post).toHaveBeenCalledWith('/rentals/15/pay/confirm', {
        paymentMethod: 'VNPAY',
      });
      expect(result.status).toBe('CONFIRMED');
    });
  });

  describe('payOnline', () => {
    it('executes two-step flow when pay returns status !== CONFIRMED', async () => {
      // Step 1: pay returns AWAITING_PAYMENT
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 20,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: 200000,
            totalAmount: 400000,
            status: 'AWAITING_PAYMENT',
            paymentMethod: 'MOMO',
            decisionReason: null,
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      // Step 2: pay/confirm returns CONFIRMED
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 20,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: 200000,
            totalAmount: 400000,
            status: 'CONFIRMED',
            paymentMethod: 'MOMO',
            decisionReason: null,
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      const result = await rentalService.payOnline(20, 'MOMO');

      expect(apiClient.post).toHaveBeenNthCalledWith(1, '/rentals/20/pay', {
        paymentMethod: 'MOMO',
      });
      expect(apiClient.post).toHaveBeenNthCalledWith(2, '/rentals/20/pay/confirm', {
        paymentMethod: 'MOMO',
      });
      expect(result.status).toBe('CONFIRMED');
    });

    it('returns immediately without confirm step when pay returns CONFIRMED directly', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 25,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: 200000,
            totalAmount: 400000,
            status: 'CONFIRMED',
            paymentMethod: 'CASH',
            decisionReason: null,
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      const result = await rentalService.payOnline(25, 'CASH');

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith('/rentals/25/pay', {
        paymentMethod: 'CASH',
      });
      expect(result.status).toBe('CONFIRMED');
    });
  });

  describe('cancel and completeRefund', () => {
    it('cancel calls POST /rentals/{id}/cancel', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 30,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: 200000,
            totalAmount: 400000,
            status: 'CANCELLED',
            paymentMethod: null,
            decisionReason: null,
            expiresAt: null,
            refundAmount: null,
            refundStatus: 'NONE',
          },
        },
      });

      const result = await rentalService.cancel(30);

      expect(apiClient.post).toHaveBeenCalledWith('/rentals/30/cancel');
      expect(result.status).toBe('CANCELLED');
    });

    it('completeRefund calls POST /rentals/{id}/refunds/complete and normalizes refund fields', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            id: 30,
            userId: 1,
            cinemaId: 2,
            roomId: 3,
            movieId: null,
            startTime: '2026-11-10T10:00:00Z',
            endTime: '2026-11-10T12:00:00Z',
            pricePerHour: '200000',
            totalAmount: '400000',
            status: 'CANCELLED',
            paymentMethod: 'VNPAY',
            decisionReason: null,
            expiresAt: null,
            refundAmount: '400000.00',
            refundStatus: 'COMPLETED',
          },
        },
      });

      const result = await rentalService.completeRefund(30);

      expect(apiClient.post).toHaveBeenCalledWith('/rentals/30/refunds/complete');
      expect(result.refundAmount).toBe(400000);
      expect(result.refundStatus).toBe('COMPLETED');
    });
  });

  describe('setRoomRate', () => {
    it('calls PUT /rentals/rates/{roomId} with pricePerHour and normalizes response quote', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            roomId: 5,
            cinemaId: 1,
            roomName: 'Hall 5',
            startTime: null,
            endTime: null,
            pricePerHour: '350000.00',
            billedHours: 0,
            totalAmount: null,
            available: true,
            unavailableCode: null,
          },
        },
      });

      const result = await rentalService.setRoomRate(5, 350000);

      expect(apiClient.put).toHaveBeenCalledWith('/rentals/rates/5', {
        pricePerHour: 350000,
      });
      expect(result.roomId).toBe(5);
      expect(result.pricePerHour).toBe(350000);
    });
  });

  describe('getReport', () => {
    it('calls GET /rentals/report with cleaned date params and normalizes buckets', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          data: {
            rentalCount: '15',
            confirmedRevenue: '12500000.00',
            byRoom: [
              { key: 'Room A', count: '10', confirmedRevenue: '8000000.00' },
              { key: 'Room B', count: '5', confirmedRevenue: '4500000.00' },
            ],
            byDay: [
              { key: '2026-11-01', count: '7', confirmedRevenue: '6000000.00' },
              { key: '2026-11-02', count: '8', confirmedRevenue: '6500000.00' },
            ],
          },
        },
      });

      const result = await rentalService.getReport('2026-11-01T00:00:00Z', '2026-11-02T23:59:59Z');

      expect(apiClient.get).toHaveBeenCalledWith('/rentals/report', {
        params: {
          from: '2026-11-01T00:00:00Z',
          to: '2026-11-02T23:59:59Z',
        },
      });
      expect(result.rentalCount).toBe(15);
      expect(result.confirmedRevenue).toBe(12500000);
      expect(result.byRoom).toHaveLength(2);
      expect(result.byRoom[0]).toEqual({ key: 'Room A', count: 10, confirmedRevenue: 8000000 });
      expect(result.byDay).toHaveLength(2);
      expect(result.byDay[1]).toEqual({ key: '2026-11-02', count: 8, confirmedRevenue: 6500000 });
    });

    it('strips empty or undefined from and to params', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { data: null },
      });

      const result = await rentalService.getReport('', undefined);

      expect(apiClient.get).toHaveBeenCalledWith('/rentals/report', {
        params: {},
      });
      expect(result.rentalCount).toBe(0);
      expect(result.confirmedRevenue).toBe(0);
      expect(result.byRoom).toEqual([]);
      expect(result.byDay).toEqual([]);
    });
  });
});

