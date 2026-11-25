import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getPrivateObject, verifySignedAssetToken } from '@/lib/storage';

/**
 * Private Signed Asset Delivery Endpoint.
 * - Verifies HMAC-SHA256 signature & TTL expiry.
 * - Enforces active user session binding (token cannot be replayed by another user).
 * - Supports HTTP Range requests (206 Partial Content) for smooth audio/video playback.
 * - Never allows public caching (`Cache-Control: private, no-store`).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing asset signature token.' }, { status: 400 });
  }

  const payload = verifySignedAssetToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired signed asset token.' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user || user.id !== payload.userId) {
    return NextResponse.json({ error: 'Asset token session binding failed.' }, { status: 403 });
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.evidenceAssets)
    .where(
      and(
        eq(schema.evidenceAssets.id, payload.assetId),
        eq(schema.evidenceAssets.caseId, payload.caseId),
      ),
    )
    .limit(1);

  const asset = rows[0];
  if (!asset) {
    return NextResponse.json({ error: 'Asset record not found.' }, { status: 404 });
  }

  let data: Buffer;
  try {
    data = await getPrivateObject(asset.storageKey);
  } catch {
    return NextResponse.json({ error: 'Private asset object missing from storage.' }, { status: 404 });
  }

  const baseHeaders: Record<string, string> = {
    'Content-Type': asset.mimeType,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `inline; filename="${asset.originalFilename.replace(/"/g, '')}"`,
    'Accept-Ranges': 'bytes',
  };

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const total = data.byteLength;
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
      if (start <= end && start < total) {
        const chunk = data.subarray(start, end + 1);
        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': String(chunk.byteLength),
          },
        });
      }
    }
  }

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      ...baseHeaders,
      'Content-Length': String(data.byteLength),
    },
  });
}
