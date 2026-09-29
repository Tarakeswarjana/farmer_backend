import { razorpayConfigured, env } from '../../config/env';
import type { PaymentMethod, PaymentProviderName } from '../../constants/enums';
import type { PaymentProvider } from '../../interfaces/payment-provider';
import { BadRequestError } from '../../utils/errors';
import {
  CashPaymentProvider,
  ManualPaymentProvider,
  MockPaymentProvider,
  RazorpayPaymentProvider,
} from './providers';

export function createPaymentProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = [new CashPaymentProvider(), new ManualPaymentProvider()];
  if (razorpayConfigured) {
    providers.push(new RazorpayPaymentProvider(env.razorpay.keyId, env.razorpay.keySecret));
  } else {
    providers.push(new MockPaymentProvider());
  }
  return providers;
}

export function selectPaymentProvider(
  providers: PaymentProvider[],
  method: PaymentMethod,
  provider?: PaymentProviderName,
): PaymentProvider {
  if (method === 'RAZORPAY' && !razorpayConfigured && provider === 'RAZORPAY') {
    const mock = providers.find((item) => item.name === 'MOCK');
    if (mock) {
      return mock;
    }
  }
  const match = providers.find((item) => item.supports(method, provider));
  if (!match) {
    throw new BadRequestError('Unsupported payment method or provider');
  }
  return match;
}
