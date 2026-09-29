import type { PaymentMethod, PaymentProviderName } from '../../constants/enums';
import type {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  PaymentProvider,
  RefundProviderPaymentInput,
  VerifyProviderPaymentInput,
} from '../../interfaces/payment-provider';
import { randomId, signPayload } from '../../utils/crypto';
import { AppError } from '../../utils/errors';

export class CashPaymentProvider implements PaymentProvider {
  readonly name = 'CASH' as const;

  supports(method: PaymentMethod, provider?: PaymentProviderName): boolean {
    return method === 'CASH' && (!provider || provider === 'CASH');
  }

  async createPayment(input: CreateProviderPaymentInput): Promise<CreateProviderPaymentResult> {
    return {
      provider: 'CASH',
      providerOrderId: randomId('cash'),
      providerPayload: { method: 'CASH', amountPaise: input.amountPaise, currency: input.currency },
    };
  }

  async verifyPayment(_input: VerifyProviderPaymentInput): Promise<boolean> {
    return true;
  }

  async refund(input: RefundProviderPaymentInput): Promise<{ refundId: string }> {
    return { refundId: randomId(`cash_refund_${input.paymentId}`) };
  }
}

export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'MANUAL' as const;

  supports(method: PaymentMethod, provider?: PaymentProviderName): boolean {
    return (method === 'UPI' || method === 'BANK_TRANSFER') && (!provider || provider === 'MANUAL');
  }

  async createPayment(input: CreateProviderPaymentInput): Promise<CreateProviderPaymentResult> {
    return {
      provider: 'MANUAL',
      providerOrderId: randomId('manual'),
      providerPayload: { method: input.method, amountPaise: input.amountPaise, currency: input.currency },
    };
  }

  async verifyPayment(_input: VerifyProviderPaymentInput): Promise<boolean> {
    return true;
  }

  async refund(_input: RefundProviderPaymentInput): Promise<{ refundId: string }> {
    return { refundId: randomId('manual_refund') };
  }
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const;

  supports(method: PaymentMethod, provider?: PaymentProviderName): boolean {
    return method === 'RAZORPAY' && (!provider || provider === 'MOCK' || provider === 'RAZORPAY');
  }

  async createPayment(input: CreateProviderPaymentInput): Promise<CreateProviderPaymentResult> {
    const providerOrderId = randomId('mock_order');
    return {
      provider: 'MOCK',
      providerOrderId,
      providerPayload: {
        mock: true,
        orderId: providerOrderId,
        amountPaise: input.amountPaise,
        currency: input.currency,
        paymentId: input.paymentId,
      },
    };
  }

  async verifyPayment(input: VerifyProviderPaymentInput): Promise<boolean> {
    if (!input.providerPaymentId || !input.signature) {
      return false;
    }
    const expected = signPayload(`${input.paymentId}:${input.providerPaymentId}`);
    return expected === input.signature;
  }

  async refund(_input: RefundProviderPaymentInput): Promise<{ refundId: string }> {
    return { refundId: randomId('mock_refund') };
  }
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'RAZORPAY' as const;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
  ) {}

  supports(method: PaymentMethod, provider?: PaymentProviderName): boolean {
    return method === 'RAZORPAY' && (!provider || provider === 'RAZORPAY');
  }

  async createPayment(input: CreateProviderPaymentInput): Promise<CreateProviderPaymentResult> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.orderNumber.slice(0, 40),
        notes: { paymentId: input.paymentId, orderId: input.orderId },
      }),
    });
    if (!response.ok) {
      throw new AppError('Payment provider could not create the order', 502, 'PAYMENT_PROVIDER_ERROR');
    }
    const body = (await response.json()) as { id?: string };
    if (!body.id) {
      throw new AppError('Payment provider returned an unexpected response', 502, 'PAYMENT_PROVIDER_ERROR');
    }
    return {
      provider: 'RAZORPAY',
      providerOrderId: body.id,
      providerPayload: {
        keyId: this.keyId,
        orderId: body.id,
        amountPaise: input.amountPaise,
        currency: input.currency,
      },
    };
  }

  async verifyPayment(input: VerifyProviderPaymentInput): Promise<boolean> {
    if (!input.providerOrderId || !input.providerPaymentId || !input.signature) {
      return false;
    }
    const expected = signPayload(`${input.providerOrderId}|${input.providerPaymentId}`);
    return expected === input.signature;
  }

  async refund(input: RefundProviderPaymentInput): Promise<{ refundId: string }> {
    if (!input.providerPaymentId) {
      throw new AppError('Provider payment id is required for refund', 422, 'UNPROCESSABLE_ENTITY');
    }
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/payments/${input.providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: input.amountPaise }),
    });
    if (!response.ok) {
      throw new AppError('Payment provider could not refund the payment', 502, 'PAYMENT_PROVIDER_ERROR');
    }
    const body = (await response.json()) as { id?: string };
    return { refundId: body.id ?? randomId('rzp_refund') };
  }
}
