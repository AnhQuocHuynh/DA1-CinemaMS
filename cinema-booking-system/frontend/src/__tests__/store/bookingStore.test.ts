import { describe, it, expect, beforeEach } from 'vitest';
import { useBookingStore } from '../../store/bookingStore';
import { Seat, BackendOrder } from '../../types/booking';

describe('useBookingStore', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    global.sessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) delete store[k];
      },
      key: (index: number) => Object.keys(store)[index] || null,
      length: 0,
    };
    useBookingStore.getState().clearSelection();
  });

  const mockSeat1: Seat = {
    id: 'seat-1',
    numericId: 101,
    label: 'A1',
    row: 'A',
    number: 1,
    status: 'available',
    type: 'standard',
    price: 80000,
    columnSpan: 1,
  };

  const mockSeat2: Seat = {
    id: 'seat-2',
    numericId: 102,
    label: 'A2',
    row: 'A',
    number: 2,
    status: 'available',
    type: 'standard',
    price: 80000,
    columnSpan: 1,
  };

  const mockOrder: BackendOrder = {
    id: 555,
    userId: 1,
    showtimeId: 10,
    seatIds: [101],
    movieTitle: 'Test Movie',
    displayTitle: 'Test Movie',
    cinemaName: 'Cinema 1',
    roomName: 'Hall 1',
    startTime: '2026-11-03T20:00:00Z',
    endTime: '2026-11-03T22:00:00Z',
    seatLabels: ['A1'],
    salesChannel: 'WEB',
    voucherId: null,
    totalAmount: '80000',
    discountAmount: '0',
    finalAmount: '80000',
    status: 'PENDING',
    paymentMethod: null,
    paymentTransactionId: null,
    tickets: [],
    createdAt: '2026-11-03T19:00:00Z',
    updatedAt: '2026-11-03T19:00:00Z',
  };

  it('resets pendingOrder when setSelectedSeats is invoked', () => {
    useBookingStore.getState().setPendingOrder(mockOrder);
    expect(useBookingStore.getState().pendingOrder).toEqual(mockOrder);

    useBookingStore.getState().setSelectedSeats([mockSeat1]);
    expect(useBookingStore.getState().selectedSeats).toEqual([mockSeat1]);
    expect(useBookingStore.getState().pendingOrder).toBeNull();
  });

  it('resets pendingOrder when toggleSeat adds a new seat', () => {
    useBookingStore.getState().setPendingOrder(mockOrder);
    expect(useBookingStore.getState().pendingOrder).toEqual(mockOrder);

    useBookingStore.getState().toggleSeat(mockSeat1);
    expect(useBookingStore.getState().selectedSeats.length).toBe(1);
    expect(useBookingStore.getState().pendingOrder).toBeNull();
  });

  it('resets pendingOrder when toggleSeat removes an existing seat', () => {
    useBookingStore.getState().setSelectedSeats([mockSeat1, mockSeat2]);
    useBookingStore.getState().setPendingOrder(mockOrder);
    expect(useBookingStore.getState().pendingOrder).toEqual(mockOrder);

    useBookingStore.getState().toggleSeat(mockSeat1);
    expect(useBookingStore.getState().selectedSeats.map((s) => s.id)).toEqual(['seat-2']);
    expect(useBookingStore.getState().pendingOrder).toBeNull();
  });

  it('enforces maximum 6 physical seats', () => {
    for (let i = 1; i <= 6; i++) {
      useBookingStore.getState().toggleSeat({
        id: `seat-${i}`,
        numericId: 100 + i,
        label: `A${i}`,
        row: 'A',
        number: i,
        status: 'available',
        type: 'standard',
        price: 80000,
        columnSpan: 1,
      });
    }

    expect(useBookingStore.getState().selectedSeats.length).toBe(6);

    expect(() => {
      useBookingStore.getState().toggleSeat({
        id: 'seat-7',
        numericId: 107,
        label: 'A7',
        row: 'A',
        number: 7,
        status: 'available',
        type: 'standard',
        price: 80000,
        columnSpan: 1,
      });
    }).toThrowError(/Booking limit exceeded/);
  });
});