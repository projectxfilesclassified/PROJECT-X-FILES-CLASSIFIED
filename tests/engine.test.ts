import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import os from 'node:os';
import { getDb, resetTestDatabase, schema } from '@/lib/db';
import { seedDatabase, SEED_CASE_IDS, SEED_USERS } from '@/lib/db/seed';
import { checkCaseEntitlement, hashPassword, verifyPassword } from '@/lib/auth';
import {
  computeTimerSnapshot,
  extendInvestigationTimer,
  getOrCreateInvestigationSession,
  startInvestigationSession,
} from '@/lib/engine/timer';
import { evaluateAccusationServerSide } from '@/lib/engine/scoring';
import { runCaseValidationSuite } from '@/lib/validation/case-validator';
import { getPublishedPublicCases } from '@/lib/seo/catalog';
import { buildCaseProductJsonLd, buildHomeJsonLd } from '@/lib/seo/schema';
import {
  createSignedAssetToken,
  getPrivateObject,
  putPrivateObject,
  verifySignedAssetToken,
} from '@/lib/storage';

describe('THE CASE FILES — Core Engine, Security & Published Case Validation', () => {
  beforeAll(async () => {
    process.env.PGLITE_DATA_DIR = 'memory://';
    process.env.LOCAL_STORAGE_DIR = path.join(os.tmpdir(), `casefiles-test-vault-${Date.now()}`);
    await resetTestDatabase();
    await seedDatabase({ force: true });
  });

  it('verifies password hashing and timing-safe validation', () => {
    const hash = hashPassword('ForensicSecret!2026');
    expect(verifyPassword('ForensicSecret!2026', hash)).toBe(true);
    expect(verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('validates HMAC-SHA256 signed private asset tokens, rejects tampering and expiry', async () => {
    const token = createSignedAssetToken(
      { assetId: 'ast-123', caseId: SEED_CASE_IDS.ashford, userId: SEED_USERS.investigator.id },
      300,
    );
    const verified = verifySignedAssetToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.assetId).toBe('ast-123');
    expect(verified?.userId).toBe(SEED_USERS.investigator.id);

    // Tampered token must fail
    const tampered = token.slice(0, -4) + 'AAAA';
    expect(verifySignedAssetToken(tampered)).toBeNull();

    // Expired token must fail
    const futureEpoch = Math.floor(Date.now() / 1000) + 1000;
    expect(verifySignedAssetToken(token, futureEpoch)).toBeNull();

    // Private object storage round-trip
    const payload = Buffer.from('CONFIDENTIAL FORENSIC PAYLOAD', 'utf8');
    const stored = await putPrivateObject('test-case/doc.txt', payload, 'text/plain');
    const retrieved = await getPrivateObject(stored.storageKey);
    expect(retrieved.toString('utf8')).toBe('CONFIDENTIAL FORENSIC PAYLOAD');
    expect(stored.sha256).toHaveLength(64);
  });

  it('enforces purchase entitlement gating and admin preview RBAC', async () => {
    const invAccessCase1 = await checkCaseEntitlement(SEED_USERS.investigator, SEED_CASE_IDS.ashford);
    expect(invAccessCase1.allowed).toBe(true);
    expect(invAccessCase1.isPreview).toBe(false);

    // Demo investigator does NOT own Case 2 (Meridian Express) initially
    const invAccessCase2 = await checkCaseEntitlement(SEED_USERS.investigator, SEED_CASE_IDS.meridian);
    expect(invAccessCase2.allowed).toBe(false);

    // Admin has full preview/access across all cases
    const adminAccessCase2 = await checkCaseEntitlement(SEED_USERS.admin, SEED_CASE_IDS.meridian);
    expect(adminAccessCase2.allowed).toBe(true);
  });

  it('enforces server-authoritative 4-hour timer, idempotency, expiry policy, and audited admin extensions', async () => {
    const db = await getDb();
    const caseRows = await db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.id, SEED_CASE_IDS.ashford))
      .limit(1);
    const ashfordCase = caseRows[0]!;

    // Before explicit start -> status is not_started, full 4 hours intact
    const initial = await getOrCreateInvestigationSession(
      SEED_USERS.investigator.id,
      SEED_CASE_IDS.ashford,
    );
    const beforeStart = computeTimerSnapshot(initial.session, ashfordCase);
    expect(beforeStart.status).toBe('not_started');
    expect(beforeStart.remainingSeconds).toBe(14400);
    expect(beforeStart.canSubmit).toBe(false);

    // Explicit start sets server-authoritative deadline
    const t0 = new Date('2026-11-25T10:00:00.000Z');
    const started = await startInvestigationSession(
      SEED_USERS.investigator,
      SEED_CASE_IDS.ashford,
      '127.0.0.1',
      t0,
    );
    expect(started.status).toBe('active');
    expect(started.startedAt).toBe(t0.toISOString());
    expect(started.deadlineAt).toBe(new Date(t0.getTime() + 14400 * 1000).toISOString());

    // Calling start again 30 minutes later MUST NOT reset deadline
    const t30m = new Date(t0.getTime() + 1800 * 1000);
    const secondCall = await startInvestigationSession(
      SEED_USERS.investigator,
      SEED_CASE_IDS.ashford,
      '127.0.0.1',
      t30m,
    );
    expect(secondCall.startedAt).toBe(t0.toISOString());
    expect(secondCall.remainingSeconds).toBe(14400 - 1800);

    // Expired state check under hard_lock vs allow_late_penalty
    const after5h = new Date(t0.getTime() + 18000 * 1000);
    const refreshedSession = (
      await db
        .select()
        .from(schema.investigationSessions)
        .where(eq(schema.investigationSessions.id, initial.session.id))
        .limit(1)
    )[0]!;

    const expiredPenalty = computeTimerSnapshot(refreshedSession, {
      ...ashfordCase,
      expiryPolicy: 'allow_late_penalty',
    }, after5h);
    expect(expiredPenalty.isExpired).toBe(true);
    expect(expiredPenalty.canSubmit).toBe(true);

    const expiredHardLock = computeTimerSnapshot(refreshedSession, {
      ...ashfordCase,
      expiryPolicy: 'hard_lock',
    }, after5h);
    expect(expiredHardLock.isExpired).toBe(true);
    expect(expiredHardLock.canSubmit).toBe(false);

    // Non-admin attempting timer extension must be rejected
    await expect(
      extendInvestigationTimer({
        adminUser: SEED_USERS.investigator,
        sessionId: refreshedSession.id,
        extensionMinutes: 30,
        reason: 'Unauthorized self-extension attempt',
      }),
    ).rejects.toThrow(/Administrator privileges required/);

    // Admin extension succeeds and logs immutable audit record
    const extended = await extendInvestigationTimer({
      adminUser: SEED_USERS.admin,
      sessionId: refreshedSession.id,
      extensionMinutes: 30,
      reason: 'Customer support verified browser outage',
      ipAddress: '127.0.0.1',
    });
    expect(extended.totalExtensionSeconds).toBe(1800);

    const auditRows = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, 'TIMER_EXTENDED'));
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    expect(auditRows[0]?.details).toMatchObject({
      addedMinutes: 30,
      reason: 'Customer support verified browser outage',
    });
  });

  it('scores accusations accurately server-side and applies late penalty when configured', () => {
    const solution = {
      killerSuspectId: 'sus-ash-02',
      killerName: 'Dr. Marcus Vance',
      accompliceSuspectIds: [],
      motiveKeywords: [
        'falsified|fabricated|fraud',
        'clinical trial|phase-iii|fda|regulatory',
        'medical board|license|audit',
      ],
      motiveCanonical: 'Prevent disclosure of falsified clinical trial data.',
      methodKeywords: [
        'aconitine|poison|ampoule',
        'wine|bordeaux|decanter',
        'cloned|rfid|service corridor',
      ],
      methodCanonical: 'Laced Bordeaux decanter with aconitine using cloned RFID-09B badge.',
      requiredEvidenceIds: ['ev-ash-003', 'ev-ash-006', 'ev-ash-013', 'ev-ash-015'],
      bonusEvidenceIds: ['ev-ash-005', 'ev-ash-007'],
      canonicalTimelineOrder: [
        { eventId: 'tl-1', expectedOrder: 1, weight: 1 },
        { eventId: 'tl-2', expectedOrder: 2, weight: 2 },
        { eventId: 'tl-3', expectedOrder: 3, weight: 2 },
        { eventId: 'tl-4', expectedOrder: 4, weight: 1 },
      ],
      solutionNarrative: 'Official forensic debrief.',
      evidenceCodeById: {
        'ev-ash-003': 'EV-003',
        'ev-ash-006': 'EV-006',
        'ev-ash-013': 'EV-013',
        'ev-ash-015': 'EV-015',
        'ev-ash-005': 'EV-005',
      },
    };

    const perfect = evaluateAccusationServerSide(
      {
        accusedSuspectId: 'sus-ash-02',
        motiveExplanation:
          'Dr. Marcus Vance falsified Phase-III clinical trial toxicity data and Julian threatened to report him to the FDA and Medical Board based on the audit.',
        methodExplanation:
          'Vance used a cloned RFID badge to enter via the service corridor and poisoned Julian’s Bordeaux wine decanter with a clinical aconitine ampoule.',
        reconstructedTimeline: ['tl-1', 'tl-2', 'tl-3', 'tl-4'],
        supportingEvidenceIds: ['ev-ash-003', 'ev-ash-006', 'ev-ash-013', 'ev-ash-015', 'ev-ash-005'],
        isLate: false,
        expiryPolicy: 'allow_late_penalty',
        latePenaltyPercent: 15,
      },
      solution,
    );

    expect(perfect.passed).toBe(true);
    expect(perfect.totalScore).toBeGreaterThanOrEqual(95);
    expect(perfect.rank).toBe('MASTER DETECTIVE');

    // Wrong killer must fail warrant even if motive/method partially match
    const wrongKiller = evaluateAccusationServerSide(
      {
        accusedSuspectId: 'sus-ash-01',
        motiveExplanation: 'Financial divorce dispute over estate codicil.',
        methodExplanation: 'Poisoned the wine decanter with aconitine.',
        reconstructedTimeline: ['tl-1', 'tl-3', 'tl-2', 'tl-4'],
        supportingEvidenceIds: ['ev-ash-003'],
        isLate: false,
        expiryPolicy: 'allow_late_penalty',
        latePenaltyPercent: 15,
      },
      solution,
    );
    expect(wrongKiller.passed).toBe(false);
    expect(wrongKiller.breakdown.items.find((i) => i.category === 'killer')?.score).toBe(0);

    // Late penalty applied cleanly
    const lateResult = evaluateAccusationServerSide(
      {
        accusedSuspectId: 'sus-ash-02',
        motiveExplanation:
          'Falsified clinical trial data and pending FDA and medical board audit exposure.',
        methodExplanation:
          'Cloned RFID maintenance card via service corridor and aconitine poison in Bordeaux wine decanter.',
        reconstructedTimeline: ['tl-1', 'tl-2', 'tl-3', 'tl-4'],
        supportingEvidenceIds: ['ev-ash-003', 'ev-ash-006', 'ev-ash-013', 'ev-ash-015'],
        isLate: true,
        expiryPolicy: 'allow_late_penalty',
        latePenaltyPercent: 15,
      },
      solution,
    );
    expect(lateResult.breakdown.latePenaltyApplied).toBe(15);
    expect(lateResult.totalScore).toBe(85);
  });

  it('passes comprehensive validation suite on EVERY published seed case', async () => {
    const db = await getDb();
    const published = await db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.status, 'published'));

    expect(published.length).toBeGreaterThanOrEqual(2);

    for (const c of published) {
      const report = await runCaseValidationSuite(c.id);
      expect(report.failures).toBe(0);
      expect(report.validForPublish).toBe(true);
    }
  });

  it('generates spoiler-free commercial SEO catalog and Schema.org JSON-LD graphs', async () => {
    const publicCases = await getPublishedPublicCases();
    expect(publicCases.length).toBeGreaterThanOrEqual(2);

    const homeLd = buildHomeJsonLd(publicCases);
    const homeJson = JSON.stringify(homeLd);
    expect(homeJson).toContain('"@type":"Organization"');
    expect(homeJson).toContain('"@type":"VideoGame"');
    expect(homeJson).toContain('"@type":"ItemList"');
    expect(homeJson).toContain('"@type":"FAQPage"');
    expect(homeJson).not.toContain('killerSuspectId');
    expect(homeJson).not.toContain('4819');

    const productLd = buildCaseProductJsonLd(publicCases[0]!);
    const productJson = JSON.stringify(productLd);
    expect(productJson).toContain('"@type":"Product"');
    expect(productJson).toContain('"@type":"BreadcrumbList"');
    expect(productJson).toContain('https://schema.org/InStock');
  });
});
