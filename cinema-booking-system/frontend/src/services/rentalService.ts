import apiClient from '../lib/apiClient';
import {
  RentalCreateRequest,
  RentalQuote,
  RentalReport,
  RentalSearchParams,
  RentalView,
  RentalWindowRequest,
  RoomAvailability,
  RentalBucket,
} from '../types/rental';

interface RentalApiResponse<T> {
  success?: boolean;
  message?: string;
  data: T;
}

function unwrap<T>(response: any): T | null | undefined {
  if (response?.data && typeof response.data === 'object' && 'data' in response.data) {
    return response.data.data;
  }
  return response?.data;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function cleanParams<T extends Record<string, any>>(params?: T): Record<string, any> {
  if (!params) return {};
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function normalizeQuote(raw: any): RentalQuote {
  if (!raw) {
    return {
      roomId: 0,
      cinemaId: null,
      roomName: null,
      startTime: null,
      endTime: null,
      pricePerHour: null,
      billedHours: 0,
      totalAmount: null,
      available: false,
      unavailableCode: null,
    };
  }
  return {
    roomId: toNumber(raw.roomId, 0),
    cinemaId: raw.cinemaId != null ? toNumberOrNull(raw.cinemaId) : null,
    roomName: raw.roomName ?? null,
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    pricePerHour: toNumberOrNull(raw.pricePerHour),
    billedHours: toNumber(raw.billedHours, 0),
    totalAmount: toNumberOrNull(raw.totalAmount),
    available: Boolean(raw.available),
    unavailableCode: raw.unavailableCode ?? null,
  };
}

function normalizeRentalView(raw: any): RentalView {
  if (!raw) {
    return {
      id: 0,
      userId: 0,
      cinemaId: 0,
      roomId: 0,
      movieId: null,
      startTime: '',
      endTime: '',
      pricePerHour: 0,
      totalAmount: 0,
      status: 'PENDING_APPROVAL',
      paymentMethod: null,
      decisionReason: null,
      expiresAt: null,
      refundAmount: null,
      refundStatus: 'NONE',
    };
  }
  return {
    id: toNumber(raw.id, 0),
    userId: toNumber(raw.userId, 0),
    cinemaId: toNumber(raw.cinemaId, 0),
    roomId: toNumber(raw.roomId, 0),
    movieId: raw.movieId != null ? toNumberOrNull(raw.movieId) : null,
    startTime: raw.startTime ?? '',
    endTime: raw.endTime ?? '',
    pricePerHour: toNumber(raw.pricePerHour, 0),
    totalAmount: toNumber(raw.totalAmount, 0),
    status: raw.status ?? 'PENDING_APPROVAL',
    paymentMethod: raw.paymentMethod ?? null,
    decisionReason: raw.decisionReason ?? null,
    expiresAt: raw.expiresAt ?? null,
    refundAmount: toNumberOrNull(raw.refundAmount),
    refundStatus: raw.refundStatus ?? 'NONE',
  };
}

function normalizeAvailability(raw: any): RoomAvailability {
  if (!raw) {
    return {
      roomId: 0,
      from: '',
      to: '',
      pricePerHour: 0,
      busy: [],
    };
  }
  return {
    roomId: toNumber(raw.roomId, 0),
    from: raw.from ?? '',
    to: raw.to ?? '',
    pricePerHour: toNumber(raw.pricePerHour, 0),
    busy: Array.isArray(raw.busy)
      ? raw.busy.map((b: any) => ({
          source: (b.source ? String(b.source).toUpperCase() : 'RENTAL') as 'RENTAL' | 'SHOWTIME',
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
        }))
      : [],
  };
}

function normalizeBucket(raw: any): RentalBucket {
  return {
    key: String(raw?.key ?? ''),
    count: toNumber(raw?.count, 0),
    confirmedRevenue: toNumber(raw?.confirmedRevenue, 0),
  };
}

function normalizeReport(raw: any): RentalReport {
  if (!raw) {
    return {
      rentalCount: 0,
      confirmedRevenue: 0,
      byRoom: [],
      byDay: [],
    };
  }
  return {
    rentalCount: toNumber(raw.rentalCount, 0),
    confirmedRevenue: toNumber(raw.confirmedRevenue, 0),
    byRoom: Array.isArray(raw.byRoom) ? raw.byRoom.map(normalizeBucket) : [],
    byDay: Array.isArray(raw.byDay) ? raw.byDay.map(normalizeBucket) : [],
  };
}

export const rentalService = {
  quote: async (request: RentalWindowRequest): Promise<RentalQuote> => {
    const response = await apiClient.post<RentalApiResponse<RentalQuote>>('/rentals/quote', request);
    return normalizeQuote(unwrap<RentalQuote>(response));
  },

  create: async (request: RentalCreateRequest): Promise<RentalView> => {
    const response = await apiClient.post<RentalApiResponse<RentalView>>('/rentals', request);
    return normalizeRentalView(unwrap<RentalView>(response));
  },

  getMyRentals: async (): Promise<RentalView[]> => {
    const response = await apiClient.get<RentalApiResponse<RentalView[]>>('/rentals/me');
    const list = unwrap<any[]>(response) ?? [];
    return Array.isArray(list) ? list.map(normalizeRentalView) : [];
  },

  getRoomAvailability: async (roomId: number, from: string, to: string): Promise<RoomAvailability> => {
    const response = await apiClient.get<RentalApiResponse<RoomAvailability>>(
      `/rentals/rooms/${roomId}/availability`,
      { params: { from, to } }
    );
    return normalizeAvailability(unwrap<RoomAvailability>(response));
  },

  search: async (params?: RentalSearchParams): Promise<RentalView[]> => {
    const cleaned = cleanParams(params);
    const response = await apiClient.get<RentalApiResponse<RentalView[]>>('/rentals', {
      params: cleaned,
    });
    const list = unwrap<any[]>(response) ?? [];
    return Array.isArray(list) ? list.map(normalizeRentalView) : [];
  },

  getById: async (id: number): Promise<RentalView> => {
    const response = await apiClient.get<RentalApiResponse<RentalView>>(`/rentals/${id}`);
    return normalizeRentalView(unwrap<RentalView>(response));
  },

  approve: async (id: number): Promise<RentalView> => {
    const response = await apiClient.post<RentalApiResponse<RentalView>>(`/rentals/${id}/approve`);
    return normalizeRentalView(unwrap<RentalView>(response));
  },

  reject: async (id: number, reason: string): Promise<RentalView> => {
    const response = await apiClient.post<RentalApiResponse<RentalView>>(`/rentals/${id}/reject`, {
      reason,
    });
    return normalizeRentalView(unwrap<RentalView>(response));
  },

  pay: async (id: number, paymentMethod: string): Promise<RentalView> => {
    const response = await apiClient.post<RentalApiResponse<RentalView>>(`/rentals/${id}/pay`, {
      paymentMethod,
    });
    return normalizeRentalView(unwrap<RentalView>(response));
  },

  confirmOnlinePayment: async (id: number, paymentMethod: string): Promise<RentalView> => {
    const response = await apiClient.post<RentalApiResponse<RentalView>>(`/rentals/${id}/pay/confirm`, {
      paymentMethod,
    });
    return normalizeRentalView(unwrap<RentalView>(response));
  },

  payOnline: async (id: number, paymentMethod: string): Promise<RentalView> => {
    const rental = await rentalService.pay(id, paymentMethod);
    if (rental.status !== 'CONFIRMED') {
      return rentalService.confirmOnlinePayment(id, paymentMethod);
    }
    return rental;
  },

  cancel: async (id: number): Promise<RentalView> => {
    const response = await apiClient.post<RentalApiResponse<RentalView>>(`/rentals/${id}/cancel`);
    return normalizeRentalView(unwrap<RentalView>(response));
  },

  completeRefund: async (id: number): Promise<RentalView> => {
    const response = await apiClient.post<RentalApiResponse<RentalView>>(`/rentals/${id}/refunds/complete`);
    return normalizeRentalView(unwrap<RentalView>(response));
  },

  setRoomRate: async (roomId: number, pricePerHour: number): Promise<RentalQuote> => {
    const response = await apiClient.put<RentalApiResponse<RentalQuote>>(`/rentals/rates/${roomId}`, {
      pricePerHour,
    });
    return normalizeQuote(unwrap<RentalQuote>(response));
  },

  getReport: async (from?: string, to?: string): Promise<RentalReport> => {
    const cleaned = cleanParams({ from, to });
    const response = await apiClient.get<RentalApiResponse<RentalReport>>('/rentals/report', {
      params: cleaned,
    });
    return normalizeReport(unwrap<RentalReport>(response));
  },
};
export default rentalService;
