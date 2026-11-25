'use client';

import React, { useMemo, useState } from 'react';
import {
  Gavel,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Award,
  Clock,
  Lock,
  FileCheck2,
} from 'lucide-react';
import {
  formatDurationHms,
  type ClientEvidence,
  type ClientSubmission,
  type ClientSuspect,
  type ClientTimelineEvent,
} from '@/lib/client-types';
import type { ServerTimerSnapshot } from '@/lib/engine/timer';
import type { AccusationDraft, ScoringConfig } from '@/lib/types';

export default function FinalAccusationView({
  caseId,
  suspects,
  allEvidence,
  timelineEvents,
  orderedTimelineIds,
  bookmarkedIds,
  scoringWeights,
  maxAttempts,
  timer,
  draft,
  submissions,
  onUpdateDraft,
  onStartInvestigation,
  onSubmissionComplete,
}: {
  caseId: string;
  suspects: ClientSuspect[];
  allEvidence: ClientEvidence[];
  timelineEvents: ClientTimelineEvent[];
  orderedTimelineIds: string[];
  bookmarkedIds: string[];
  scoringWeights: ScoringConfig['weights'];
  maxAttempts: number;
  timer: ServerTimerSnapshot;
  draft: AccusationDraft;
  submissions: ClientSubmission[];
  onUpdateDraft: (next: AccusationDraft) => void;
  onStartInvestigation: () => Promise<void>;
  onSubmissionComplete: (submission: ClientSubmission, updatedTimer: ServerTimerSnapshot) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const primarySuspects = useMemo(
    () => suspects.filter((s) => s.roleType === 'suspect'),
    [suspects],
  );

  const effectiveTimeline = useMemo(() => {
    const base = orderedTimelineIds.length > 0 ? orderedTimelineIds : timelineEvents.map((t) => t.id);
    return base
      .map((id) => timelineEvents.find((t) => t.id === id))
      .filter((t): t is ClientTimelineEvent => Boolean(t));
  }, [orderedTimelineIds, timelineEvents]);

  const latestSubmission = submissions[0] ?? null;
  const attemptsExhausted = submissions.length >= maxAttempts;

  const readyChecks = {
    killer: Boolean(draft.accusedSuspectId),
    motive: draft.motiveExplanation.trim().length >= 15,
    method: draft.methodExplanation.trim().length >= 15,
    timeline: effectiveTimeline.length >= 1,
    evidence: draft.supportingEvidenceIds.length >= 1,
  };
  const allReady = Object.values(readyChecks).every(Boolean);

  function toggleEvidence(id: string) {
    const exists = draft.supportingEvidenceIds.includes(id);
    onUpdateDraft({
      ...draft,
      supportingEvidenceIds: exists
        ? draft.supportingEvidenceIds.filter((x) => x !== id)
        : [...draft.supportingEvidenceIds, id],
    });
  }

  async function submitAccusation() {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/accusation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accusedSuspectId: draft.accusedSuspectId,
          motiveExplanation: draft.motiveExplanation,
          methodExplanation: draft.methodExplanation,
          reconstructedTimeline: effectiveTimeline.map((t) => t.id),
          supportingEvidenceIds: draft.supportingEvidenceIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Submission rejected by server.');
        setConfirmOpen(false);
        return;
      }
      setConfirmOpen(false);
      onSubmissionComplete(data.submission, data.timer);
    } catch {
      setError('Network error submitting accusation.');
    } finally {
      setSubmitting(false);
    }
  }

  // POST-SUBMISSION SERVER-SCORED EVALUATION REPORT
  if (latestSubmission && attemptsExhausted) {
    const accused = suspects.find((s) => s.id === latestSubmission.accusedSuspectId);
    const bd = latestSubmission.scoreBreakdown;
    return (
      <div className="space-y-5">
        <div
          className={`rounded-lg border p-6 ${
            latestSubmission.passed
              ? 'border-[#2e7d5b] bg-gradient-to-br from-[#0f1d17] to-[#0b0e14]'
              : 'border-[#9e1b24] bg-gradient-to-br from-[#1f0f13] to-[#0b0e14]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e3a74c]">
                SERVER-AUTHORITATIVE CASE EVALUATION REPORT
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1 flex items-center gap-2.5">
                {latestSubmission.passed ? (
                  <Award className="w-7 h-7 text-[#6ee7b7]" />
                ) : (
                  <XCircle className="w-7 h-7 text-[#f87171]" />
                )}
                {latestSubmission.rank}
              </h1>
              <p className="text-xs font-mono text-[#9aa5b8] mt-1">
                ACCUSED: {accused?.fullName ?? 'Unknown'} · ELAPSED:{' '}
                {formatDurationHms(latestSubmission.elapsedSeconds)}
                {latestSubmission.isLate && (
                  <span className="text-[#f87171] ml-2">
                    (LATE SUBMISSION PENALTY: -{bd.latePenaltyApplied} PTS)
                  </span>
                )}
              </p>
            </div>

            <div className="text-right">
              <div className="font-mono text-4xl font-bold text-white">
                {latestSubmission.totalScore}
                <span className="text-lg text-[#7f8ca1]">/100</span>
              </div>
              <div
                className={`font-mono text-xs uppercase font-semibold ${
                  latestSubmission.passed ? 'text-[#6ee7b7]' : 'text-[#fca5a5]'
                }`}
              >
                {latestSubmission.passed ? 'WARRANT APPROVED' : 'WARRANT REJECTED'}
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {bd.items.map((item) => {
            const pct = item.maxScore > 0 ? Math.round((item.score / item.maxScore) * 100) : 0;
            return (
              <div
                key={item.category}
                className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-4 space-y-2"
              >
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-[#cbd5e1] font-semibold">{item.label}</span>
                  <span className="text-[#e3a74c] font-bold">
                    {item.score}/{item.maxScore}
                  </span>
                </div>
                <div className="h-1.5 rounded bg-[#1b2230] overflow-hidden">
                  <div
                    className={`h-full ${
                      pct >= 75 ? 'bg-[#2e7d5b]' : pct >= 40 ? 'bg-[#c88a2e]' : 'bg-[#dc2626]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-[#9aa5b8] leading-snug">{item.feedback}</p>
                {item.matchedDetails.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {item.matchedDetails.map((d, i) => (
                      <span
                        key={i}
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#181f2c] text-[#86efac]"
                      >
                        ✓ {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Official Confidential Debrief (Revealed ONLY post-submission!) */}
        <div className="rounded-lg border border-[#c88a2e]/50 bg-[#12141a] p-6 space-y-4">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#e3a74c] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            DECLASSIFIED OFFICIAL CASE SOLUTION DEBRIEF
          </div>
          <p className="text-sm text-[#e1e6ef] leading-relaxed">{bd.solutionNarrative}</p>
          <div className="grid md:grid-cols-3 gap-3 pt-2 border-t border-[#232b3a] text-xs">
            <div className="rounded border border-[#242c3b] bg-[#0b0e14] p-3">
              <div className="font-mono text-[10px] text-[#f87171] uppercase">PERPETRATOR</div>
              <div className="font-semibold text-[#e8ecf2] mt-1">{bd.canonicalKillerName}</div>
            </div>
            <div className="rounded border border-[#242c3b] bg-[#0b0e14] p-3">
              <div className="font-mono text-[10px] text-[#e3a74c] uppercase">ESTABLISHED MOTIVE</div>
              <div className="text-[#cbd5e1] mt-1 leading-snug">{bd.canonicalMotive}</div>
            </div>
            <div className="rounded border border-[#242c3b] bg-[#0b0e14] p-3">
              <div className="font-mono text-[10px] text-[#38bdf8] uppercase">ESTABLISHED METHOD</div>
              <div className="text-[#cbd5e1] mt-1 leading-snug">{bd.canonicalMethod}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#9e1b24]/60 bg-[#140e12] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#fca5a5] flex items-center gap-1.5">
            <Gavel className="w-3.5 h-3.5 text-[#dc2626]" />
            FORMAL ARREST WARRANT &amp; PROSECUTION BRIEF
          </div>
          <h1 className="text-xl font-semibold text-[#e8ecf2] mt-1">Final Accusation Terminal</h1>
          <p className="text-xs text-[#a5b0c2] mt-1">
            All five components are evaluated server-side against the sealed forensic solution.
            Allowed attempts: {maxAttempts}.
          </p>
        </div>

        <div className="font-mono text-[11px] rounded border border-[#2a3345] bg-[#0c0f15] px-3.5 py-2 space-y-0.5 text-right">
          <div className="text-[#7f8ca1]">SCORING RUBRIC (100 PTS)</div>
          <div className="text-[#e3a74c]">
            Killer {scoringWeights.killer} · Motive {scoringWeights.motive} · Method{' '}
            {scoringWeights.method} · Timeline {scoringWeights.timeline} · Evidence{' '}
            {scoringWeights.evidence}
          </div>
        </div>
      </div>

      {/* Explicit Timer Start Guard */}
      {timer.status === 'not_started' && (
        <div className="rounded-lg border border-[#c88a2e] bg-[#c88a2e]/15 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-[#fef3c7]">
            <Clock className="w-4 h-4 text-[#e3a74c] shrink-0" />
            <span>
              Your server-authoritative investigation clock has not started yet. Start the
              investigation before filing a formal accusation.
            </span>
          </div>
          <button
            type="button"
            onClick={onStartInvestigation}
            className="rounded bg-[#c88a2e] hover:bg-[#dfa03f] text-[#07080b] font-mono text-xs font-bold uppercase px-4 py-2 cursor-pointer"
          >
            START INVESTIGATION CLOCK
          </button>
        </div>
      )}

      {timer.isExpired && !timer.canSubmit && (
        <div className="rounded-lg border border-[#dc2626] bg-[#9e1b24]/20 p-4 flex items-center gap-2.5 text-xs text-[#fca5a5]">
          <Lock className="w-4 h-4 shrink-0" />
          Investigation deadline has expired under hard-lock policy. Contact an Administrator to
          request a logged timer extension.
        </div>
      )}

      {error && (
        <div className="rounded border border-[#dc2626] bg-[#9e1b24]/20 px-4 py-3 text-xs font-mono text-[#fca5a5]">
          {error}
        </div>
      )}

      {/* 1. Killer Identification */}
      <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#e3a74c] font-semibold">
            1. IDENTIFY PRIMARY PERPETRATOR ({scoringWeights.killer} PTS)
          </h2>
          {readyChecks.killer && <CheckCircle2 className="w-4 h-4 text-[#6ee7b7]" />}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {primarySuspects.map((s) => {
            const selected = draft.accusedSuspectId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onUpdateDraft({ ...draft, accusedSuspectId: s.id })}
                className={`text-left rounded-lg border p-3 transition cursor-pointer ${
                  selected
                    ? 'border-[#dc2626] bg-[#9e1b24]/20 ring-1 ring-[#dc2626]'
                    : 'border-[#242c3b] bg-[#131822] hover:border-[#3b4760]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {s.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.photoUrl}
                      alt={s.fullName}
                      className="w-12 h-14 object-cover rounded border border-[#2f394d]"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-[#e3a74c]">{s.suspectCode}</div>
                    <div className="text-sm font-semibold text-[#e8ecf2] truncate">{s.fullName}</div>
                    <div className="text-[11px] text-[#8894a8] truncate">{s.occupation}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2 & 3. Motive and Method Explanations */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#e3a74c] font-semibold">
              2. MOTIVE EXPLANATION ({scoringWeights.motive} PTS)
            </h2>
            {readyChecks.motive && <CheckCircle2 className="w-4 h-4 text-[#6ee7b7]" />}
          </div>
          <p className="text-[11px] text-[#8894a8]">
            Explain why the perpetrator targeted the victim, citing underlying financial, legal, or
            personal pressures uncovered in the archive.
          </p>
          <textarea
            rows={5}
            value={draft.motiveExplanation}
            onChange={(e) => onUpdateDraft({ ...draft, motiveExplanation: e.target.value })}
            placeholder="Detail the perpetrator's decisive motive..."
            className="w-full rounded border border-[#283143] bg-[#090b10] p-3 text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
          />
        </div>

        <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#e3a74c] font-semibold">
              3. METHOD &amp; EXECUTION ({scoringWeights.method} PTS)
            </h2>
            {readyChecks.method && <CheckCircle2 className="w-4 h-4 text-[#6ee7b7]" />}
          </div>
          <p className="text-[11px] text-[#8894a8]">
            Detail how the crime was committed, including access mechanism, weapon or agent, and
            how the perpetrator attempted to conceal their tracks.
          </p>
          <textarea
            rows={5}
            value={draft.methodExplanation}
            onChange={(e) => onUpdateDraft({ ...draft, methodExplanation: e.target.value })}
            placeholder="Detail exact execution method, entry/exit, and staging..."
            className="w-full rounded border border-[#283143] bg-[#090b10] p-3 text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
          />
        </div>
      </div>

      {/* 4. Reconstructed Timeline Confirmation */}
      <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#e3a74c] font-semibold">
            4. CONFIRMED TIMELINE SEQUENCE ({scoringWeights.timeline} PTS)
          </h2>
          <span className="font-mono text-[10px] text-[#8894a8]">
            SYNCED FROM TIMELINE RECONSTRUCTION TOOL
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {effectiveTimeline.map((ev, idx) => (
            <div
              key={ev.id}
              className="rounded border border-[#222937] bg-[#131822] px-3 py-2 text-xs"
            >
              <div className="font-mono text-[10px] text-[#e3a74c]">
                STEP #{idx + 1} · {ev.eventCode} ({ev.displayTime})
              </div>
              <div className="font-medium text-[#e8ecf2] mt-0.5 truncate">{ev.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Supporting Evidence Selection */}
      <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#e3a74c] font-semibold">
            5. SELECT DECISIVE SUPPORTING EVIDENCE ({scoringWeights.evidence} PTS)
          </h2>
          <span className="font-mono text-xs text-[#cbd5e1]">
            {draft.supportingEvidenceIds.length} SELECTED
          </span>
        </div>
        <p className="text-[11px] text-[#8894a8]">
          Cite the core forensic exhibits that prove guilt beyond reasonable doubt. Precision
          matters—avoid selecting unrelated exhibits.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {allEvidence.map((ev) => {
            const selected = draft.supportingEvidenceIds.includes(ev.id);
            const isBookmarked = bookmarkedIds.includes(ev.id);
            return (
              <button
                key={ev.id}
                type="button"
                disabled={ev.accessRules?.locked}
                onClick={() => toggleEvidence(ev.id)}
                className={`text-left rounded border p-2.5 text-xs transition cursor-pointer disabled:opacity-40 ${
                  selected
                    ? 'border-[#c88a2e] bg-[#c88a2e]/15'
                    : 'border-[#212836] bg-[#131722] hover:border-[#364259]'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="font-bold text-[#e3a74c]">{ev.evidenceCode}</span>
                  <span className="flex items-center gap-1">
                    {isBookmarked && <span className="text-[#c88a2e]">★</span>}
                    {selected && <FileCheck2 className="w-3.5 h-3.5 text-[#6ee7b7]" />}
                  </span>
                </div>
                <div className="text-[#e8ecf2] font-medium truncate mt-0.5">{ev.title}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit Bar */}
      <div className="rounded-lg border border-[#2a3345] bg-[#11151f] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          {(
            [
              ['Killer', readyChecks.killer],
              ['Motive', readyChecks.motive],
              ['Method', readyChecks.method],
              ['Timeline', readyChecks.timeline],
              ['Evidence', readyChecks.evidence],
            ] as const
          ).map(([lbl, ok]) => (
            <span
              key={lbl}
              className={ok ? 'text-[#6ee7b7]' : 'text-[#667389]'}
            >
              {ok ? '✓' : '○'} {lbl}
            </span>
          ))}
        </div>

        <button
          type="button"
          disabled={!allReady || !timer.canSubmit || submitting}
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded bg-[#9e1b24] hover:bg-[#b8202b] disabled:opacity-40 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-white transition cursor-pointer"
        >
          <Gavel className="w-4 h-4" />
          SUBMIT FINAL ACCUSATION
        </button>
      </div>

      {/* Final Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-lg border border-[#9e1b24] bg-[#0f131a] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 font-mono text-xs uppercase text-[#fca5a5]">
              <AlertTriangle className="w-4 h-4 text-[#dc2626]" />
              CONFIRM FINAL ARREST WARRANT
            </div>
            <p className="text-sm text-[#cbd5e1] leading-relaxed">
              Submitting your Final Accusation locks this case session and transmits your brief to
              the server-side forensic scoring engine. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded border border-[#2a3345] bg-[#161c28] px-4 py-2 font-mono text-xs text-[#cbd5e1] cursor-pointer"
              >
                REVIEW BRIEF
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitAccusation}
                className="rounded bg-[#9e1b24] hover:bg-[#b8202b] px-4 py-2 font-mono text-xs font-bold text-white cursor-pointer"
              >
                {submitting ? 'EVALUATING...' : 'CONFIRM & FILE WARRANT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
