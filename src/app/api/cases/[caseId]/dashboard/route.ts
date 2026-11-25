import { NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import {
  checkCaseEntitlement,
  extractRequestIp,
  getCurrentUser,
  recordAuditLog,
} from '@/lib/auth';
import { computeTimerSnapshot, getOrCreateInvestigationSession } from '@/lib/engine/timer';
import { generateSignedAssetUrl } from '@/lib/storage';

/**
 * Loads the complete dynamic Case Dashboard payload from PostgreSQL.
 * SECURITY INVARIANTS:
 * 1. Validates authentication & active purchase entitlement (or Admin preview).
 * 2. NEVER queries or returns `case_solutions` (confidential answer key).
 * 3. Server-redacts locked hidden clues & strips unlock passcodes before serialization.
 * 4. Signs every private storage asset URL with user-bound short-lived HMAC tokens.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId } = await context.params;
  const access = await checkCaseEntitlement(user, caseId);

  if (!access.allowed || !access.caseRecord) {
    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'CASE_ACCESS_DENIED',
      targetType: 'case',
      targetId: caseId,
      caseId,
      details: { reason: access.reason },
      ipAddress: extractRequestIp(request),
    });
    return NextResponse.json(
      { error: access.reason || 'Access denied.', requiresEntitlement: true },
      { status: 403 },
    );
  }

  const db = await getDb();
  const caseRecord = access.caseRecord;

  const { session, workspace } = await getOrCreateInvestigationSession(user.id, caseId);

  const [
    suspectRows,
    suspectRelRows,
    evidenceRows,
    assetRows,
    evidenceRelRows,
    timelineRows,
    submissions,
  ] = await Promise.all([
    db
      .select()
      .from(schema.suspects)
      .where(eq(schema.suspects.caseId, caseId))
      .orderBy(asc(schema.suspects.sortOrder)),
    db
      .select()
      .from(schema.suspectRelationships)
      .where(eq(schema.suspectRelationships.caseId, caseId)),
    db
      .select()
      .from(schema.evidenceItems)
      .where(eq(schema.evidenceItems.caseId, caseId))
      .orderBy(asc(schema.evidenceItems.sortOrder)),
    db
      .select()
      .from(schema.evidenceAssets)
      .where(eq(schema.evidenceAssets.caseId, caseId))
      .orderBy(asc(schema.evidenceAssets.sortOrder)),
    db
      .select()
      .from(schema.evidenceRelations)
      .where(eq(schema.evidenceRelations.caseId, caseId)),
    db
      .select()
      .from(schema.caseTimelineEvents)
      .where(eq(schema.caseTimelineEvents.caseId, caseId))
      .orderBy(asc(schema.caseTimelineEvents.sortOrder)),
    db
      .select()
      .from(schema.accusationSubmissions)
      .where(eq(schema.accusationSubmissions.sessionId, session.id))
      .orderBy(desc(schema.accusationSubmissions.submittedAt)),
  ]);

  const timer = computeTimerSnapshot(session, caseRecord, new Date());
  const unlockedSet = new Set(session.unlockedEvidenceIds ?? []);

  // Sign private assets map (only sign assets that are either non-evidence portraits or unlocked evidence)
  const lockedEvidenceIds = new Set<string>();
  for (const ev of evidenceRows) {
    if (ev.accessRules?.locked && !unlockedSet.has(ev.id)) {
      lockedEvidenceIds.add(ev.id);
    }
  }

  const signedAssetMap = new Map<
    string,
    {
      id: string;
      originalFilename: string;
      mimeType: string;
      byteSize: number;
      sha256: string;
      caption: string;
      url: string;
      expiresAt: string;
    }
  >();

  await Promise.all(
    assetRows.map(async (asset) => {
      if (asset.evidenceItemId && lockedEvidenceIds.has(asset.evidenceItemId)) {
        return; // Do NOT sign assets belonging to locked evidence items
      }
      const signed = await generateSignedAssetUrl({
        assetId: asset.id,
        caseId,
        userId: user.id,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
      });
      signedAssetMap.set(asset.id, {
        id: asset.id,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        sha256: asset.sha256,
        caption: asset.caption,
        url: signed.url,
        expiresAt: signed.expiresAt,
      });
    }),
  );

  // Build assets grouped by evidenceItemId
  const assetsByEvidence = new Map<string, ReturnType<typeof signedAssetMap.get>[]>();
  for (const asset of assetRows) {
    if (!asset.evidenceItemId) continue;
    const signed = signedAssetMap.get(asset.id);
    if (!signed) continue;
    const list = assetsByEvidence.get(asset.evidenceItemId) ?? [];
    list.push(signed);
    assetsByEvidence.set(asset.evidenceItemId, list);
  }

  // Sanitize evidence items: strip passcode and redact locked content
  const evidence = evidenceRows.map((ev) => {
    const isLocked = lockedEvidenceIds.has(ev.id);
    const safeAccessRules = {
      locked: isLocked,
      unlockType: ev.accessRules?.unlockType ?? 'none',
      requiredEvidenceCodes: ev.accessRules?.requiredEvidenceCodes ?? [],
      minElapsedSeconds: ev.accessRules?.minElapsedSeconds,
      hint: ev.accessRules?.hint || ev.hiddenClueHint || '',
      lockReason: ev.accessRules?.lockReason || 'RESTRICTED ACCESS — UNLOCK CONDITION REQUIRED',
    };

    if (isLocked) {
      return {
        id: ev.id,
        evidenceCode: ev.evidenceCode,
        title: ev.title,
        summary: 'Encrypted / Restricted exhibit. Satisfy access rule to decrypt contents.',
        description: safeAccessRules.lockReason,
        section: ev.section,
        viewerType: ev.viewerType,
        classification: ev.classification,
        sourceOrigin: ev.sourceOrigin,
        collectedAt: ev.collectedAt,
        collectedBy: ev.collectedBy,
        locationFound: ev.locationFound,
        chainOfCustody: [],
        metadata: { Status: 'SEALED / LOCKED' },
        structuredContent: {},
        accessRules: safeAccessRules,
        isHiddenClue: ev.isHiddenClue,
        tags: ev.tags,
        relatedSuspectIds: [],
        assets: [],
        sortOrder: ev.sortOrder,
      };
    }

    return {
      id: ev.id,
      evidenceCode: ev.evidenceCode,
      title: ev.title,
      summary: ev.summary,
      description: ev.description,
      section: ev.section,
      viewerType: ev.viewerType,
      classification: ev.classification,
      sourceOrigin: ev.sourceOrigin,
      collectedAt: ev.collectedAt,
      collectedBy: ev.collectedBy,
      locationFound: ev.locationFound,
      chainOfCustody: ev.chainOfCustody,
      metadata: ev.metadata,
      structuredContent: ev.structuredContent,
      accessRules: safeAccessRules,
      isHiddenClue: ev.isHiddenClue,
      tags: ev.tags,
      relatedSuspectIds: ev.relatedSuspectIds,
      assets: assetsByEvidence.get(ev.id) ?? [],
      sortOrder: ev.sortOrder,
    };
  });

  // Sanitize suspects: attach signed portrait URLs; never expose confidential answer fields
  const suspects = suspectRows.map((s) => ({
    id: s.id,
    suspectCode: s.suspectCode,
    fullName: s.fullName,
    aliases: s.aliases,
    roleType: s.roleType,
    age: s.age,
    dateOfBirth: s.dateOfBirth,
    occupation: s.occupation,
    residence: s.residence,
    relationshipToVictim: s.relationshipToVictim,
    photoUrl: s.photoAssetId ? signedAssetMap.get(s.photoAssetId)?.url ?? null : null,
    statusTag: s.statusTag,
    threatLevel: s.threatLevel,
    bioSummary: s.bioSummary,
    motiveSummary: s.motiveSummary,
    alibiSummary: s.alibiSummary,
    alibiTimeWindow: s.alibiTimeWindow,
    alibiVerified: s.alibiVerified,
    interviewRecords: s.interviewRecords,
    contradictions: s.contradictions,
    personalDetails: s.personalDetails,
    sortOrder: s.sortOrder,
  }));

  return NextResponse.json({
    isPreview: access.isPreview,
    case: {
      id: caseRecord.id,
      slug: caseRecord.slug,
      caseNumber: caseRecord.caseNumber,
      title: caseRecord.title,
      subtitle: caseRecord.subtitle,
      classification: caseRecord.classification,
      status: caseRecord.status,
      difficulty: caseRecord.difficulty,
      summary: caseRecord.summary,
      briefingMarkdown: caseRecord.briefingMarkdown,
      incidentLocation: caseRecord.incidentLocation,
      incidentDate: caseRecord.incidentDate,
      victimName: caseRecord.victimName,
      victimSummary: caseRecord.victimSummary,
      victimPhotoUrl: caseRecord.victimPhotoAssetId
        ? signedAssetMap.get(caseRecord.victimPhotoAssetId)?.url ?? null
        : null,
      defaultDurationSeconds: caseRecord.defaultDurationSeconds,
      expiryPolicy: caseRecord.expiryPolicy,
      latePenaltyPercent: caseRecord.latePenaltyPercent,
      maxAccusationAttempts: caseRecord.maxAccusationAttempts,
      scoringWeights: caseRecord.scoringConfig.weights,
      metadata: caseRecord.metadata,
    },
    timer,
    session: {
      id: session.id,
      unlockedEvidenceIds: session.unlockedEvidenceIds,
      viewedEvidenceIds: session.viewedEvidenceIds,
      bookmarkedEvidenceIds: session.bookmarkedEvidenceIds,
    },
    workspace: {
      boardState: workspace.boardState,
      timelineState: workspace.timelineState,
      notebookEntries: workspace.notebookEntries,
      suspectNotes: workspace.suspectNotes,
      evidenceAnnotations: workspace.evidenceAnnotations,
      accusationDraft: workspace.accusationDraft,
      version: workspace.version,
      updatedAt: workspace.updatedAt,
    },
    suspects,
    suspectRelationships: suspectRelRows,
    evidence,
    evidenceRelations: evidenceRelRows,
    timelineEvents: timelineRows,
    submissions: submissions.map((sub) => ({
      id: sub.id,
      accusedSuspectId: sub.accusedSuspectId,
      motiveExplanation: sub.motiveExplanation,
      methodExplanation: sub.methodExplanation,
      reconstructedTimeline: sub.reconstructedTimeline,
      supportingEvidenceIds: sub.supportingEvidenceIds,
      isLate: sub.isLate,
      elapsedSeconds: sub.elapsedSeconds,
      totalScore: sub.totalScore,
      rank: sub.rank,
      passed: sub.passed,
      scoreBreakdown: sub.scoreBreakdown,
      submittedAt: sub.submittedAt,
    })),
  });
}
