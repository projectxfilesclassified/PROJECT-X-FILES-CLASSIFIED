import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import {
  createAuthSession,
  extractRequestIp,
  recordAuditLog,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid email and password are required.' }, { status: 400 });
    }

    const db = await getDb();
    const email = parsed.data.email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      await recordAuditLog({
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'user',
        targetId: email,
        details: { reason: 'invalid_credentials' },
        ipAddress: extractRequestIp(request),
      });
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const { rawToken, expiresAt } = await createAuthSession(user.id, {
      ipAddress: extractRequestIp(request),
      userAgent: request.headers.get('user-agent'),
    });
    await setSessionCookie(rawToken, expiresAt);

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      targetType: 'user',
      targetId: user.id,
      ipAddress: extractRequestIp(request),
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        badgeNumber: user.badgeNumber,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Authentication service error.' }, { status: 500 });
  }
}
