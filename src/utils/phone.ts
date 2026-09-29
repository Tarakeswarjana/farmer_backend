import { BadRequestError } from './errors';

export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  let local = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    local = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    local = digits.slice(1);
  }
  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new BadRequestError('Enter a valid Indian mobile number');
  }
  return local;
}

export function normalizeEmail(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  const email = input.trim().toLowerCase();
  return email.length > 0 ? email : undefined;
}
