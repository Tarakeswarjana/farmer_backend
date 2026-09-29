import fs from 'fs/promises';
import path from 'path';
import type { StorageProvider, StoredObject, UploadObjectInput } from '../../interfaces/storage-provider';
import { randomId } from '../../utils/crypto';
import { NotFoundError } from '../../utils/errors';

function extension(fileName: string, mimeType: string): string {
  const fromName = path.extname(fileName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(fromName)) {
    return fromName === '.jpeg' ? '.jpg' : fromName;
  }
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'application/pdf') return '.pdf';
  return '.jpg';
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  private readonly root = path.join(process.cwd(), 'uploads');

  async upload(input: UploadObjectInput): Promise<StoredObject> {
    const folder = input.isPrivate ? 'private' : 'public';
    const fileKey = `${folder}/${randomId('file')}${extension(input.fileName, input.mimeType)}`;
    const fullPath = path.join(this.root, fileKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
    return {
      fileKey,
      fileUrl: input.isPrivate ? '' : `/uploads/${fileKey}`,
    };
  }

  async read(fileKey: string): Promise<Buffer> {
    const fullPath = path.join(this.root, fileKey);
    try {
      return await fs.readFile(fullPath);
    } catch {
      throw new NotFoundError('Stored file not found');
    }
  }

  async delete(fileKey: string): Promise<void> {
    await fs.rm(path.join(this.root, fileKey), { force: true });
  }
}
