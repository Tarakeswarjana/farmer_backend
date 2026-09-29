import { PAISE_PER_RUPEE } from '../constants/enums';
import { UnprocessableError } from './errors';

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new UnprocessableError('Amount must be a non-negative number');
  }
  const paise = Math.round(rupees * PAISE_PER_RUPEE);
  const decimals = rupees.toString().split('.')[1];
  if (decimals && decimals.length > 2) {
    throw new UnprocessableError('Amount supports at most 2 decimal places');
  }
  return paise;
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / PAISE_PER_RUPEE;
}

export function applyRateBps(amountPaise: number, rateBps: number): number {
  if (!Number.isInteger(amountPaise) || !Number.isInteger(rateBps)) {
    throw new UnprocessableError('Money calculations require integer minor units');
  }
  return Math.round((amountPaise * rateBps) / 10_000);
}

export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new UnprocessableError('Rate must be a non-negative number');
  }
  return Math.round(percent * 100);
}

export function bpsToPercent(bps: number): number {
  return Math.round(bps) / 100;
}

export interface OrderAmountsInput {
  quantity: number;
  unitPricePaise: number;
  commissionBps: number;
  transportChargePaise: number;
  taxBps: number;
  discountPaise: number;
}

export interface OrderAmounts {
  subtotalPaise: number;
  commissionPaise: number;
  transportChargePaise: number;
  taxPaise: number;
  discountPaise: number;
  totalAmountPaise: number;
}

export function calculateOrderAmounts(input: OrderAmountsInput): OrderAmounts {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new UnprocessableError('Quantity must be a positive integer');
  }
  if (input.unitPricePaise < 0 || input.transportChargePaise < 0 || input.discountPaise < 0) {
    throw new UnprocessableError('Money values cannot be negative');
  }
  const subtotalPaise = input.quantity * input.unitPricePaise;
  const commissionPaise = applyRateBps(subtotalPaise, input.commissionBps);
  const taxPaise = applyRateBps(subtotalPaise, input.taxBps);
  const totalAmountPaise =
    subtotalPaise + commissionPaise + input.transportChargePaise + taxPaise - input.discountPaise;
  if (totalAmountPaise < 0) {
    throw new UnprocessableError('Discount cannot exceed the order total');
  }
  return {
    subtotalPaise,
    commissionPaise,
    transportChargePaise: input.transportChargePaise,
    taxPaise,
    discountPaise: input.discountPaise,
    totalAmountPaise,
  };
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}
