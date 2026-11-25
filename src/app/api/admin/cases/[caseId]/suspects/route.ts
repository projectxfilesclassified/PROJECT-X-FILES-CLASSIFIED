import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { extractRequestIp, getCurrentUser, isAdmin, recordAuditLog } from '@/lib/auth';
import { generateSuspectPortraitSvg } from '@/lib/db/asset-generators';
import { putPrivateObject } from '@/lib/storage';

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

  // Manage suspect relationships
  if (body.action === 'upsert_relationship') {
    const relId = body.id || crypto.randomUUID();
    await db
      .insert(schema.suspectRelationships)
      .values({
        id: relId,
        caseId,
        sourceSuspectId: body.sourceSuspectId,
        targetSuspectId: body.targetSuspectId,
        relationshipLabel: body.relationshipLabel || 'Associated',
        relationshipType: body.relationshipType || 'professional',
        strength: Number(body.strength) || 3,
        notes: body.notes || '',
        linkedEvidenceId: body.linkedEvidenceId || null,
      })
      .onConflictDoUpdate({
        target: schema.suspectRelationships.id,
        set: {
          relationshipLabel: body.relationshipLabel || 'Associated',
          relationshipType: body.relationshipType || 'professional',
          strength: Number(body.strength) || 3,
          notes: body.notes || '',
        },
      });
    return NextResponse.json({ ok: true, id: relId });
  }

  if (body.action === 'delete_relationship' && body.id) {
    await db
      .delete(schema.suspectRelationships)
      .where(
        and(
          eq(schema.suspectRelationships.id, body.id),
          eq(schema.suspectRelationships.caseId, caseId),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  // Upsert suspect/witness profile
  const suspectId = body.id || `sus-${crypto.randomUUID().slice(0, 10)}`;
  const suspectCode = (body.suspectCode || `SUS-${Math.floor(10 + Math.random() * 89)}`).trim().toUpperCase();
  const fullName = (body.fullName || '').trim();
  if (!fullName) {
    return NextResponse.json({ error: 'Suspect full name is required.' }, { status: 400 });
  }

  let photoAssetId: string | null = body.photoAssetId ?? null;

  // Auto-generate a crisp forensic dossier silhouette if new suspect has no photo yet
  if (!photoAssetId && !body.id) {
    const assetId = `ast-${crypto.randomUUID().slice(0, 10)}`;
    const svg = generateSuspectPortraitSvg({
      code: suspectCode,
      name: fullName.toUpperCase(),
      subtitle: (body.occupation || 'SUBJECT OF INTEREST').toUpperCase(),
      accentHex: body.roleType === 'witness' ? '#2e7d5b' : '#c88a2e',
      heightCm: 176,
      silhouetteVariant: Math.floor(Math.random() * 5),
    });
    const stored = await putPrivateObject(
      `${caseId}/portraits/${suspectCode.toLowerCase()}-${assetId.slice(-4)}.svg`,
      svg,
      'image/svg+xml',
    );
    await db.insert(schema.evidenceAssets).values({
      id: assetId,
      caseId,
      evidenceItemId: null,
      storageKey: stored.storageKey,
      originalFilename: `${suspectCode.toLowerCase()}.svg`,
      mimeType: stored.mimeType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      caption: `${suspectCode} — ${fullName}`,
    });
    photoAssetId = assetId;
  }

  const record = {
    id: suspectId,
    caseId,
    suspectCode,
    fullName,
    aliases: Array.isArray(body.aliases) ? body.aliases : [],
    roleType: body.roleType || 'suspect',
    age: body.age ? Number(body.age) : null,
    dateOfBirth: body.dateOfBirth || '',
    occupation: body.occupation || '',
    residence: body.residence || '',
    relationshipToVictim: body.relationshipToVictim || '',
    photoAssetId,
    statusTag: body.statusTag || 'person_of_interest',
    threatLevel: body.threatLevel || 'moderate',
    bioSummary: body.bioSummary || '',
    motiveSummary: body.motiveSummary || '',
    alibiSummary: body.alibiSummary || '',
    alibiTimeWindow: body.alibiTimeWindow || '',
    alibiVerified: Boolean(body.alibiVerified),
    interviewRecords: Array.isArray(body.interviewRecords) ? body.interviewRecords : [],
    contradictions: Array.isArray(body.contradictions) ? body.contradictions : [],
    personalDetails: body.personalDetails && typeof body.personalDetails === 'object' ? body.personalDetails : {},
    sortOrder: Number(body.sortOrder) || 0,
    updatedAt: new Date(),
  };

  await db
    .insert(schema.suspects)
    .values(record)
    .onConflictDoUpdate({
      target: schema.suspects.id,
      set: {
        suspectCode: record.suspectCode,
        fullName: record.fullName,
        aliases: record.aliases,
        roleType: record.roleType,
        age: record.age,
        dateOfBirth: record.dateOfBirth,
        occupation: record.occupation,
        residence: record.residence,
        relationshipToVictim: record.relationshipToVictim,
        photoAssetId: record.photoAssetId ?? undefined,
        statusTag: record.statusTag,
        threatLevel: record.threatLevel,
        bioSummary: record.bioSummary,
        motiveSummary: record.motiveSummary,
        alibiSummary: record.alibiSummary,
        alibiTimeWindow: record.alibiTimeWindow,
        alibiVerified: record.alibiVerified,
        interviewRecords: record.interviewRecords,
        contradictions: record.contradictions,
        personalDetails: record.personalDetails,
        sortOrder: record.sortOrder,
        updatedAt: record.updatedAt,
      },
    });

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: body.id ? 'SUSPECT_UPDATED' : 'SUSPECT_CREATED',
    targetType: 'suspect',
    targetId: suspectId,
    caseId,
    details: { suspectCode, fullName, roleType: record.roleType },
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ ok: true, suspect: record });
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
  const suspectId = new URL(request.url).searchParams.get('suspectId');
  if (!suspectId) {
    return NextResponse.json({ error: 'suspectId is required.' }, { status: 400 });
  }

  const db = await getDb();
  await db
    .delete(schema.suspects)
    .where(and(eq(schema.suspects.id, suspectId), eq(schema.suspects.caseId, caseId)));

  await recordAuditLog({
    actorUserId: user.id,
    actorRole: user.role,
    action: 'SUSPECT_DELETED',
    targetType: 'suspect',
    targetId: suspectId,
    caseId,
    ipAddress: extractRequestIp(request),
  });

  return NextResponse.json({ ok: true });
}
