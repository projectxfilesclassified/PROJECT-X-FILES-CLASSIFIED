import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';
import { getPrivateObject, putPrivateObject } from '@/lib/storage';

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const { caseId } = await context.params;
  const db = await getDb();

  const sourceRows = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
  const src = sourceRows[0];
  if (!src) {
    return NextResponse.json({ error: 'Source case not found.' }, { status: 404 });
  }

  const newCaseId = `case-${crypto.randomUUID().slice(0, 12)}`;
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();

  const [suspects, suspectRels, evidence, assets, evidenceRels, timelines, solutions] =
    await Promise.all([
      db.select().from(schema.suspects).where(eq(schema.suspects.caseId, caseId)),
      db.select().from(schema.suspectRelationships).where(eq(schema.suspectRelationships.caseId, caseId)),
      db.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.caseId, caseId)),
      db.select().from(schema.evidenceAssets).where(eq(schema.evidenceAssets.caseId, caseId)),
      db.select().from(schema.evidenceRelations).where(eq(schema.evidenceRelations.caseId, caseId)),
      db.select().from(schema.caseTimelineEvents).where(eq(schema.caseTimelineEvents.caseId, caseId)),
      db.select().from(schema.caseSolutions).where(eq(schema.caseSolutions.caseId, caseId)),
    ]);

  const suspectIdMap = new Map<string, string>();
  for (const s of suspects) suspectIdMap.set(s.id, `sus-${crypto.randomUUID().slice(0, 10)}`);

  const evidenceIdMap = new Map<string, string>();
  for (const e of evidence) evidenceIdMap.set(e.id, `ev-${crypto.randomUUID().slice(0, 10)}`);

  const timelineIdMap = new Map<string, string>();
  for (const t of timelines) timelineIdMap.set(t.id, `tl-${crypto.randomUUID().slice(0, 10)}`);

  const assetIdMap = new Map<string, string>();
  for (const a of assets) assetIdMap.set(a.id, `ast-${crypto.randomUUID().slice(0, 10)}`);

  // 1. Clone case
  const insertedCase = await db
    .insert(schema.cases)
    .values({
      ...src,
      id: newCaseId,
      slug: `${src.slug}-copy-${suffix.toLowerCase()}`,
      caseNumber: `${src.caseNumber}-COPY-${suffix}`,
      title: `${src.title} (Copy)`,
      status: 'draft',
      victimPhotoAssetId: src.victimPhotoAssetId ? assetIdMap.get(src.victimPhotoAssetId) ?? null : null,
      createdBy: user.id,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // 2. Clone suspects
  for (const s of suspects) {
    await db.insert(schema.suspects).values({
      ...s,
      id: suspectIdMap.get(s.id)!,
      caseId: newCaseId,
      photoAssetId: s.photoAssetId ? assetIdMap.get(s.photoAssetId) ?? null : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 3. Clone suspect relationships
  for (const r of suspectRels) {
    const newSrc = suspectIdMap.get(r.sourceSuspectId);
    const newDst = suspectIdMap.get(r.targetSuspectId);
    if (!newSrc || !newDst) continue;
    await db.insert(schema.suspectRelationships).values({
      ...r,
      id: crypto.randomUUID(),
      caseId: newCaseId,
      sourceSuspectId: newSrc,
      targetSuspectId: newDst,
      linkedEvidenceId: r.linkedEvidenceId ? evidenceIdMap.get(r.linkedEvidenceId) ?? null : null,
      createdAt: new Date(),
    });
  }

  // 4. Clone evidence items
  for (const e of evidence) {
    await db.insert(schema.evidenceItems).values({
      ...e,
      id: evidenceIdMap.get(e.id)!,
      caseId: newCaseId,
      relatedSuspectIds: (e.relatedSuspectIds ?? []).map((id) => suspectIdMap.get(id) ?? id),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 5. Clone private storage assets cleanly
  for (const a of assets) {
    const newAssetId = assetIdMap.get(a.id)!;
    const newStorageKey = `${newCaseId}/${a.originalFilename.replace(/[^a-zA-Z0-9._-]+/g, '_')}-${newAssetId.slice(-6)}`;
    try {
      const buf = await getPrivateObject(a.storageKey);
      const stored = await putPrivateObject(newStorageKey, buf, a.mimeType);
      await db.insert(schema.evidenceAssets).values({
        id: newAssetId,
        caseId: newCaseId,
        evidenceItemId: a.evidenceItemId ? evidenceIdMap.get(a.evidenceItemId) ?? null : null,
        storageKey: stored.storageKey,
        originalFilename: a.originalFilename,
        mimeType: a.mimeType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        caption: a.caption,
        sortOrder: a.sortOrder,
      });
    } catch {
      // Skip if source file missing
    }
  }

  // 6. Clone evidence relations
  for (const r of evidenceRels) {
    const newSrc = evidenceIdMap.get(r.sourceEvidenceId);
    const newDst = evidenceIdMap.get(r.targetEvidenceId);
    if (!newSrc || !newDst) continue;
    await db.insert(schema.evidenceRelations).values({
      ...r,
      id: crypto.randomUUID(),
      caseId: newCaseId,
      sourceEvidenceId: newSrc,
      targetEvidenceId: newDst,
      createdAt: new Date(),
    });
  }

  // 7. Clone timeline events
  for (const t of timelines) {
    await db.insert(schema.caseTimelineEvents).values({
      ...t,
      id: timelineIdMap.get(t.id)!,
      caseId: newCaseId,
      involvedSuspectIds: (t.involvedSuspectIds ?? []).map((id) => suspectIdMap.get(id) ?? id),
      linkedEvidenceIds: (t.linkedEvidenceIds ?? []).map((id) => evidenceIdMap.get(id) ?? id),
      createdAt: new Date(),
    });
  }

  // 8. Clone confidential solution with remapped IDs
  const sol = solutions[0];
  if (sol) {
    await db.insert(schema.caseSolutions).values({
      id: `sol-${crypto.randomUUID().slice(0, 12)}`,
      caseId: newCaseId,
      killerSuspectId: sol.killerSuspectId ? suspectIdMap.get(sol.killerSuspectId) ?? null : null,
      accompliceSuspectIds: (sol.accompliceSuspectIds ?? []).map((id) => suspectIdMap.get(id) ?? id),
      motiveKeywords: sol.motiveKeywords,
      motiveCanonical: sol.motiveCanonical,
      methodKeywords: sol.methodKeywords,
      methodCanonical: sol.methodCanonical,
      requiredEvidenceIds: (sol.requiredEvidenceIds ?? []).map((id) => evidenceIdMap.get(id) ?? id),
      bonusEvidenceIds: (sol.bonusEvidenceIds ?? []).map((id) => evidenceIdMap.get(id) ?? id),
      canonicalTimelineOrder: (sol.canonicalTimelineOrder ?? []).map((slot) => ({
        ...slot,
        eventId: timelineIdMap.get(slot.eventId) ?? slot.eventId,
      })),
      solutionNarrative: sol.solutionNarrative,
      updatedBy: user.id,
      updatedAt: new Date(),
    });
  }

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'CASE_DUPLICATED',
    targetType: 'case',
    targetId: newCaseId,
    caseId: newCaseId,
    details: { sourceCaseId: caseId, sourceTitle: src.title },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ case: insertedCase[0] }, { status: 201 });
}
