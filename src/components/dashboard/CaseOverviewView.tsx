'use client';

import React from 'react';
import {
  Play,
  Clock,
  FileSearch,
  Bookmark,
  Lock,
  Network,
  CalendarClock,
  Gavel,
  ShieldAlert,
  MapPin,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import {
  formatDurationHms,
  type DashboardPayload,
} from '@/lib/client-types';
import type { NavSectionId } from '@/lib/types';

export default function CaseOverviewView({
  data,
  remainingSeconds,
  starting,
  onStartInvestigation,
  onNavigate,
}: {
  data: DashboardPayload;
  remainingSeconds: number;
  starting: boolean;
  onStartInvestigation: () => Promise<void>;
  onNavigate: (section: NavSectionId) => void;
}) {
  const c = data.case;
  const totalEvidence = data.evidence.length;
  const reviewedCount = data.session.viewedEvidenceIds.length;
  const bookmarkedCount = data.session.bookmarkedEvidenceIds.length;
  const lockedCount = data.evidence.filter((e) => e.accessRules?.locked).length;
  const progressPct = totalEvidence > 0 ? Math.round((reviewedCount / totalEvidence) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Mission Header & Explicit Timer Start Gate */}
      <div className="rounded-lg border border-[#262f40] bg-gradient-to-br from-[#121620] via-[#0e1118] to-[#0b0d13] p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#9e1b24] via-[#c88a2e] to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-[#9e1b24]/25 border border-[#9e1b24] text-[#fca5a5] font-semibold">
                {c.caseNumber}
              </span>
              <span className="text-[#c88a2e] tracking-wider uppercase">{c.classification}</span>
              {data.isPreview && (
                <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/60 text-amber-300">
                  ADMIN PREVIEW MODE
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold text-[#e8ecf2] tracking-tight">
              {c.title}
            </h1>
            {c.subtitle && <p className="text-sm text-[#c88a2e]">{c.subtitle}</p>}

            <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-[11px] text-[#8d99ad]">
              {c.incidentLocation && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#c88a2e]" /> {c.incidentLocation}
                </span>
              )}
              {c.incidentDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#c88a2e]" /> {c.incidentDate}
                </span>
              )}
            </div>
          </div>

          {/* Authoritative Clock Status Panel */}
          <div className="rounded-lg border border-[#2d3648] bg-[#090b10]/90 p-4 min-w-[260px] shrink-0 space-y-3">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
              <span className="text-[#7f8ca1] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#dc2626]" />
                OPERATIONAL CLOCK
              </span>
              <span
                className={
                  data.timer.status === 'active'
                    ? 'text-[#6ee7b7]'
                    : data.timer.status === 'expired'
                      ? 'text-[#f87171]'
                      : data.timer.status === 'submitted'
                        ? 'text-[#38bdf8]'
                        : 'text-[#e3a74c]'
                }
              >
                {data.timer.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="font-mono text-3xl font-bold tracking-wider text-[#e8ecf2]">
              {formatDurationHms(remainingSeconds)}
            </div>

            {data.timer.status === 'not_started' ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={starting}
                  onClick={onStartInvestigation}
                  className="w-full inline-flex items-center justify-center gap-2 rounded bg-[#9e1b24] hover:bg-[#b8202b] disabled:opacity-50 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {starting ? 'INITIALIZING CLOCK...' : 'BEGIN INVESTIGATION'}
                </button>
                <p className="text-[10px] text-[#7f8ca1] leading-snug">
                  Server clock begins ONLY when you click Start and continues across refresh or
                  logout.
                </p>
              </div>
            ) : (
              <div className="space-y-1 font-mono text-[10px] text-[#8492a8]">
                {data.timer.deadlineAt && (
                  <div>DEADLINE: {new Date(data.timer.deadlineAt).toLocaleTimeString()}</div>
                )}
                {data.timer.totalExtensionSeconds > 0 && (
                  <div className="text-[#6ee7b7]">
                    ADMIN EXTENSION: +{Math.round(data.timer.totalExtensionSeconds / 60)} MIN
                  </div>
                )}
                <div>
                  POLICY:{' '}
                  {c.expiryPolicy === 'allow_late_penalty'
                    ? `Late penalty (-${c.latePenaltyPercent}%)`
                    : c.expiryPolicy === 'hard_lock'
                      ? 'Hard lock on expiry'
                      : 'Lock on expiry'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#222937] bg-[#0f131b] p-4">
          <div className="font-mono text-[10px] text-[#7f8ca1] flex items-center justify-between">
            <span>ARCHIVE REVIEWED</span>
            <FileSearch className="w-3.5 h-3.5 text-[#c88a2e]" />
          </div>
          <div className="font-mono text-xl font-bold text-[#e8ecf2] mt-1">
            {reviewedCount} / {totalEvidence}
          </div>
          <div className="mt-2 h-1 rounded bg-[#1b2230] overflow-hidden">
            <div className="h-full bg-[#c88a2e]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="rounded-lg border border-[#222937] bg-[#0f131b] p-4">
          <div className="font-mono text-[10px] text-[#7f8ca1] flex items-center justify-between">
            <span>BOOKMARKED CLUES</span>
            <Bookmark className="w-3.5 h-3.5 text-[#e3a74c]" />
          </div>
          <div className="font-mono text-xl font-bold text-[#e8ecf2] mt-1">{bookmarkedCount}</div>
          <div className="font-mono text-[10px] text-[#6d7a90] mt-1">Pinned for comparison</div>
        </div>

        <div className="rounded-lg border border-[#222937] bg-[#0f131b] p-4">
          <div className="font-mono text-[10px] text-[#7f8ca1] flex items-center justify-between">
            <span>SEALED VAULTS</span>
            <Lock className="w-3.5 h-3.5 text-[#dc2626]" />
          </div>
          <div className="font-mono text-xl font-bold text-[#e8ecf2] mt-1">{lockedCount}</div>
          <div className="font-mono text-[10px] text-[#6d7a90] mt-1">
            {lockedCount > 0 ? 'Encrypted clues remaining' : 'All vaults decrypted'}
          </div>
        </div>

        <div className="rounded-lg border border-[#222937] bg-[#0f131b] p-4">
          <div className="font-mono text-[10px] text-[#7f8ca1] flex items-center justify-between">
            <span>BOARD &amp; NOTES</span>
            <Network className="w-3.5 h-3.5 text-[#38bdf8]" />
          </div>
          <div className="font-mono text-xl font-bold text-[#e8ecf2] mt-1">
            {data.workspace.boardState.nodes.length} / {data.workspace.notebookEntries.length}
          </div>
          <div className="font-mono text-[10px] text-[#6d7a90] mt-1">Board pins / Field notes</div>
        </div>
      </div>

      {/* Victim Dossier + Executive Case Briefing */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* Victim File Card */}
        <div className="lg:col-span-4 rounded-lg border border-[#9e1b24]/45 bg-[#120e12] p-5 space-y-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#fca5a5] flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#dc2626]" />
            VICTIM INTELLIGENCE FILE
          </div>

          {c.victimPhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.victimPhotoUrl}
              alt={c.victimName}
              className="w-full max-w-[220px] mx-auto rounded border border-[#2f3749] bg-[#090b10]"
            />
          )}

          <div>
            <div className="text-lg font-semibold text-[#e8ecf2]">{c.victimName}</div>
            <p className="text-xs text-[#a5b0c2] mt-1.5 leading-relaxed">{c.victimSummary}</p>
          </div>

          {c.metadata?.tags?.length ? (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#271b20]">
              {c.metadata.tags.map((t) => (
                <span
                  key={t}
                  className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#1d1418] border border-[#3a2228] text-[#e3a74c]"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Operational Briefing */}
        <div className="lg:col-span-8 rounded-lg border border-[#222937] bg-[#0f131b] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#202736] pb-3">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#e3a74c] font-semibold">
              OPERATIONAL BRIEFING &amp; MANDATE
            </span>
            {c.metadata?.agencyName && (
              <span className="font-mono text-[10px] text-[#7f8ca1]">{c.metadata.agencyName}</span>
            )}
          </div>

          <div className="space-y-3 text-sm text-[#d4dce8] leading-relaxed whitespace-pre-line">
            {c.briefingMarkdown || c.summary}
          </div>

          {/* Quick Action Command Strip */}
          <div className="pt-4 border-t border-[#202736] grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { id: 'original_case_files' as const, label: 'Read Case Files', icon: FileSearch },
              { id: 'crime_scene' as const, label: 'Inspect Crime Scene', icon: AlertCircle },
              { id: 'detective_board' as const, label: 'Detective Board', icon: Network },
              { id: 'timeline_reconstruction' as const, label: 'Build Timeline', icon: CalendarClock },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="rounded border border-[#263042] bg-[#141924] hover:border-[#c88a2e] px-3 py-2.5 text-left transition cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-[#e3a74c] mb-1.5" />
                  <div className="font-mono text-[11px] font-semibold text-[#e8ecf2]">
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('final_accusation')}
              className="inline-flex items-center gap-2 rounded border border-[#9e1b24] bg-[#9e1b24]/15 hover:bg-[#9e1b24] px-4 py-2 font-mono text-xs font-semibold text-[#fca5a5] hover:text-white transition cursor-pointer"
            >
              <Gavel className="w-3.5 h-3.5" />
              PROCEED TO FINAL ACCUSATION TERMINAL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
