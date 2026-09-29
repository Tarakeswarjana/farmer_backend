import crypto from 'crypto';
import { env } from '../config/env';

function key(): Buffer {
  return crypto.createHash('sha256').update(env.jwt.accessSecret).digest();
}

export function encryptString(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptString(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    return '';
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskAccountNumber(accountNumber: string): string {
  const tail = accountNumber.slice(-4);
  return `${'*'.repeat(Math.max(accountNumber.length - 4, 4))}${tail}`;
}

export function hashValue(value: string): string {
  return crypto.createHmac('sha256', env.jwt.accessSecret).update(value).digest('hex');
}

export function randomOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function webhookSecret(): string {
  if (env.razorpay.keySecret) {
    return env.razorpay.keySecret;
  }
  if (env.isProduction) {
    return '';
  }
  return 'dev-webhook-secret';
}

export function signPayload(payload: string | Buffer): string {
  return crypto.createHmac('sha256', webhookSecret()).update(payload).digest('hex');
}

export function signaturesMatch(expected: string, presented: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(presented);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}
