import bcrypt from 'bcryptjs';
import { env } from '../config/env';

const ROUNDS = env.isTest ? 4 : 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
