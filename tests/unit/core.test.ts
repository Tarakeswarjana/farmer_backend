import { ConflictError } from '../../src/utils/errors';
import {
  applyRateBps,
  bpsToPercent,
  calculateOrderAmounts,
  median,
  paiseToRupees,
  percentToBps,
  rupeesToPaise,
} from '../../src/utils/money';
import { assertOrderTransition, canTransition, releasesInventory } from '../../src/utils/orderState';
import { buildMeta, buildSort, toPageQuery } from '../../src/utils/pagination';
import { decryptString, encryptString, maskAccountNumber, signaturesMatch, signPayload } from '../../src/utils/crypto';
import { escapeRegex, redactSensitive, stripOperatorKeys } from '../../src/utils/sanitize';
import { assertRadius, haversineMeters, toGeoPoint } from '../../src/utils/geo';
import { normalizePhone } from '../../src/utils/phone';

describe('money', () => {
  it('converts rupees to integer paise and rejects extra decimals', () => {
    expect(rupeesToPaise(28)).toBe(2800);
    expect(rupeesToPaise(28.5)).toBe(2850);
    expect(paiseToRupees(2800)).toBe(28);
    expect(() => rupeesToPaise(1.234)).toThrow('2 decimal');
    expect(() => rupeesToPaise(-1)).toThrow('non-negative');
  });

  it('calculates order totals in paise', () => {
    const amounts = calculateOrderAmounts({
      quantity: 10,
      unitPricePaise: 2800,
      commissionBps: 200,
      transportChargePaise: 5000,
      taxBps: 0,
      discountPaise: 100,
    });
    expect(amounts.subtotalPaise).toBe(28000);
    expect(amounts.commissionPaise).toBe(applyRateBps(28000, 200));
    expect(amounts.totalAmountPaise).toBe(28000 + 560 + 5000 - 100);
    expect(percentToBps(2.5)).toBe(250);
    expect(bpsToPercent(250)).toBe(2.5);
    expect(() => calculateOrderAmounts({
      quantity: 1,
      unitPricePaise: 100,
      commissionBps: 0,
      transportChargePaise: 0,
      taxBps: 0,
      discountPaise: 500,
    })).toThrow('Discount');
  });

  it('returns the median price', () => {
    expect(median([])).toBe(0);
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 40])).toBe(25);
  });
});

describe('order transitions', () => {
  it('allows the delivery lifecycle and blocks jumps', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('PENDING', 'PENDING')).toBe(true);
    expect(canTransition('PENDING', 'DELIVERED')).toBe(false);
    expect(releasesInventory('CONFIRMED')).toBe(true);
    expect(releasesInventory('PICKED_UP')).toBe(false);
    expect(() => assertOrderTransition('COMPLETED', 'CANCELLED')).toThrow(ConflictError);
  });
});

describe('pagination and sanitizing', () => {
  it('caps the page size and ignores unknown sort fields', () => {
    expect(toPageQuery({ page: 2, limit: 500 }).limit).toBe(100);
    expect(toPageQuery({}).skip).toBe(0);
    expect(buildMeta(1, 20, 0).totalPages).toBe(0);
    expect(buildMeta(1, 20, 21).totalPages).toBe(2);
    expect(buildSort('$where', 'asc', ['createdAt', 'name'], 'createdAt')).toEqual({ createdAt: 1 });
    expect(buildSort('name', 'desc', ['name'], 'createdAt')).toEqual({ name: -1 });
  });

  it('strips operator keys and escapes search text', () => {
    expect(escapeRegex('tomato (a+)')).toBe('tomato \\(a\\+\\)');
    expect(stripOperatorKeys({ $gt: 1, name: 'Rabi', nested: { $where: 'x', ok: 1 } })).toEqual({
      name: 'Rabi',
      nested: { ok: 1 },
    });
    expect(redactSensitive({ password: 'secret', name: 'Rabi' })).toEqual({ password: '[REDACTED]', name: 'Rabi' });
  });
});

describe('crypto and phone', () => {
  it('encrypts bank data and compares webhook signatures', () => {
    const encrypted = encryptString('1234567890');
    expect(decryptString(encrypted)).toBe('1234567890');
    expect(decryptString('bad')).toBe('');
    expect(maskAccountNumber('1234567890')).toBe('******7890');
    const signature = signPayload('payload');
    expect(signaturesMatch(signature, signature)).toBe(true);
    expect(signaturesMatch(signature, 'nope')).toBe(false);
  });

  it('normalizes Indian mobile numbers', () => {
    expect(normalizePhone('+91 98100 00001')).toBe('9810000001');
    expect(normalizePhone('09810000001')).toBe('9810000001');
    expect(() => normalizePhone('12345')).toThrow('Indian mobile');
  });
});

describe('geo', () => {
  it('builds a GeoJSON point and rejects an excessive radius', () => {
    expect(toGeoPoint(88.48, 22.72)).toEqual({ type: 'Point', coordinates: [88.48, 22.72] });
    expect(assertRadius(20000)).toBe(20000);
    expect(haversineMeters([88.48, 22.72], [88.48, 22.72])).toBe(0);
    expect(() => assertRadius(500_000)).toThrow();
    expect(() => toGeoPoint(200, 0)).toThrow();
  });
});
