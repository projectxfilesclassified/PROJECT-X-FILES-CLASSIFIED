import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { ensureSeeded, SEED_CASE_IDS } from '@/lib/db/seed';
import {
  createAuthSession,
  extractRequestIp,
  hashPassword,
  recordAuditLog,
  setSessionCookie,
} from '@/lib/auth';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2).max(60),
});

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid registration fields.' },
        { status: 400 },
      );
    }

    const db = await getDb();
    const email = parsed.data.email.trim().toLowerCase();
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const userId = crypto.randomUUID();
    const badgeNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.insert(schema.users).values({
      id: userId,
      email,
      passwordHash: hashPassword(parsed.data.password),
      displayName: parsed.data.displayName.trim(),
      role: 'investigator',
      badgeNumber,
    });

    // Grant starter entitlement to flagship sample case so new investigators can start immediately
    await db
      .insert(schema.caseEntitlements)
      .values({
        id: crypto.randomUUID(),
        userId,
        caseId: SEED_CASE_IDS.ashford,
        status: 'active',
        purchaseRef: `STARTER-${badgeNumber}`,
      })
      .onConflictDoNothing();

    const { rawToken, expiresAt } = await createAuthSession(userId, {
      ipAddress: extractRequestIp(request),
      userAgent: request.headers.get('user-agent'),
    });
    await setSessionCookie(rawToken, expiresAt);

    await recordAuditLog({
      actorUserId: userId,
      actorRole: 'investigator',
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: userId,
      details: { email, badgeNumber },
      ipAddress: extractRequestIp(request),
    });

    return NextResponse.json(
      {
        user: {
          id: userId,
          email,
          displayName: parsed.data.displayName.trim(),
          role: 'investigator',
          badgeNumber,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }
}
