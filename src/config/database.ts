import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';
import '../models';

export async function connectDatabase(uri = env.mongoUri): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 15_000 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown MongoDB error';
    throw new Error(
      `MongoDB is not reachable at ${uri}. Start it with "docker compose up -d mongo redis mongo-init" and wait until mongo-init exits 0. Original error: ${reason}`,
    );
  }
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  logger.info({ event: 'MONGODB_CONNECTED' });
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function databaseStatus(): 'connected' | 'disconnected' {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}
