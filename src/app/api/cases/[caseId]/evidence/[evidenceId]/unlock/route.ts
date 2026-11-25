import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import {
  checkCaseEntitlement,
  extractRequestIp,
  getCurrentUser,
  recordAuditLog,
} from '@/lib/auth';
import { computeTimerSnapshot, getOrCreateInvestigationSession } from '@/lib/engine/timer';
import { generateSignedAssetUrl } from '@/lib/storage';

const unlockSchema = z.object({
  passcode: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string; evidenceId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { caseId, evidenceId } = await context.params;
  const access = await checkCaseEntitlement(user, caseId);
  if (!access.allowed || !access.caseRecord) {
    return NextResponse.json({ error: access.reason || 'Access denied.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = unlockSchema.safeParse(body);
  const submittedCode = parsed.success ? (parsed.data.passcode ?? '').trim() : '';

  const db = await getDb();
  const evRows = await db
    .select()
    .from(schema.evidenceItems)
    .where(
      and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.caseId, caseId)),
    )
    .limit(1);

  const evidence = evRows[0];
  if (!evidence) {
    return NextResponse.json({ error: 'Evidence item not found.' }, { status: 404 });
  }

  const { session } = await getOrCreateInvestigationSession(user.id, caseId);
  const timer = computeTimerSnapshot(session, access.caseRecord, new Date());

  const rules = evidence.accessRules;
  if (rules?.locked && !(session.unlockedEvidenceIds ?? []).includes(evidence.id)) {
    const unlockType = rules.unlockType ?? 'passcode';

    if (unlockType === 'passcode') {
      const expected = (rules.passcode ?? '').trim();
      if (!expected || submittedCode.toLowerCase() !== expected.toLowerCase()) {
        await recordAuditLog({
          actorUserId: user.id,
          actorRole: user.role,
          action: 'CLUE_UNLOCK_FAILED',
          targetType: 'evidence_item',
          targetId: evidence.id,
          caseId,
          details: { evidenceCode: evidence.evidenceCode },
          ipAddress: extractRequestIp(request),
        });
        return NextResponse.json(
          { error: 'Decryption code rejected. Review the hint and corroborating exhibits.' },
          { status: 400 },
        );
      }
    } else if (unlockType === 'viewed_evidence') {
      const requiredCodes = rules.requiredEvidenceCodes ?? [];
      const allCaseEvidence = await db
        .select({ id: schema.evidenceItems.id, code: schema.evidenceItems.evidenceCode })
        .from(schema.evidenceItems)
        .where(eq(schema.evidenceItems.caseId, caseId));
      const viewedSet = new Set(session.viewedEvidenceIds ?? []);
      const missing = requiredCodes.filter((code) => {
        const match = allCaseEvidence.find((e) => e.code.toLowerCase() === code.toLowerCase());
        return !match || !viewedSet.has(match.id);
      });
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Prerequisite exhibits must be reviewed first: ${missing.join(', ')}` },
          { status: 400 },
        );
      }
    } else if (unlockType === 'time_elapsed') {
      const minSec = rules.minElapsedSeconds ?? 0;
      if (timer.elapsedSeconds < minSec) {
        return NextResponse.json(
          { error: `This restricted drop unlocks after ${Math.ceil(minSec / 60)} minutes of active investigation.` },
          { status: 400 },
        );
      }
    }

    const updatedUnlocked = Array.from(new Set([...(session.unlockedEvidenceIds ?? []), evidence.id]));
    await db
      .update(schema.investigationSessions)
      .set({ unlockedEvidenceIds: updatedUnlocked, updatedAt: new Date() })
      .where(eq(schema.investigationSessions.id, session.id));

    await recordAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'CLUE_UNLOCKED',
      targetType: 'evidence_item',
      targetId: evidence.id,
      caseId,
      details: { evidenceCode: evidence.evidenceCode, unlockType },
      ipAddress: extractRequestIp(request),
    });
  }

  // Sign newly unlocked evidence assets
  const assetRows = await db
    .select()
    .from(schema.evidenceAssets)
    .where(eq(schema.evidenceAssets.evidenceItemId, evidence.id));

  const signedAssets = await Promise.all(
    assetRows.map(async (asset) => {
      const signed = await generateSignedAssetUrl({
        assetId: asset.id,
        caseId,
        userId: user.id,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
      });
      return {
        id: asset.id,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        sha256: asset.sha256,
        caption: asset.caption,
        url: signed.url,
        expiresAt: signed.expiresAt,
      };
    }),
  );

  return NextResponse.json({
    ok: true,
    evidence: {
      ...evidence,
      accessRules: {
        locked: false,
        unlockType: evidence.accessRules?.unlockType ?? 'none',
        hint: evidence.accessRules?.hint ?? '',
      },
      assets: signedAssets,
    },
  });
}
