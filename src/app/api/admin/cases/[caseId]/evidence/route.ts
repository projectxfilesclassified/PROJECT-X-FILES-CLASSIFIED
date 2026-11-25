import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';

export async function POST(
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

  // Manage evidence relationships
  if (body.action === 'upsert_relation') {
    const relId = body.id || crypto.randomUUID();
    await db
      .insert(schema.evidenceRelations)
      .values({
        id: relId,
        caseId,
        sourceEvidenceId: body.sourceEvidenceId,
        targetEvidenceId: body.targetEvidenceId,
        relationType: body.relationType || 'links_to',
        label: body.label || '',
        isCanonical: body.isCanonical !== false,
      })
      .onConflictDoUpdate({
        target: schema.evidenceRelations.id,
        set: {
          relationType: body.relationType || 'links_to',
          label: body.label || '',
          isCanonical: body.isCanonical !== false,
        },
      });
    return NextResponse.json({ ok: true, id: relId });
  }

  if (body.action === 'delete_relation' && body.id) {
    await db
      .delete(schema.evidenceRelations)
      .where(
        and(
          eq(schema.evidenceRelations.id, body.id),
          eq(schema.evidenceRelations.caseId, caseId),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  const title = (body.title || '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Evidence title is required.' }, { status: 400 });
  }

  const evidenceId = body.id || `ev-${crypto.randomUUID().slice(0, 10)}`;
  const evidenceCode = (body.evidenceCode || `EV-${Math.floor(100 + Math.random() * 899)}`)
    .trim()
    .toUpperCase();

  const record = {
    id: evidenceId,
    caseId,
    evidenceCode,
    title,
    summary: body.summary || '',
    description: body.description || '',
    section: body.section || 'documents',
    viewerType: body.viewerType || 'pdf',
    classification: body.classification || 'CONFIDENTIAL',
    sourceOrigin: body.sourceOrigin || '',
    collectedAt: body.collectedAt || '',
    collectedBy: body.collectedBy || '',
    locationFound: body.locationFound || '',
    chainOfCustody: Array.isArray(body.chainOfCustody) ? body.chainOfCustody : [],
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    structuredContent:
      body.structuredContent && typeof body.structuredContent === 'object'
        ? body.structuredContent
        : {},
    accessRules:
      body.accessRules && typeof body.accessRules === 'object'
        ? body.accessRules
        : { locked: false },
    isHiddenClue: Boolean(body.isHiddenClue || body.accessRules?.locked),
    hiddenClueHint: body.hiddenClueHint || body.accessRules?.hint || '',
    tags: Array.isArray(body.tags) ? body.tags : [],
    relatedSuspectIds: Array.isArray(body.relatedSuspectIds) ? body.relatedSuspectIds : [],
    sortOrder: Number(body.sortOrder) || 0,
    updatedAt: new Date(),
  };

  await db
    .insert(schema.evidenceItems)
    .values(record)
    .onConflictDoUpdate({
      target: schema.evidenceItems.id,
      set: {
        evidenceCode: record.evidenceCode,
        title: record.title,
        summary: record.summary,
        description: record.description,
        section: record.section,
        viewerType: record.viewerType,
        classification: record.classification,
        sourceOrigin: record.sourceOrigin,
        collectedAt: record.collectedAt,
        collectedBy: record.collectedBy,
        locationFound: record.locationFound,
        chainOfCustody: record.chainOfCustody,
        metadata: record.metadata,
        structuredContent: record.structuredContent,
        accessRules: record.accessRules,
        isHiddenClue: record.isHiddenClue,
        hiddenClueHint: record.hiddenClueHint,
        tags: record.tags,
        relatedSuspectIds: record.relatedSuspectIds,
        sortOrder: record.sortOrder,
        updatedAt: record.updatedAt,
      },
    });

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: body.id ? 'EVIDENCE_UPDATED' : 'EVIDENCE_CREATED',
    targetType: 'evidence_item',
    targetId: evidenceId,
    caseId,
    details: { evidenceCode, title, section: record.section, viewerType: record.viewerType },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ ok: true, evidence: record });
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
  const evidenceId = new URL(request.url).searchParams.get('evidenceId');
  if (!evidenceId) {
    return NextResponse.json({ error: 'evidenceId is required.' }, { status: 400 });
  }

  const db = await getDb();
  await db
    .delete(schema.evidenceItems)
    .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.caseId, caseId)));

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'EVIDENCE_DELETED',
    targetType: 'evidence_item',
    targetId: evidenceId,
    caseId,
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ ok: true });
}
