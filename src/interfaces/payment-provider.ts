import type { PaymentMethod, PaymentProviderName } from '../constants/enums';

export interface CreateProviderPaymentInput {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  currency: string;
  method: PaymentMethod;
  customerPhone?: string;
}

export interface CreateProviderPaymentResult {
  provider: PaymentProviderName;
  providerOrderId: string;
  providerPayload: Record<string, string | number | boolean>;
}

export interface VerifyProviderPaymentInput {
  paymentId: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  signature?: string;
  amountPaise: number;
}

export interface RefundProviderPaymentInput {
  paymentId: string;
  providerPaymentId?: string;
  amountPaise: number;
  reason?: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  supports(method: PaymentMethod, provider?: PaymentProviderName): boolean;
  createPayment(input: CreateProviderPaymentInput): Promise<CreateProviderPaymentResult>;
  verifyPayment(input: VerifyProviderPaymentInput): Promise<boolean>;
  refund(input: RefundProviderPaymentInput): Promise<{ refundId: string }>;
}

export interface WebhookVerificationInput {
  rawBody: Buffer;
  signature?: string;
  providerHint?: string;
}

export interface ParsedWebhookEvent {
  eventId: string;
  paymentId: string;
  status: 'SUCCESS' | 'FAILED' | 'AUTHORIZED' | 'REFUNDED';
  providerPaymentId?: string;
  provider: PaymentProviderName;
}
