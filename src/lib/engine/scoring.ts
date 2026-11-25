import {
  DEFAULT_SCORING_CONFIG,
  type AccusationScoreBreakdown,
  type CanonicalTimelineSlot,
  type ExpiryPolicy,
  type ScoreBreakdownItem,
  type ScoringConfig,
} from '@/lib/types';

export interface ScoringInput {
  accusedSuspectId: string;
  motiveExplanation: string;
  methodExplanation: string;
  reconstructedTimeline: string[]; // ordered timeline event IDs
  supportingEvidenceIds: string[];
  isLate: boolean;
  expiryPolicy: ExpiryPolicy;
  latePenaltyPercent: number;
}

export interface ConfidentialSolutionData {
  killerSuspectId: string | null;
  killerName: string;
  accompliceSuspectIds: string[];
  motiveKeywords: string[];
  motiveCanonical: string;
  methodKeywords: string[];
  methodCanonical: string;
  requiredEvidenceIds: string[];
  bonusEvidenceIds: string[];
  canonicalTimelineOrder: CanonicalTimelineSlot[];
  solutionNarrative: string;
  evidenceCodeById: Record<string, string>;
}

export interface ScoringResult {
  totalScore: number;
  rank: string;
  passed: boolean;
  breakdown: AccusationScoreBreakdown;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreKeywordRubric(
  submissionText: string,
  keywords: string[],
  maxPoints: number,
  categoryLabel: string,
): { score: number; matched: string[]; feedback: string } {
  const normalized = normalizeText(submissionText);
  if (!normalized || normalized.length < 10) {
    return {
      score: 0,
      matched: [],
      feedback: `Insufficient ${categoryLabel.toLowerCase()} detail provided.`,
    };
  }

  if (keywords.length === 0) {
    const score = normalized.length >= 40 ? maxPoints : Math.round(maxPoints * 0.6);
    return {
      score,
      matched: ['substantive_explanation'],
      feedback: `${categoryLabel} narrative recorded and verified.`,
    };
  }

  const matched: string[] = [];
  for (const kw of keywords) {
    // Support pipe-separated synonyms inside a single keyword rule e.g. "poison|cyanide|aconitine"
    const variants = kw
      .split('|')
      .map((v) => normalizeText(v))
      .filter(Boolean);
    if (variants.length === 0) continue;
    if (variants.some((variant) => normalized.includes(variant))) {
      matched.push(kw.split('|')[0]!.trim());
    }
  }

  // Reaching 70% of rubric concepts earns full conceptual credit; scale smoothly underneath
  const targetHits = Math.max(1, Math.ceil(keywords.length * 0.65));
  const coverage = Math.min(1, matched.length / targetHits);
  const depthBonus = normalized.split(' ').length >= 15 && matched.length > 0 ? 0.1 : 0;
  const ratio = Math.min(1, coverage + depthBonus);
  const score = Math.round(maxPoints * ratio);

  let feedback: string;
  if (ratio >= 0.9) {
    feedback = `Strong ${categoryLabel.toLowerCase()} analysis capturing the critical investigative elements.`;
  } else if (ratio >= 0.5) {
    feedback = `Partial ${categoryLabel.toLowerCase()} match. Key elements identified, though secondary links were missed.`;
  } else {
    feedback = `${categoryLabel} theory diverges significantly from the verified forensic record.`;
  }

  return { score, matched, feedback };
}

function scoreTimelineOrder(
  submittedOrder: string[],
  canonicalSlots: CanonicalTimelineSlot[],
  maxPoints: number,
): { score: number; matched: string[]; feedback: string } {
  if (canonicalSlots.length === 0) {
    return {
      score: maxPoints,
      matched: ['no_canonical_constraints'],
      feedback: 'Timeline verified.',
    };
  }

  const sortedCanonical = [...canonicalSlots].sort((a, b) => a.expectedOrder - b.expectedOrder);
  const canonicalIds = sortedCanonical.map((s) => s.eventId);

  // Filter submitted order down to canonical events so user custom notes don't distort ordering
  const filteredSubmitted = submittedOrder.filter((id) => canonicalIds.includes(id));

  if (filteredSubmitted.length < 2) {
    return {
      score: 0,
      matched: [],
      feedback: 'Timeline reconstruction incomplete — insufficient canonical events sequenced.',
    };
  }

  // Pairwise concordance (Kendall-tau style) captures relative chronological correctness cleanly
  let totalPairs = 0;
  let concordantPairs = 0;
  const submittedIndexMap = new Map<string, number>();
  filteredSubmitted.forEach((id, idx) => submittedIndexMap.set(id, idx));

  for (let i = 0; i < canonicalIds.length; i++) {
    for (let j = i + 1; j < canonicalIds.length; j++) {
      totalPairs++;
      const posA = submittedIndexMap.get(canonicalIds[i]!);
      const posB = submittedIndexMap.get(canonicalIds[j]!);
      if (posA !== undefined && posB !== undefined && posA < posB) {
        concordantPairs++;
      }
    }
  }

  // Also check exact positional matches
  let exactMatches = 0;
  const matched: string[] = [];
  canonicalIds.forEach((id, idx) => {
    if (filteredSubmitted[idx] === id) {
      exactMatches++;
      matched.push(`Slot #${idx + 1} exact`);
    }
  });

  const pairRatio = totalPairs > 0 ? concordantPairs / totalPairs : 0;
  const exactRatio = canonicalIds.length > 0 ? exactMatches / canonicalIds.length : 0;
  const combinedRatio = pairRatio * 0.7 + exactRatio * 0.3;
  const score = Math.round(maxPoints * combinedRatio);

  let feedback: string;
  if (combinedRatio >= 0.9) {
    feedback = `Chronology reconstructed with high precision (${concordantPairs}/${totalPairs} event sequences aligned).`;
  } else if (combinedRatio >= 0.55) {
    feedback = `Partial chronological accuracy (${concordantPairs}/${totalPairs} relative sequences aligned). Some critical timestamps were out of order.`;
  } else {
    feedback = `Chronological sequence contained major ordering discrepancies (${concordantPairs}/${totalPairs} pairs aligned).`;
  }

  return { score, matched, feedback };
}

function scoreSupportingEvidence(
  submittedIds: string[],
  requiredIds: string[],
  bonusIds: string[],
  evidenceCodeById: Record<string, string>,
  maxPoints: number,
): { score: number; matched: string[]; feedback: string } {
  const uniqueSubmitted = Array.from(new Set(submittedIds));
  if (requiredIds.length === 0) {
    return {
      score: uniqueSubmitted.length > 0 ? maxPoints : 0,
      matched: uniqueSubmitted.map((id) => evidenceCodeById[id] || id),
      feedback: 'Supporting evidence cataloged.',
    };
  }

  const matchedRequired = requiredIds.filter((id) => uniqueSubmitted.includes(id));
  const matchedBonus = bonusIds.filter((id) => uniqueSubmitted.includes(id));
  const irrelevantCount = uniqueSubmitted.filter(
    (id) => !requiredIds.includes(id) && !bonusIds.includes(id),
  ).length;

  const recall = matchedRequired.length / requiredIds.length;
  const bonusBoost = bonusIds.length > 0 ? (matchedBonus.length / bonusIds.length) * 0.15 : 0;
  // Gentle penalty only if investigator selects excessive noise ("shotgunning" every exhibit)
  const noisePenalty = irrelevantCount > 3 ? Math.min(0.25, (irrelevantCount - 3) * 0.05) : 0;

  const finalRatio = Math.max(0, Math.min(1, recall + bonusBoost - noisePenalty));
  const score = Math.round(maxPoints * finalRatio);

  const matchedCodes = [...matchedRequired, ...matchedBonus].map(
    (id) => evidenceCodeById[id] || id,
  );

  let feedback: string;
  if (matchedRequired.length === requiredIds.length && noisePenalty === 0) {
    feedback = `All ${requiredIds.length} critical evidentiary exhibits cited cleanly.`;
  } else if (matchedRequired.length > 0) {
    feedback = `Cited ${matchedRequired.length}/${requiredIds.length} core exhibits${
      matchedBonus.length > 0 ? ` plus ${matchedBonus.length} corroborating item(s)` : ''
    }${noisePenalty > 0 ? ' (minor precision deduction for excessive unrelated exhibits)' : ''}.`;
  } else {
    feedback = 'None of the decisive evidentiary exhibits were cited in the brief.';
  }

  return { score, matched: matchedCodes, feedback };
}

export function evaluateAccusationServerSide(
  input: ScoringInput,
  solution: ConfidentialSolutionData,
  rawScoringConfig?: Partial<ScoringConfig> | null,
): ScoringResult {
  const config: ScoringConfig = {
    weights: {
      ...DEFAULT_SCORING_CONFIG.weights,
      ...(rawScoringConfig?.weights ?? {}),
    },
    passThreshold: rawScoringConfig?.passThreshold ?? DEFAULT_SCORING_CONFIG.passThreshold,
    rankThresholds: {
      ...DEFAULT_SCORING_CONFIG.rankThresholds,
      ...(rawScoringConfig?.rankThresholds ?? {}),
    },
  };

  // 1. Killer identification
  let killerScore = 0;
  let killerFeedback = 'Primary perpetrator was not correctly identified.';
  const killerMatched: string[] = [];

  if (solution.killerSuspectId && input.accusedSuspectId === solution.killerSuspectId) {
    killerScore = config.weights.killer;
    killerMatched.push(solution.killerName);
    killerFeedback = `Primary perpetrator accurately identified (${solution.killerName}).`;
  } else if (solution.accompliceSuspectIds.includes(input.accusedSuspectId)) {
    killerScore = Math.round(config.weights.killer * 0.4);
    killerMatched.push('accomplice_identified');
    killerFeedback = 'Identified a secondary accomplice, but missed the primary perpetrator.';
  }

  // 2. Motive
  const motiveEval = scoreKeywordRubric(
    input.motiveExplanation,
    solution.motiveKeywords,
    config.weights.motive,
    'Motive',
  );

  // 3. Method
  const methodEval = scoreKeywordRubric(
    input.methodExplanation,
    solution.methodKeywords,
    config.weights.method,
    'Method',
  );

  // 4. Timeline
  const timelineEval = scoreTimelineOrder(
    input.reconstructedTimeline,
    solution.canonicalTimelineOrder,
    config.weights.timeline,
  );

  // 5. Supporting Evidence
  const evidenceEval = scoreSupportingEvidence(
    input.supportingEvidenceIds,
    solution.requiredEvidenceIds,
    solution.bonusEvidenceIds,
    solution.evidenceCodeById,
    config.weights.evidence,
  );

  const items: ScoreBreakdownItem[] = [
    {
      category: 'killer',
      label: 'Perpetrator Identification',
      score: killerScore,
      maxScore: config.weights.killer,
      matchedDetails: killerMatched,
      feedback: killerFeedback,
    },
    {
      category: 'motive',
      label: 'Motive Analysis',
      score: motiveEval.score,
      maxScore: config.weights.motive,
      matchedDetails: motiveEval.matched,
      feedback: motiveEval.feedback,
    },
    {
      category: 'method',
      label: 'Method & Execution',
      score: methodEval.score,
      maxScore: config.weights.method,
      matchedDetails: methodEval.matched,
      feedback: methodEval.feedback,
    },
    {
      category: 'timeline',
      label: 'Timeline Reconstruction',
      score: timelineEval.score,
      maxScore: config.weights.timeline,
      matchedDetails: timelineEval.matched,
      feedback: timelineEval.feedback,
    },
    {
      category: 'evidence',
      label: 'Supporting Evidence',
      score: evidenceEval.score,
      maxScore: config.weights.evidence,
      matchedDetails: evidenceEval.matched,
      feedback: evidenceEval.feedback,
    },
  ];

  const rawTotal = items.reduce((sum, item) => sum + item.score, 0);
  const latePenaltyApplied =
    input.isLate && input.expiryPolicy === 'allow_late_penalty'
      ? Math.round(rawTotal * (Math.max(0, Math.min(50, input.latePenaltyPercent)) / 100))
      : 0;
  const finalScore = Math.max(0, Math.min(100, rawTotal - latePenaltyApplied));

  // Passing requires meeting score threshold AND correctly naming the killer
  const passed =
    finalScore >= config.passThreshold &&
    Boolean(solution.killerSuspectId && input.accusedSuspectId === solution.killerSuspectId);

  let rank = 'CASE UNRESOLVED';
  if (passed && finalScore >= config.rankThresholds.masterDetective) {
    rank = 'MASTER DETECTIVE';
  } else if (passed && finalScore >= config.rankThresholds.seniorInvestigator) {
    rank = 'SENIOR INVESTIGATOR';
  } else if (passed && finalScore >= config.rankThresholds.fieldDetective) {
    rank = 'FIELD DETECTIVE';
  } else if (finalScore >= config.rankThresholds.fieldDetective) {
    rank = 'INCONCLUSIVE WARRANT';
  }

  return {
    totalScore: finalScore,
    rank,
    passed,
    breakdown: {
      items,
      rawTotal,
      latePenaltyApplied,
      finalScore,
      solutionNarrative: solution.solutionNarrative,
      canonicalKillerName: solution.killerName,
      canonicalMotive: solution.motiveCanonical,
      canonicalMethod: solution.methodCanonical,
    },
  };
}
