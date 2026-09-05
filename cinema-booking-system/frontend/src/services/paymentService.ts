import apiClient from '../lib/apiClient';

export type PaymentMethod = 'STRIPE' | 'PAYPAL' | 'CASH';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface PaymentRequest {
  orderId: number;
  paymentMethod: PaymentMethod;
  amount: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResponse {
  transactionId: string;
  status: PaymentStatus;
  paymentUrl?: string;  // redirect for Stripe/PayPal
  paidAt?: string;
}

export const paymentService = {
  initiatePayment: (data: PaymentRequest) =>
    apiClient.post<PaymentResponse>('/payments', data).then(r => r.data),

  getPaymentStatus: (transactionId: string) =>
    apiClient.get<PaymentResponse>(`/payments/${transactionId}`).then(r => r.data),

  // Called on /checkout-success after external provider redirect (this should only handle paypal for now)
  verifyPaymentReturn: (queryParams: URLSearchParams, provider: 'paypal') =>
    apiClient.post<PaymentResponse>(
      `/payments/callback/${provider}/return`,
      Object.fromEntries(queryParams)
    ).then(r => r.data),
};
