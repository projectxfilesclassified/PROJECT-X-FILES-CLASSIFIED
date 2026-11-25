import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';

export async function PUT(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const { caseId } = await context.params;
  const body = await request.json();
  const db = await getDb();

  const existing = await db
    .select()
    .from(schema.caseSolutions)
    .where(eq(schema.caseSolutions.caseId, caseId))
    .limit(1);

  const payload = {
    killerSuspectId: body.killerSuspectId || null,
    accompliceSuspectIds: Array.isArray(body.accompliceSuspectIds) ? body.accompliceSuspectIds : [],
    motiveKeywords: Array.isArray(body.motiveKeywords) ? body.motiveKeywords : [],
    motiveCanonical: String(body.motiveCanonical || ''),
    methodKeywords: Array.isArray(body.methodKeywords) ? body.methodKeywords : [],
    methodCanonical: String(body.methodCanonical || ''),
    requiredEvidenceIds: Array.isArray(body.requiredEvidenceIds) ? body.requiredEvidenceIds : [],
    bonusEvidenceIds: Array.isArray(body.bonusEvidenceIds) ? body.bonusEvidenceIds : [],
    canonicalTimelineOrder: Array.isArray(body.canonicalTimelineOrder)
      ? body.canonicalTimelineOrder
      : [],
    solutionNarrative: String(body.solutionNarrative || ''),
    updatedBy: user.id,
    updatedAt: new Date(),
  };

  let saved;
  if (existing[0]) {
    const rows = await db
      .update(schema.caseSolutions)
      .set(payload)
      .where(eq(schema.caseSolutions.id, existing[0].id))
      .returning();
    saved = rows[0];
  } else {
    const rows = await db
      .insert(schema.caseSolutions)
      .values({
        id: `sol-${crypto.randomUUID().slice(0, 12)}`,
        caseId,
        ...payload,
      })
      .returning();
    saved = rows[0];
  }

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'CONFIDENTIAL_SOLUTION_UPDATED',
    targetType: 'case_solution',
    targetId: saved?.id ?? caseId,
    caseId,
    details: {
      hasKiller: Boolean(payload.killerSuspectId),
      requiredEvidenceCount: payload.requiredEvidenceIds.length,
      timelineSlotCount: payload.canonicalTimelineOrder.length,
    },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ ok: true, solution: saved });
}
