import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';
import { runCaseValidationSuite } from '@/lib/validation/case-validator';
import { generateSignedAssetUrl } from '@/lib/storage';

const updateCaseSchema = z.object({
  title: z.string().min(2).max(150).optional(),
  caseNumber: z.string().min(2).max(40).optional(),
  subtitle: z.string().max(240).optional(),
  classification: z.string().max(120).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  difficulty: z.enum(['standard', 'advanced', 'expert']).optional(),
  priceCents: z.number().int().min(0).max(500000).optional(),
  summary: z.string().optional(),
  briefingMarkdown: z.string().optional(),
  incidentLocation: z.string().optional(),
  incidentDate: z.string().optional(),
  victimName: z.string().optional(),
  victimSummary: z.string().optional(),
  defaultDurationSeconds: z.number().int().min(600).max(86400).optional(),
  expiryPolicy: z.enum(['lock_and_auto_submit', 'allow_late_penalty', 'hard_lock']).optional(),
  latePenaltyPercent: z.number().int().min(0).max(50).optional(),
  maxAccusationAttempts: z.number().int().min(1).max(10).optional(),
  scoringConfig: z.any().optional(),
  metadata: z.any().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const { caseId } = await context.params;
  const db = await getDb();

  const caseRows = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
  const caseRow = caseRows[0];
  if (!caseRow) {
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  }

  const [suspects, suspectRelationships, evidence, assets, evidenceRelations, timelineEvents, solutions] =
    await Promise.all([
      db.select().from(schema.suspects).where(eq(schema.suspects.caseId, caseId)).orderBy(asc(schema.suspects.sortOrder)),
      db.select().from(schema.suspectRelationships).where(eq(schema.suspectRelationships.caseId, caseId)),
      db.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.caseId, caseId)).orderBy(asc(schema.evidenceItems.sortOrder)),
      db.select().from(schema.evidenceAssets).where(eq(schema.evidenceAssets.caseId, caseId)),
      db.select().from(schema.evidenceRelations).where(eq(schema.evidenceRelations.caseId, caseId)),
      db.select().from(schema.caseTimelineEvents).where(eq(schema.caseTimelineEvents.caseId, caseId)).orderBy(asc(schema.caseTimelineEvents.sortOrder)),
      db.select().from(schema.caseSolutions).where(eq(schema.caseSolutions.caseId, caseId)).limit(1),
    ]);

  const signedAssets = await Promise.all(
    assets.map(async (a) => {
      const signed = await generateSignedAssetUrl({
        assetId: a.id,
        caseId,
        userId: user.id,
        storageKey: a.storageKey,
        mimeType: a.mimeType,
      });
      return { ...a, url: signed.url };
    }),
  );

  return NextResponse.json({
    case: caseRow,
    suspects,
    suspectRelationships,
    evidence,
    assets: signedAssets,
    evidenceRelations,
    timelineEvents,
    solution: solutions[0] ?? null,
  });
}

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
  const parsed = updateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid case update.' },
      { status: 400 },
    );
  }

  const db = await getDb();
  const existingRows = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ error: 'Case not found.' }, { status: 404 });
  }

  // Enforce automated validation before publishing a case
  if (parsed.data.status === 'published' && existing.status !== 'published') {
    const validation = await runCaseValidationSuite(caseId);
    if (!validation.validForPublish) {
      return NextResponse.json(
        {
          error: `Case failed ${validation.failures} mandatory validation test(s) and cannot be published yet.`,
          validation,
        },
        { status: 422 },
      );
    }
  }

  const now = new Date();
  const updated = await db
    .update(schema.cases)
    .set({
      ...parsed.data,
      publishedAt:
        parsed.data.status === 'published' && !existing.publishedAt ? now : existing.publishedAt,
      updatedAt: now,
    })
    .where(eq(schema.cases.id, caseId))
    .returning();

  const action =
    parsed.data.status && parsed.data.status !== existing.status
      ? `CASE_STATUS_${parsed.data.status.toUpperCase()}`
      : 'CASE_UPDATED';

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action,
    targetType: 'case',
    targetId: caseId,
    caseId,
    details: { changedFields: Object.keys(parsed.data) },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ case: updated[0] });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const { caseId } = await context.params;
  const db = await getDb();

  await db.delete(schema.cases).where(eq(schema.cases.id, caseId));

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'CASE_DELETED',
    targetType: 'case',
    targetId: caseId,
    caseId,
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ ok: true });
}
