'use client';

import React, { useState } from 'react';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  PanelRightClose,
} from 'lucide-react';
import type { ClientEvidence, ClientSuspect } from '@/lib/client-types';
import type { SuspectPlayerNote } from '@/lib/types';

export default function RightSuspectPanel({
  suspects,
  allEvidence,
  suspectNotes,
  onUpdateSuspectNote,
  onOpenFullProfile,
  onOpenEvidence,
  onCloseMobile,
}: {
  suspects: ClientSuspect[];
  allEvidence: ClientEvidence[];
  suspectNotes: Record<string, SuspectPlayerNote>;
  onUpdateSuspectNote: (suspectId: string, note: SuspectPlayerNote) => void;
  onOpenFullProfile: (suspectId: string) => void;
  onOpenEvidence: (evidenceId: string) => void;
  onCloseMobile?: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(suspects[0]?.id ?? null);

  return (
    <aside className="h-full flex flex-col bg-[#0c0f15] border-l border-[#212836]">
      <div className="px-4 py-3 border-b border-[#212836] flex items-center justify-between gap-2 bg-[#10141c]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#c88a2e]" />
          <div>
            <div className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase text-[#e8ecf2]">
              SUSPECT INTELLIGENCE
            </div>
            <div className="font-mono text-[9px] text-[#728096]">
              {suspects.filter((s) => s.roleType === 'suspect').length} SUSPECTS ·{' '}
              {suspects.filter((s) => s.roleType !== 'suspect').length} WITNESSES
            </div>
          </div>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1 rounded border border-[#2a3345] text-[#9aa5b8] hover:text-white cursor-pointer"
            title="Collapse Suspect Panel"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {suspects.map((s) => {
          const isOpen = expandedId === s.id;
          const note = suspectNotes[s.id] ?? {
            notes: '',
            suspicionLevel: 25,
            customContradictions: [],
            updatedAt: '',
          };
          const linkedEv = allEvidence.filter((e) => e.relatedSuspectIds?.includes(s.id));

          return (
            <div
              key={s.id}
              className={`rounded-lg border transition overflow-hidden ${
                isOpen ? 'border-[#c88a2e]/70 bg-[#131822]' : 'border-[#212836] bg-[#10131b]'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : s.id)}
                className="w-full p-2.5 flex items-center gap-2.5 text-left cursor-pointer"
              >
                {s.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.photoUrl}
                    alt={s.fullName}
                    className="w-10 h-11 object-cover rounded border border-[#2c3547] shrink-0 bg-[#080a0e]"
                  />
                ) : (
                  <div className="w-10 h-11 rounded border border-[#2c3547] bg-[#171d29] flex items-center justify-center font-mono text-[10px] text-[#7f8ca1] shrink-0">
                    {s.suspectCode}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 font-mono text-[9px]">
                    <span className="text-[#e3a74c] font-bold">{s.suspectCode}</span>
                    <span className="flex items-center gap-1">
                      {s.contradictions.length > 0 && (
                        <span className="text-[#f87171] inline-flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {s.contradictions.length}
                        </span>
                      )}
                      {s.alibiVerified ? (
                        <CheckCircle2 className="w-3 h-3 text-[#6ee7b7]" />
                      ) : (
                        <XCircle className="w-3 h-3 text-[#f87171]" />
                      )}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#e8ecf2] truncate">{s.fullName}</div>
                  <div className="text-[10px] text-[#7f8ca1] truncate">{s.relationshipToVictim}</div>
                </div>

                {isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#7f8ca1] shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#7f8ca1] shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-[#1e2533] space-y-2.5 text-[11px]">
                  <div>
                    <div className="font-mono text-[9px] uppercase text-[#728096]">ALIBI WINDOW</div>
                    <div className="text-[#cbd5e1] mt-0.5 leading-snug">
                      <span className="font-mono text-[#e3a74c] mr-1">[{s.alibiTimeWindow || 'N/A'}]</span>
                      {s.alibiSummary}
                    </div>
                  </div>

                  {s.motiveSummary && (
                    <div>
                      <div className="font-mono text-[9px] uppercase text-[#728096]">MOTIVE ANGLE</div>
                      <div className="text-[#9aa5b8] mt-0.5 leading-snug line-clamp-3">
                        {s.motiveSummary}
                      </div>
                    </div>
                  )}

                  {linkedEv.length > 0 && (
                    <div>
                      <div className="font-mono text-[9px] uppercase text-[#728096] mb-1">
                        LINKED EXHIBITS ({linkedEv.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {linkedEv.slice(0, 6).map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => onOpenEvidence(ev.id)}
                            className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-[#2a3345] bg-[#0b0e14] hover:border-[#c88a2e] text-[#e3a74c] cursor-pointer"
                          >
                            {ev.evidenceCode}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between font-mono text-[9px] text-[#728096] mb-1">
                      <span>SUSPICION</span>
                      <span className="text-[#e8ecf2]">{note.suspicionLevel}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={note.suspicionLevel}
                      onChange={(e) =>
                        onUpdateSuspectNote(s.id, {
                          ...note,
                          suspicionLevel: Number(e.target.value),
                          updatedAt: new Date().toISOString(),
                        })
                      }
                      className="w-full accent-[#dc2626] cursor-pointer"
                    />
                  </div>

                  <textarea
                    rows={2}
                    value={note.notes}
                    onChange={(e) =>
                      onUpdateSuspectNote(s.id, {
                        ...note,
                        notes: e.target.value,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                    placeholder="Quick field note..."
                    className="w-full rounded border border-[#252e3f] bg-[#090b10] p-2 text-[11px] text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none resize-none"
                  />

                  <button
                    type="button"
                    onClick={() => onOpenFullProfile(s.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded border border-[#2d374a] bg-[#171d29] hover:border-[#c88a2e] py-1.5 font-mono text-[10px] text-[#e3a74c] cursor-pointer"
                  >
                    OPEN FULL DOSSIER <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
