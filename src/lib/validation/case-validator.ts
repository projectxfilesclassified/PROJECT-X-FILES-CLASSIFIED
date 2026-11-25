import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { privateObjectExists } from '@/lib/storage';
import type { CaseValidationReport, ValidationCheckResult } from '@/lib/types';

const SPOILER_PATTERNS = [
  /\b(is the killer|actual killer|true murderer|guilty perpetrator|solution:)\b/i,
];

export async function runCaseValidationSuite(caseId: string): Promise<CaseValidationReport> {
  const db = await getDb();
  const checks: ValidationCheckResult[] = [];

  const caseRows = await db.select().from(schema.cases).where(eq(schema.cases.id, caseId)).limit(1);
  const caseRow = caseRows[0];
  if (!caseRow) {
    throw new Error('Case not found');
  }

  const [suspectRows, evidenceRows, assetRows, relationRows, timelineRows, solutionRows] =
    await Promise.all([
      db.select().from(schema.suspects).where(eq(schema.suspects.caseId, caseId)),
      db.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.caseId, caseId)),
      db.select().from(schema.evidenceAssets).where(eq(schema.evidenceAssets.caseId, caseId)),
      db.select().from(schema.evidenceRelations).where(eq(schema.evidenceRelations.caseId, caseId)),
      db.select().from(schema.caseTimelineEvents).where(eq(schema.caseTimelineEvents.caseId, caseId)),
      db.select().from(schema.caseSolutions).where(eq(schema.caseSolutions.caseId, caseId)),
    ]);

  const solution = solutionRows[0];
  const suspectIds = new Set(suspectRows.map((s) => s.id));
  const evidenceIds = new Set(evidenceRows.map((e) => e.id));
  const timelineIds = new Set(timelineRows.map((t) => t.id));

  // 1. Core case briefing metadata
  const hasBriefing =
    caseRow.title.trim().length >= 3 &&
    caseRow.summary.trim().length >= 20 &&
    caseRow.victimName.trim().length >= 2 &&
    caseRow.incidentLocation.trim().length >= 2;
  checks.push({
    id: 'case-briefing',
    category: 'structure',
    status: hasBriefing ? 'pass' : 'fail',
    title: 'Core Case Briefing & Victim Dossier',
    detail: hasBriefing
      ? `Title, victim (${caseRow.victimName}), location, and executive summary configured.`
      : 'Case title, victim name, incident location, and summary (>= 20 chars) are required.',
  });

  // 2. Timer configuration
  const validTimer = caseRow.defaultDurationSeconds >= 600 && caseRow.defaultDurationSeconds <= 86400;
  checks.push({
    id: 'timer-config',
    category: 'gameplay',
    status: validTimer ? 'pass' : 'fail',
    title: 'Authoritative Investigation Timer Policy',
    detail: validTimer
      ? `Configured for ${Math.round(caseRow.defaultDurationSeconds / 60)} minutes (${caseRow.expiryPolicy}).`
      : 'Default duration must be between 10 minutes (600s) and 24 hours (86400s).',
  });

  // 3. Suspect count
  const activeSuspects = suspectRows.filter((s) => s.roleType === 'suspect');
  checks.push({
    id: 'suspect-pool',
    category: 'gameplay',
    status: activeSuspects.length >= 2 ? 'pass' : 'fail',
    title: 'Suspect Intelligence Pool',
    detail:
      activeSuspects.length >= 2
        ? `${activeSuspects.length} primary suspect(s) and ${suspectRows.length - activeSuspects.length} witness/associate profile(s) loaded.`
        : 'At least 2 suspect profiles are required for a playable investigation.',
  });

  // 4. Anti-spoiler check on suspect profiles
  const spoilerLeaks: string[] = [];
  for (const s of suspectRows) {
    const combined = `${s.bioSummary} ${s.motiveSummary} ${s.alibiSummary} ${JSON.stringify(s.contradictions)}`;
    if (SPOILER_PATTERNS.some((rx) => rx.test(combined))) {
      spoilerLeaks.push(`${s.suspectCode} (${s.fullName})`);
    }
  }
  checks.push({
    id: 'anti-spoiler-guard',
    category: 'security',
    status: spoilerLeaks.length === 0 ? 'pass' : 'fail',
    title: 'Suspect Profile Confidentiality Guard',
    detail:
      spoilerLeaks.length === 0
        ? 'No direct killer/solution disclosure phrases detected inside player-visible suspect profiles.'
        : `Potential spoiler wording found in: ${spoilerLeaks.join(', ')}.`,
  });

  // 5. Confidential solution existence & valid killer FK
  const hasSolution = Boolean(solution && solution.killerSuspectId && suspectIds.has(solution.killerSuspectId));
  checks.push({
    id: 'confidential-solution',
    category: 'scoring',
    status: hasSolution ? 'pass' : 'fail',
    title: 'Confidential Answer Key & Killer Binding',
    detail: hasSolution
      ? 'Confidential answer key is isolated in case_solutions and linked to a valid suspect profile.'
      : 'Missing confidential solution or killer suspect reference.',
  });

  // 6. Scoring weights sum to 100
  const w = caseRow.scoringConfig?.weights;
  const weightSum = w ? w.killer + w.motive + w.method + w.timeline + w.evidence : 0;
  checks.push({
    id: 'scoring-weights',
    category: 'scoring',
    status: weightSum === 100 ? 'pass' : 'fail',
    title: 'Server Scoring Weights Integrity',
    detail:
      weightSum === 100
        ? `Weights sum cleanly to 100 pts (Killer ${w.killer}, Motive ${w.motive}, Method ${w.method}, Timeline ${w.timeline}, Evidence ${w.evidence}).`
        : `Scoring weights currently sum to ${weightSum}; must equal 100.`,
  });

  // 7. Motive & method rubric keywords
  const hasRubrics =
    Boolean(solution) &&
    (solution.motiveKeywords?.length ?? 0) >= 2 &&
    (solution.methodKeywords?.length ?? 0) >= 2 &&
    (solution.solutionNarrative?.trim().length ?? 0) >= 30;
  checks.push({
    id: 'scoring-rubrics',
    category: 'scoring',
    status: hasRubrics ? 'pass' : 'warn',
    title: 'Motive, Method & Debrief Rubrics',
    detail: hasRubrics
      ? `${solution!.motiveKeywords.length} motive keyword rules, ${solution!.methodKeywords.length} method keyword rules, and debrief narrative configured.`
      : 'Add at least 2 motive keywords, 2 method keywords, and a post-accusation narrative for accurate automated grading.',
  });

  // 8. Evidence archive volume & section coverage
  const sectionsPresent = new Set(evidenceRows.map((e) => e.section));
  checks.push({
    id: 'evidence-archive',
    category: 'structure',
    status: evidenceRows.length >= 4 ? 'pass' : 'fail',
    title: 'Evidence Archive Coverage',
    detail: `${evidenceRows.length} evidence exhibit(s) across ${sectionsPresent.size}/10 navigation categories.`,
  });

  // 9. Required solution evidence references valid
  const missingReqEvidence = (solution?.requiredEvidenceIds ?? []).filter((id) => !evidenceIds.has(id));
  const hasReqEvidence = (solution?.requiredEvidenceIds?.length ?? 0) >= 1 && missingReqEvidence.length === 0;
  checks.push({
    id: 'solution-evidence-links',
    category: 'scoring',
    status: hasReqEvidence ? 'pass' : 'fail',
    title: 'Required Evidence Reference Integrity',
    detail: hasReqEvidence
      ? `All ${solution!.requiredEvidenceIds.length} required scoring exhibit(s) exist in the case archive.`
      : missingReqEvidence.length > 0
        ? `Broken evidence IDs in confidential solution: ${missingReqEvidence.join(', ')}.`
        : 'Configure at least 1 required supporting evidence item in the confidential solution.',
  });

  // 10. Evidence relation integrity
  const brokenRelations = relationRows.filter(
    (r) => !evidenceIds.has(r.sourceEvidenceId) || !evidenceIds.has(r.targetEvidenceId),
  );
  checks.push({
    id: 'evidence-relations',
    category: 'structure',
    status: brokenRelations.length === 0 ? 'pass' : 'fail',
    title: 'Evidence Relationship Graph Integrity',
    detail:
      brokenRelations.length === 0
        ? `${relationRows.length} evidence relationship link(s) verified with zero dangling references.`
        : `${brokenRelations.length} broken evidence relationship link(s) detected.`,
  });

  // 11. Hidden clue reachability
  const lockedItems = evidenceRows.filter((e) => e.accessRules?.locked);
  const invalidLocks = lockedItems.filter((e) => {
    const type = e.accessRules?.unlockType;
    if (type === 'passcode') return !e.accessRules?.passcode?.trim();
    if (type === 'viewed_evidence') return !(e.accessRules?.requiredEvidenceCodes?.length);
    return false;
  });
  checks.push({
    id: 'hidden-clues',
    category: 'gameplay',
    status: invalidLocks.length === 0 ? 'pass' : 'fail',
    title: 'Hidden Clue & Access Rule Reachability',
    detail:
      invalidLocks.length === 0
        ? `${lockedItems.length} locked/hidden evidence item(s) have valid server unlock conditions.`
        : `${invalidLocks.length} locked evidence item(s) lack a passcode or prerequisite code.`,
  });

  // 12. Timeline events & canonical scoring alignment
  const invalidTimelineSlots = (solution?.canonicalTimelineOrder ?? []).filter(
    (slot) => !timelineIds.has(slot.eventId),
  );
  checks.push({
    id: 'timeline-integrity',
    category: 'gameplay',
    status: timelineRows.length >= 3 && invalidTimelineSlots.length === 0 ? 'pass' : 'fail',
    title: 'Timeline Reconstruction & Canonical Slots',
    detail:
      timelineRows.length >= 3 && invalidTimelineSlots.length === 0
        ? `${timelineRows.length} timeline events defined (${solution?.canonicalTimelineOrder?.length ?? 0} canonical scoring slots verified).`
        : invalidTimelineSlots.length > 0
          ? `${invalidTimelineSlots.length} canonical timeline slot(s) point to missing events.`
          : 'At least 3 timeline events are required for timeline reconstruction.',
  });

  // 13. Private object storage asset presence check
  const missingAssets: string[] = [];
  for (const asset of assetRows) {
    const exists = await privateObjectExists(asset.storageKey);
    if (!exists) {
      missingAssets.push(`${asset.originalFilename} (${asset.storageKey})`);
    }
  }
  checks.push({
    id: 'private-storage-assets',
    category: 'assets',
    status: missingAssets.length === 0 ? 'pass' : 'fail',
    title: 'Private Object Storage Asset Integrity',
    detail:
      missingAssets.length === 0
        ? `All ${assetRows.length} private storage asset(s) exist and are ready for signed delivery.`
        : `Missing ${missingAssets.length} asset file(s) in private storage: ${missingAssets.slice(0, 3).join(', ')}.`,
  });

  const passed = checks.filter((c) => c.status === 'pass').length;
  const warnings = checks.filter((c) => c.status === 'warn').length;
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    caseId: caseRow.id,
    caseTitle: caseRow.title,
    validForPublish: failures === 0,
    passed,
    warnings,
    failures,
    checkedAt: new Date().toISOString(),
    checks,
  };
}
