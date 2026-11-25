import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import type { UserRole } from '@/lib/types';

export const SESSION_COOKIE_NAME = 'casefiles_session';
const SESSION_TTL_DAYS = 7;

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  badgeNumber: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedKey = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedKey.length) return false;
  return crypto.timingSafeEqual(derived, storedKey);
}

export function hashSessionToken(rawToken: string): string {
  const secret =
    process.env.SESSION_SECRET?.trim() ||
    'dev-case-files-session-secret-change-in-production-9f8a7b6c';
  return crypto.createHmac('sha256', secret).update(rawToken).digest('hex');
}

export async function createAuthSession(
  userId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
): Promise<{ rawToken: string; expiresAt: Date }> {
  const db = await getDb();
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(schema.authSessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  });

  return { rawToken, expiresAt };
}

export async function setSessionCookie(rawToken: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (existing) {
    const db = await getDb();
    await db
      .delete(schema.authSessions)
      .where(eq(schema.authSessions.tokenHash, hashSessionToken(existing)));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(explicitToken?: string): Promise<AuthenticatedUser | null> {
  const rawToken = explicitToken ?? (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const db = await getDb();
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();

  const rows = await db
    .select({
      user: schema.users,
      session: schema.authSessions,
    })
    .from(schema.authSessions)
    .innerJoin(schema.users, eq(schema.authSessions.userId, schema.users.id))
    .where(and(eq(schema.authSessions.tokenHash, tokenHash), gt(schema.authSessions.expiresAt, now)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.user.id,
    email: row.user.email,
    displayName: row.user.displayName,
    role: row.user.role,
    badgeNumber: row.user.badgeNumber,
  };
}

export function isAdmin(user: AuthenticatedUser | null): boolean {
  return user?.role === 'admin';
}

export function canReviewCases(user: AuthenticatedUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'reviewer';
}

export async function checkCaseEntitlement(
  user: AuthenticatedUser,
  caseId: string,
): Promise<{
  allowed: boolean;
  isPreview: boolean;
  reason?: string;
  caseRecord?: typeof schema.cases.$inferSelect;
}> {
  const db = await getDb();
  const caseRows = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.id, caseId))
    .limit(1);

  const caseRecord = caseRows[0];
  if (!caseRecord) {
    return { allowed: false, isPreview: false, reason: 'Case not found.' };
  }

  // Administrators and reviewers can preview any case (draft, published, archived)
  if (user.role === 'admin' || user.role === 'reviewer') {
    return {
      allowed: true,
      isPreview: caseRecord.status !== 'published',
      caseRecord,
    };
  }

  if (caseRecord.status !== 'published') {
    return {
      allowed: false,
      isPreview: false,
      reason: 'Case is not currently published.',
      caseRecord,
    };
  }

  const entitlements = await db
    .select()
    .from(schema.caseEntitlements)
    .where(
      and(
        eq(schema.caseEntitlements.userId, user.id),
        eq(schema.caseEntitlements.caseId, caseId),
        eq(schema.caseEntitlements.status, 'active'),
      ),
    )
    .limit(1);

  const ent = entitlements[0];
  if (!ent) {
    return {
      allowed: false,
      isPreview: false,
      reason: 'Active purchase entitlement required for this case.',
      caseRecord,
    };
  }

  if (ent.expiresAt && ent.expiresAt.getTime() < Date.now()) {
    return {
      allowed: false,
      isPreview: false,
      reason: 'Case entitlement has expired.',
      caseRecord,
    };
  }

  return { allowed: true, isPreview: false, caseRecord };
}

export async function recordAuditLog(params: {
  actorUserId?: string | null;
  actorRole?: string;
  action: string;
  targetType: string;
  targetId: string;
  caseId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.insert(schema.auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: params.actorUserId ?? null,
    actorRole: params.actorRole ?? 'system',
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    caseId: params.caseId ?? null,
    details: params.details ?? {},
    ipAddress: params.ipAddress ?? null,
  });
}

export function extractRequestIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip') || null;
}
