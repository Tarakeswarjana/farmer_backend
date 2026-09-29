import { s3Configured } from '../../config/env';
import type { StorageProvider } from '../../interfaces/storage-provider';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';

export function createStorageProvider(): StorageProvider {
  if (s3Configured) {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}
