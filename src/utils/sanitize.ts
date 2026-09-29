const SENSITIVE_KEYS = new Set([
  'password',
  'refreshToken',
  'accessToken',
  'otp',
  'debugCode',
  'code',
  'bankDetails',
  'accountNumber',
  'accountNumberEncrypted',
  'ifsc',
  'authorization',
  'token',
  'signature',
  'file',
]);

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = redactSensitive(nested);
  }
  return output;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripOperatorKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripOperatorKeys(item));
  }
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    output[key] = stripOperatorKeys(nested);
  }
  return output;
}
