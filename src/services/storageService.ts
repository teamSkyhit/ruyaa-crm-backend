import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';

const ROOT_PREFIX = process.env.STORAGE_PREFIX || 'boutique';

function buildFileName(originalName: string): string {
  const lastDot = originalName.lastIndexOf('.');
  const rawExt = lastDot > 0 ? originalName.slice(lastDot + 1) : '';
  const base = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  const suffix = randomBytes(4).toString('hex');
  return ext ? `${slug}-${suffix}.${ext}` : `${slug}-${suffix}`;
}

class StorageService {
  private client: S3Client | null = null;
  private bucket = '';
  private publicEndpoint = '';

  get configured(): boolean {
    return !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_ENDPOINT);
  }

  private s3(): S3Client {
    if (!this.client) {
      this.bucket = process.env.S3_BUCKET!;
      this.publicEndpoint = (process.env.S3_PUBLIC_ENDPOINT || `${process.env.S3_ENDPOINT}/${this.bucket}`).replace(/\/$/, '');
      this.client = new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
        forcePathStyle: false,
      });
    }
    return this.client;
  }

  private buildKey(folder: string, fileName: string): string {
    return `${ROOT_PREFIX}/${folder}/${fileName}`;
  }

  publicUrl(objectKey: string): string {
    return `${this.publicEndpoint}/${objectKey}`;
  }

  async upload(body: Buffer, originalName: string, mimeType: string, folder: string): Promise<{ objectKey: string; url: string }> {
    if (!this.configured) throw new Error('Object storage not configured (S3_* env vars missing)');

    const key = this.buildKey(folder, buildFileName(originalName));

    await this.s3().send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000',
    }));

    return { objectKey: key, url: this.publicUrl(key) };
  }

  async delete(objectKey: string): Promise<void> {
    if (!objectKey.startsWith(`${ROOT_PREFIX}/`)) return;
    await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }

  async getSignedUploadUrl(
    originalName: string,
    mimeType: string,
    folder: string,
  ): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
    if (!this.configured) throw new Error('Object storage not configured (S3_* env vars missing)');

    // Call s3() first — it lazily initialises this.bucket and this.publicEndpoint
    const s3Client = this.s3();
    const key = this.buildKey(folder, buildFileName(originalName));

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000',
    });

    // Presigned URL valid for 5 minutes — client uploads directly to R2
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return { uploadUrl, objectKey: key, publicUrl: this.publicUrl(key) };
  }

  /** Extract objectKey from a full CDN URL for deletion */
  keyFromUrl(url: string): string | null {
    const endpoint = (process.env.S3_PUBLIC_ENDPOINT || '').replace(/\/$/, '');
    if (endpoint && url.startsWith(endpoint + '/')) {
      return url.slice(endpoint.length + 1);
    }
    return null;
  }
}

export const storageService = new StorageService();
