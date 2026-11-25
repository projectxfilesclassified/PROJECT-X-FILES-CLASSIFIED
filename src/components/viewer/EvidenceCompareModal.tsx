'use client';

import React from 'react';
import { Columns2, X } from 'lucide-react';
import type {
  ClientEvidence,
  ClientEvidenceRelation,
  ClientSuspect,
} from '@/lib/client-types';
import type { EvidenceAnnotation } from '@/lib/types';
import UniversalEvidenceViewer from './UniversalEvidenceViewer';

export default function EvidenceCompareModal({
  open,
  onClose,
  allEvidence,
  evidenceRelations,
  suspects,
  leftId,
  rightId,
  onChangeLeftId,
  onChangeRightId,
  bookmarkedIds,
  annotations,
  onToggleBookmark,
  onUpdateAnnotation,
  onPinToBoard,
  onUnlockEvidence,
}: {
  open: boolean;
  onClose: () => void;
  allEvidence: ClientEvidence[];
  evidenceRelations: ClientEvidenceRelation[];
  suspects: ClientSuspect[];
  leftId: string;
  rightId: string;
  onChangeLeftId: (id: string) => void;
  onChangeRightId: (id: string) => void;
  bookmarkedIds: string[];
  annotations: Record<string, EvidenceAnnotation>;
  onToggleBookmark: (id: string) => void;
  onUpdateAnnotation: (id: string, ann: EvidenceAnnotation) => void;
  onPinToBoard: (ev: ClientEvidence) => void;
  onUnlockEvidence: (id: string, passcode?: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  if (!open) return null;

  const leftEv = allEvidence.find((e) => e.id === leftId) ?? allEvidence[0];
  const rightEv = allEvidence.find((e) => e.id === rightId) ?? allEvidence[1] ?? allEvidence[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-[1440px] max-h-[92vh] rounded-lg border border-[#2e384b] bg-[#0b0e14] flex flex-col overflow-hidden shadow-2xl">
        <div className="border-b border-[#222937] bg-[#11151f] px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Columns2 className="w-4 h-4 text-[#c88a2e]" />
            <span className="font-mono text-xs uppercase tracking-[0.18em] font-semibold text-[#e8ecf2]">
              FORENSIC SIDE-BY-SIDE EVIDENCE COMPARISON
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#2a3345] bg-[#151a24] hover:border-[#9e1b24] p-1.5 text-[#9aa5b8] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#222937] flex-1 overflow-y-auto">
          {[
            { label: 'EXHIBIT A', current: leftEv, setId: onChangeLeftId },
            { label: 'EXHIBIT B', current: rightEv, setId: onChangeRightId },
          ].map((slot) => (
            <div key={slot.label} className="p-4 flex flex-col gap-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#c88a2e] shrink-0">
                  {slot.label}:
                </span>
                <select
                  value={slot.current?.id ?? ''}
                  onChange={(e) => slot.setId(e.target.value)}
                  className="flex-1 rounded border border-[#2a3345] bg-[#121620] px-3 py-1.5 font-mono text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
                >
                  {allEvidence.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.evidenceCode} — {ev.title} ({ev.viewerType.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {slot.current && (
                <UniversalEvidenceViewer
                  evidence={slot.current}
                  allEvidence={allEvidence}
                  evidenceRelations={evidenceRelations}
                  suspects={suspects}
                  isBookmarked={bookmarkedIds.includes(slot.current.id)}
                  annotation={annotations[slot.current.id]}
                  compact
                  onToggleBookmark={onToggleBookmark}
                  onUpdateAnnotation={onUpdateAnnotation}
                  onPinToBoard={onPinToBoard}
                  onAddToCompare={() => {}}
                  onSelectEvidenceById={(id) => slot.setId(id)}
                  onSelectSuspectById={() => {}}
                  onUnlockEvidence={onUnlockEvidence}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
