export interface StoredObject {
  fileKey: string;
  fileUrl: string;
}

export interface UploadObjectInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  folder: 'documents' | 'images';
  isPrivate: boolean;
}

export interface StorageProvider {
  readonly name: 'local' | 's3';
  upload(input: UploadObjectInput): Promise<StoredObject>;
  read(fileKey: string): Promise<Buffer>;
  delete(fileKey: string): Promise<void>;
}
