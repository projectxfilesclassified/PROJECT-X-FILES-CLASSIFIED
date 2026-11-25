import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';
import { computeTimerSnapshot, extendInvestigationTimer } from '@/lib/engine/timer';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const db = await getDb();
  const [sessions, allUsers, allCases, entitlements, logs] = await Promise.all([
    db.select().from(schema.investigationSessions).orderBy(desc(schema.investigationSessions.updatedAt)),
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        role: schema.users.role,
        badgeNumber: schema.users.badgeNumber,
      })
      .from(schema.users),
    db.select().from(schema.cases),
    db.select().from(schema.caseEntitlements).orderBy(desc(schema.caseEntitlements.grantedAt)),
    db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(100),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const caseMap = new Map(allCases.map((c) => [c.id, c]));
  const now = new Date();

  const enrichedSessions = sessions.map((s) => {
    const c = caseMap.get(s.caseId);
    const u = userMap.get(s.userId);
    const timer = c ? computeTimerSnapshot(s, c, now) : null;
    return {
      id: s.id,
      userId: s.userId,
      userEmail: u?.email ?? 'unknown',
      userName: u?.displayName ?? 'Unknown',
      badgeNumber: u?.badgeNumber ?? '',
      caseId: s.caseId,
      caseNumber: c?.caseNumber ?? '',
      caseTitle: c?.title ?? 'Unknown Case',
      timer,
      viewedCount: s.viewedEvidenceIds?.length ?? 0,
      unlockedCount: s.unlockedEvidenceIds?.length ?? 0,
      updatedAt: s.updatedAt,
    };
  });

  const enrichedEntitlements = entitlements.map((e) => ({
    ...e,
    userEmail: userMap.get(e.userId)?.email ?? 'unknown',
    userName: userMap.get(e.userId)?.displayName ?? 'Unknown',
    caseNumber: caseMap.get(e.caseId)?.caseNumber ?? '',
    caseTitle: caseMap.get(e.caseId)?.title ?? 'Unknown',
  }));

  return NextResponse.json({
    sessions: enrichedSessions,
    users: allUsers,
    cases: allCases.map((c) => ({ id: c.id, caseNumber: c.caseNumber, title: c.title, status: c.status })),
    entitlements: enrichedEntitlements,
    auditLogs: logs,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const body = await request.json();
  const ipAddress = extractRequestIp(request);

  if (body.action === 'extend_timer') {
    try {
      const timer = await extendInvestigationTimer({
        adminUser: user,
        sessionId: String(body.sessionId || ''),
        extensionMinutes: Number(body.extensionMinutes || 0),
        reason: String(body.reason || ''),
        ipAddress,
      });
      return NextResponse.json({ ok: true, timer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to extend timer.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const db = await getDb();

  if (body.action === 'grant_entitlement') {
    const targetUserId = String(body.userId || '');
    const targetCaseId = String(body.caseId || '');
    if (!targetUserId || !targetCaseId) {
      return NextResponse.json({ error: 'userId and caseId are required.' }, { status: 400 });
    }
    const existing = await db
      .select()
      .from(schema.caseEntitlements)
      .where(
        and(
          eq(schema.caseEntitlements.userId, targetUserId),
          eq(schema.caseEntitlements.caseId, targetCaseId),
        ),
      )
      .limit(1);

    const purchaseRef = `ADM-GRANT-${Date.now().toString(36).toUpperCase()}`;
    if (existing[0]) {
      await db
        .update(schema.caseEntitlements)
        .set({ status: 'active', grantedBy: user.id, grantedAt: new Date(), purchaseRef })
        .where(eq(schema.caseEntitlements.id, existing[0].id));
    } else {
      await db.insert(schema.caseEntitlements).values({
        id: crypto.randomUUID(),
        userId: targetUserId,
        caseId: targetCaseId,
        status: 'active',
        purchaseRef,
        grantedBy: user.id,
      });
    }

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'ENTITLEMENT_GRANTED',
      targetType: 'case_entitlement',
      targetId: `${targetUserId}:${targetCaseId}`,
      caseId: targetCaseId,
      details: { targetUserId, purchaseRef },
      ipAddress,
    });

    return NextResponse.json({ ok: true, purchaseRef });
  }

  if (body.action === 'revoke_entitlement' && body.entitlementId) {
    await db
      .update(schema.caseEntitlements)
      .set({ status: 'revoked' })
      .where(eq(schema.caseEntitlements.id, String(body.entitlementId)));

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'ENTITLEMENT_REVOKED',
      targetType: 'case_entitlement',
      targetId: String(body.entitlementId),
      ipAddress,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported admin session action.' }, { status: 400 });
}
