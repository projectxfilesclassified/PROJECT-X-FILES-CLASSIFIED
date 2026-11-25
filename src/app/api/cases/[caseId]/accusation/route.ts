import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import {
  checkCaseEntitlement,
  extractRequestIp,
  getCurrentUser,
  recordAuditLog,
} from '@/lib/auth';
import { computeTimerSnapshot, getOrCreateInvestigationSession } from '@/lib/engine/timer';
import { evaluateAccusationServerSide } from '@/lib/engine/scoring';

const accusationSchema = z.object({
  accusedSuspectId: z.string().min(1, 'Select a suspect to accuse.'),
  motiveExplanation: z.string().min(15, 'Provide a clear motive explanation (min 15 characters).'),
  methodExplanation: z.string().min(15, 'Provide a clear method explanation (min 15 characters).'),
  reconstructedTimeline: z.array(z.string()).min(1, 'Confirm your timeline reconstruction.'),
  supportingEvidenceIds: z.array(z.string()).min(1, 'Select at least one supporting evidence exhibit.'),
});

/**
 * Server-side Final Accusation Scoring Endpoint.
 * - Enforces auth, entitlement, session ownership, active timer & expiry rules.
 * - Loads confidential `case_solutions` strictly inside this handler.
 * - Evaluates all 5 scoring criteria server-side and stores immutable result + audit log.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId } = await context.params;
  const access = await checkCaseEntitlement(user, caseId);
  if (!access.allowed || !access.caseRecord) {
    return NextResponse.json({ error: access.reason || 'Access denied.' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = accusationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Incomplete accusation submission.' },
      { status: 400 },
    );
  }

  const db = await getDb();
  const caseRecord = access.caseRecord;
  const { session } = await getOrCreateInvestigationSession(user.id, caseId);

  if (session.userId !== user.id) {
    return NextResponse.json({ error: 'Session ownership mismatch.' }, { status: 403 });
  }

  const now = new Date();
  const timer = computeTimerSnapshot(session, caseRecord, now);

  if (timer.status === 'not_started') {
    return NextResponse.json(
      { error: 'You must explicitly start the investigation before submitting a final accusation.' },
      { status: 400 },
    );
  }

  const priorSubmissions = await db
    .select({ id: schema.accusationSubmissions.id })
    .from(schema.accusationSubmissions)
    .where(eq(schema.accusationSubmissions.sessionId, session.id));

  if (priorSubmissions.length >= caseRecord.maxAccusationAttempts) {
    return NextResponse.json(
      { error: `Maximum accusation attempts (${caseRecord.maxAccusationAttempts}) reached for this case.` },
      { status: 409 },
    );
  }

  if (timer.isExpired && caseRecord.expiryPolicy === 'hard_lock') {
    return NextResponse.json(
      { error: 'Investigation deadline expired under hard-lock policy. Contact an administrator for a timer extension.' },
      { status: 403 },
    );
  }

  // Strictly server-side lookup of confidential solution
  const [solutionRows, suspectRows, evidenceRows] = await Promise.all([
    db.select().from(schema.caseSolutions).where(eq(schema.caseSolutions.caseId, caseId)).limit(1),
    db.select().from(schema.suspects).where(eq(schema.suspects.caseId, caseId)),
    db
      .select({ id: schema.evidenceItems.id, code: schema.evidenceItems.evidenceCode })
      .from(schema.evidenceItems)
      .where(eq(schema.evidenceItems.caseId, caseId)),
  ]);

  const solution = solutionRows[0];
  if (!solution || !solution.killerSuspectId) {
    return NextResponse.json(
      { error: 'Case confidential solution is not configured yet.' },
      { status: 500 },
    );
  }

  const killerSuspect = suspectRows.find((s) => s.id === solution.killerSuspectId);
  const evidenceCodeById: Record<string, string> = {};
  for (const e of evidenceRows) evidenceCodeById[e.id] = e.code;

  const evaluation = evaluateAccusationServerSide(
    {
      accusedSuspectId: parsed.data.accusedSuspectId,
      motiveExplanation: parsed.data.motiveExplanation,
      methodExplanation: parsed.data.methodExplanation,
      reconstructedTimeline: parsed.data.reconstructedTimeline,
      supportingEvidenceIds: parsed.data.supportingEvidenceIds,
      isLate: timer.isExpired,
      expiryPolicy: caseRecord.expiryPolicy,
      latePenaltyPercent: caseRecord.latePenaltyPercent,
    },
    {
      killerSuspectId: solution.killerSuspectId,
      killerName: killerSuspect?.fullName ?? 'Unknown Suspect',
      accompliceSuspectIds: solution.accompliceSuspectIds ?? [],
      motiveKeywords: solution.motiveKeywords ?? [],
      motiveCanonical: solution.motiveCanonical ?? '',
      methodKeywords: solution.methodKeywords ?? [],
      methodCanonical: solution.methodCanonical ?? '',
      requiredEvidenceIds: solution.requiredEvidenceIds ?? [],
      bonusEvidenceIds: solution.bonusEvidenceIds ?? [],
      canonicalTimelineOrder: solution.canonicalTimelineOrder ?? [],
      solutionNarrative: solution.solutionNarrative ?? '',
      evidenceCodeById,
    },
    caseRecord.scoringConfig,
  );

  const submissionId = crypto.randomUUID();
  const inserted = await db
    .insert(schema.accusationSubmissions)
    .values({
      id: submissionId,
      sessionId: session.id,
      userId: user.id,
      caseId,
      accusedSuspectId: parsed.data.accusedSuspectId,
      motiveExplanation: parsed.data.motiveExplanation,
      methodExplanation: parsed.data.methodExplanation,
      reconstructedTimeline: parsed.data.reconstructedTimeline,
      supportingEvidenceIds: parsed.data.supportingEvidenceIds,
      isLate: timer.isExpired,
      elapsedSeconds: timer.elapsedSeconds,
      totalScore: evaluation.totalScore,
      rank: evaluation.rank,
      scoreBreakdown: evaluation.breakdown,
      passed: evaluation.passed,
      submittedAt: now,
    })
    .returning();

  // Lock session as submitted once max attempts reached
  if (priorSubmissions.length + 1 >= caseRecord.maxAccusationAttempts) {
    await db
      .update(schema.investigationSessions)
      .set({
        status: 'submitted',
        submittedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.investigationSessions.id, session.id));
  }

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'ACCUSATION_SUBMITTED',
    targetType: 'accusation_submission',
    targetId: submissionId,
    caseId,
    details: {
      totalScore: evaluation.totalScore,
      rank: evaluation.rank,
      passed: evaluation.passed,
      isLate: timer.isExpired,
      elapsedSeconds: timer.elapsedSeconds,
    },
    ipAddress: extractRequestIp(request),
  });

  const updatedSessionRows = await db
    .select()
    .from(schema.investigationSessions)
    .where(eq(schema.investigationSessions.id, session.id))
    .limit(1);

  const updatedTimer = computeTimerSnapshot(updatedSessionRows[0] ?? session, caseRecord, now);

  return NextResponse.json({
    submission: inserted[0],
    timer: updatedTimer,
  });
}
