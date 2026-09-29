import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import path from 'path';
import { env } from '../../config/env';
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

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3' as const;
  private readonly client = new S3Client({
    region: env.aws.region,
    credentials: {
      accessKeyId: env.aws.accessKeyId,
      secretAccessKey: env.aws.secretAccessKey,
    },
  });

  async upload(input: UploadObjectInput): Promise<StoredObject> {
    const fileKey = `${input.folder}/${randomId('file')}${extension(input.fileName, input.mimeType)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.aws.bucket,
        Key: fileKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );
    const fileUrl = input.isPrivate
      ? ''
      : `https://${env.aws.bucket}.s3.${env.aws.region}.amazonaws.com/${fileKey}`;
    return { fileKey, fileUrl };
  }

  async read(fileKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: env.aws.bucket, Key: fileKey }),
    );
    if (!response.Body) {
      throw new NotFoundError('Stored file not found');
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(fileKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.aws.bucket, Key: fileKey }));
  }
}
