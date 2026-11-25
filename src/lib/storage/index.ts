import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StoredObjectMeta {
  storageKey: string;
  byteSize: number;
  sha256: string;
  mimeType: string;
}

export interface SignedAssetPayload {
  assetId: string;
  caseId: string;
  userId: string;
  exp: number; // Unix epoch seconds
}

function getSigningSecret(): string {
  return (
    process.env.ASSET_SIGNING_SECRET?.trim() ||
    'dev-case-files-asset-signing-secret-change-in-production-4d3e2f1a'
  );
}

function getStorageDriver(): 'local' | 's3' {
  return process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
}

function getLocalStorageRoot(): string {
  const configured = process.env.LOCAL_STORAGE_DIR?.trim() || './storage/private';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

let s3ClientSingleton: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3ClientSingleton) {
    s3ClientSingleton = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }
  return s3ClientSingleton;
}

function sanitizeStorageKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..') || normalized.length === 0) {
    throw new Error('Invalid storage key');
  }
  return normalized;
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function putPrivateObject(
  storageKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredObjectMeta> {
  const safeKey = sanitizeStorageKey(storageKey);
  const sha256 = computeSha256(buffer);

  if (getStorageDriver() === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET must be configured when STORAGE_DRIVER=s3');
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: safeKey,
        Body: buffer,
        ContentType: mimeType,
        Metadata: { sha256 },
      }),
    );
  } else {
    const fullPath = path.join(getLocalStorageRoot(), safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  return {
    storageKey: safeKey,
    byteSize: buffer.byteLength,
    sha256,
    mimeType,
  };
}

export async function getPrivateObject(storageKey: string): Promise<Buffer> {
  const safeKey = sanitizeStorageKey(storageKey);

  if (getStorageDriver() === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET must be configured when STORAGE_DRIVER=s3');
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: safeKey }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error('Asset body unavailable');
    return Buffer.from(bytes);
  }

  const fullPath = path.join(getLocalStorageRoot(), safeKey);
  return fs.readFile(fullPath);
}

export async function privateObjectExists(storageKey: string): Promise<boolean> {
  const safeKey = sanitizeStorageKey(storageKey);

  if (getStorageDriver() === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return false;
    try {
      await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: safeKey }));
      return true;
    } catch {
      return false;
    }
  }

  const fullPath = path.join(getLocalStorageRoot(), safeKey);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

export async function deletePrivateObject(storageKey: string): Promise<void> {
  const safeKey = sanitizeStorageKey(storageKey);

  if (getStorageDriver() === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return;
    await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: safeKey }));
    return;
  }

  const fullPath = path.join(getLocalStorageRoot(), safeKey);
  try {
    await fs.unlink(fullPath);
  } catch {
    // Ignore missing files on cleanup
  }
}

export function createSignedAssetToken(payload: Omit<SignedAssetPayload, 'exp'>, ttlSeconds?: number): string {
  const ttl = ttlSeconds ?? Number(process.env.SIGNED_URL_TTL_SECONDS || 900);
  const fullPayload: SignedAssetPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedAssetToken(
  token: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): SignedAssetPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedAssetPayload;
    if (!parsed.assetId || !parsed.caseId || !parsed.userId || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.exp < nowEpochSeconds) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function generateSignedAssetUrl(params: {
  assetId: string;
  caseId: string;
  userId: string;
  storageKey: string;
  mimeType: string;
  ttlSeconds?: number;
}): Promise<{ url: string; expiresAt: string }> {
  const ttl = params.ttlSeconds ?? Number(process.env.SIGNED_URL_TTL_SECONDS || 900);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  if (getStorageDriver() === 's3' && process.env.S3_DIRECT_PRESIGN === 'true') {
    const bucket = process.env.S3_BUCKET;
    if (bucket) {
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key: sanitizeStorageKey(params.storageKey),
        ResponseContentType: params.mimeType,
      });
      const url = await getSignedUrl(getS3Client(), cmd, { expiresIn: ttl });
      return { url, expiresAt };
    }
  }

  const token = createSignedAssetToken(
    {
      assetId: params.assetId,
      caseId: params.caseId,
      userId: params.userId,
    },
    ttl,
  );
  return {
    url: `/api/assets/stream?token=${encodeURIComponent(token)}`,
    expiresAt,
  };
}
