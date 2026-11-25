import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getCurrentUser } from '@/lib/auth';
import { computeTimerSnapshot } from '@/lib/engine/timer';

export async function GET() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const db = await getDb();
  const allCases = await db.select().from(schema.cases).orderBy(desc(schema.cases.createdAt));

  // Players see only published cases; Admins & Reviewers see all statuses
  const visibleCases =
    user.role === 'admin' || user.role === 'reviewer'
      ? allCases
      : allCases.filter((c) => c.status === 'published');

  const [entitlements, sessions, suspectCounts, evidenceCounts] = await Promise.all([
    db
      .select()
      .from(schema.caseEntitlements)
      .where(eq(schema.caseEntitlements.userId, user.id)),
    db
      .select()
      .from(schema.investigationSessions)
      .where(eq(schema.investigationSessions.userId, user.id)),
    db.select({ caseId: schema.suspects.caseId }).from(schema.suspects),
    db.select({ caseId: schema.evidenceItems.caseId }).from(schema.evidenceItems),
  ]);

  const entMap = new Map(
    entitlements.filter((e) => e.status === 'active').map((e) => [e.caseId, e]),
  );
  const sessMap = new Map(sessions.map((s) => [s.caseId, s]));

  const suspectCountMap = new Map<string, number>();
  for (const s of suspectCounts) {
    suspectCountMap.set(s.caseId, (suspectCountMap.get(s.caseId) ?? 0) + 1);
  }
  const evidenceCountMap = new Map<string, number>();
  for (const e of evidenceCounts) {
    evidenceCountMap.set(e.caseId, (evidenceCountMap.get(e.caseId) ?? 0) + 1);
  }

  const now = new Date();

  const items = visibleCases.map((c) => {
    const ent = entMap.get(c.id);
    const hasAccess = Boolean(ent) || user.role === 'admin' || user.role === 'reviewer';
    const session = sessMap.get(c.id);
    const timer = session ? computeTimerSnapshot(session, c, now) : null;

    return {
      id: c.id,
      slug: c.slug,
      caseNumber: c.caseNumber,
      title: c.title,
      subtitle: c.subtitle,
      classification: c.classification,
      status: c.status,
      difficulty: c.difficulty,
      priceCents: c.priceCents,
      currency: c.currency,
      summary: c.summary,
      incidentLocation: c.incidentLocation,
      incidentDate: c.incidentDate,
      victimName: c.victimName,
      defaultDurationSeconds: c.defaultDurationSeconds,
      expiryPolicy: c.expiryPolicy,
      metadata: c.metadata,
      suspectCount: suspectCountMap.get(c.id) ?? 0,
      evidenceCount: evidenceCountMap.get(c.id) ?? 0,
      entitled: hasAccess,
      purchaseRef: ent?.purchaseRef ?? null,
      sessionStatus: timer?.status ?? 'not_started',
      remainingSeconds: timer?.remainingSeconds ?? c.defaultDurationSeconds,
    };
  });

  return NextResponse.json({ cases: items });
}
