'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Lock,
  Plus,
  Trash2,
  Clock,
  GripVertical,
  FileSearch,
  Users,
} from 'lucide-react';
import type {
  ClientEvidence,
  ClientSuspect,
  ClientTimelineEvent,
} from '@/lib/client-types';
import type { CustomTimelineEvent, TimelineState } from '@/lib/types';

export default function TimelineReconstructionView({
  events,
  timelineState,
  allEvidence,
  suspects,
  onChangeTimeline,
  onOpenEvidence,
}: {
  events: ClientTimelineEvent[];
  timelineState: TimelineState;
  allEvidence: ClientEvidence[];
  suspects: ClientSuspect[];
  onChangeTimeline: (next: TimelineState) => void;
  onOpenEvidence: (id: string) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  // Ensure every case event appears in orderedEventIds
  const orderedIds = useMemo(() => {
    const existing = timelineState.orderedEventIds.filter((id) =>
      events.some((e) => e.id === id),
    );
    const missing = events.filter((e) => !existing.includes(e.id)).map((e) => e.id);
    return [...existing, ...missing];
  }, [timelineState.orderedEventIds, events]);

  const orderedEvents = useMemo(
    () =>
      orderedIds
        .map((id) => events.find((e) => e.id === id))
        .filter((e): e is ClientTimelineEvent => Boolean(e)),
    [orderedIds, events],
  );

  function moveEvent(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= orderedIds.length) return;
    const copy = [...orderedIds];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed!);
    onChangeTimeline({ ...timelineState, orderedEventIds: copy });
  }

  function handleDropOnIndex(targetIndex: number) {
    if (!draggedId) return;
    const fromIndex = orderedIds.indexOf(draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) {
      setDraggedId(null);
      return;
    }
    const copy = [...orderedIds];
    const [removed] = copy.splice(fromIndex, 1);
    copy.splice(targetIndex, 0, removed!);
    onChangeTimeline({ ...timelineState, orderedEventIds: copy });
    setDraggedId(null);
  }

  function addCustomEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!customTitle.trim()) return;
    const item: CustomTimelineEvent = {
      id: `ctl-${Date.now().toString(36)}`,
      title: customTitle.trim(),
      displayTime: customTime.trim() || 'Investigator Est.',
      description: customDesc.trim(),
      linkedEvidenceIds: [],
    };
    onChangeTimeline({
      ...timelineState,
      customEvents: [...timelineState.customEvents, item],
    });
    setCustomTitle('');
    setCustomTime('');
    setCustomDesc('');
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#222937] bg-[#10141c] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c88a2e]">
            CHRONOLOGICAL RECONSTRUCTION WORKBENCH
          </div>
          <h1 className="text-lg font-semibold text-[#e8ecf2]">Timeline Reconstruction</h1>
          <p className="text-xs text-[#9aa5b8] mt-0.5">
            Drag and drop events into verified chronological order. This sequence feeds directly
            into your Final Accusation evaluation.
          </p>
        </div>
        <div className="font-mono text-[11px] px-3 py-1.5 rounded border border-[#2a3345] bg-[#141923] text-[#e3a74c]">
          {orderedEvents.length} CASE EVENTS · {timelineState.customEvents.length} CUSTOM MARKERS
        </div>
      </div>

      {/* Suspect Alibi Cross-Check Strip */}
      <div className="rounded-lg border border-[#222937] bg-[#0e1118] p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1] mb-2.5 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#c88a2e]" />
          SUSPECT STATED ALIBI WINDOWS (CROSS-REFERENCE)
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {suspects.map((s) => (
            <div
              key={s.id}
              className="rounded border border-[#212836] bg-[#131722] px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                <span className="text-[#e3a74c] font-semibold">{s.suspectCode}</span>
                <span className={s.alibiVerified ? 'text-[#6ee7b7]' : 'text-[#f87171]'}>
                  {s.alibiTimeWindow || 'UNSPECIFIED'}
                </span>
              </div>
              <div className="font-semibold text-[#e8ecf2] mt-0.5 truncate">{s.fullName}</div>
              <div className="text-[11px] text-[#8492a8] line-clamp-2 mt-0.5">{s.alibiSummary}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Reorderable Chronology */}
      <div className="relative pl-6 space-y-3 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#263042]">
        {orderedEvents.map((ev, index) => {
          const note = timelineState.notesByEvent[ev.id] ?? '';
          return (
            <div
              key={ev.id}
              draggable={!ev.isAnchor}
              onDragStart={() => setDraggedId(ev.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnIndex(index)}
              className={`relative rounded-lg border p-4 transition ${
                ev.isAnchor
                  ? 'border-[#c88a2e]/55 bg-[#151412]'
                  : draggedId === ev.id
                    ? 'border-[#dc2626] bg-[#1c1317] opacity-75'
                    : 'border-[#232b3a] bg-[#0f131b] hover:border-[#37435a]'
              }`}
            >
              {/* Timeline Axis Dot */}
              <div
                className={`absolute -left-[22px] top-5 w-4 h-4 rounded-full border-2 flex items-center justify-center font-mono text-[9px] font-bold ${
                  ev.isAnchor
                    ? 'bg-[#c88a2e] border-[#090b10] text-[#090b10]'
                    : 'bg-[#1a2232] border-[#9e1b24] text-[#e8ecf2]'
                }`}
              >
                {index + 1}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {!ev.isAnchor ? (
                    <GripVertical className="w-4 h-4 text-[#667389] mt-0.5 shrink-0 cursor-grab" />
                  ) : (
                    <Lock className="w-4 h-4 text-[#e3a74c] mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-[#1b2230] text-[#e3a74c] font-semibold">
                        #{index + 1} · {ev.eventCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#cbd5e1]">
                        <Clock className="w-3 h-3 text-[#c88a2e]" /> {ev.displayTime}
                      </span>
                      {ev.location && <span className="text-[#7f8ca1]">· {ev.location}</span>}
                      {ev.isAnchor && (
                        <span className="px-1.5 py-0.5 rounded bg-[#c88a2e]/20 text-[#e3a74c]">
                          VERIFIED ANCHOR
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-[#e8ecf2] mt-1">{ev.title}</h3>
                    <p className="text-xs text-[#9aa5b8] mt-1 leading-relaxed">{ev.description}</p>
                  </div>
                </div>

                {/* Order Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveEvent(index, -1)}
                    className="rounded border border-[#2a3345] bg-[#141923] hover:border-[#c88a2e] disabled:opacity-30 p-1.5 text-[#cbd5e1] cursor-pointer"
                    title="Move Earlier"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === orderedEvents.length - 1}
                    onClick={() => moveEvent(index, 1)}
                    className="rounded border border-[#2a3345] bg-[#141923] hover:border-[#c88a2e] disabled:opacity-30 p-1.5 text-[#cbd5e1] cursor-pointer"
                    title="Move Later"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Linked Exhibits + Per-Event Note */}
              <div className="mt-3 pt-2.5 border-t border-[#1e2533] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-[#6d7a90] inline-flex items-center gap-1">
                    <FileSearch className="w-3 h-3" /> PROOFS:
                  </span>
                  {ev.linkedEvidenceIds.map((evId) => {
                    const found = allEvidence.find((e) => e.id === evId);
                    if (!found) return null;
                    return (
                      <button
                        key={evId}
                        type="button"
                        onClick={() => onOpenEvidence(evId)}
                        className="font-mono text-[10px] px-2 py-0.5 rounded border border-[#2c3547] bg-[#151a24] hover:border-[#c88a2e] text-[#e3a74c] cursor-pointer"
                      >
                        {found.evidenceCode}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={note}
                  onChange={(e) =>
                    onChangeTimeline({
                      ...timelineState,
                      notesByEvent: {
                        ...timelineState.notesByEvent,
                        [ev.id]: e.target.value,
                      },
                    })
                  }
                  placeholder="Add chronological note for this event..."
                  className="sm:w-72 rounded border border-[#252e3f] bg-[#090b10] px-2.5 py-1 text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Investigator Custom Hypothesis Events */}
      <div className="rounded-lg border border-[#222937] bg-[#0e1118] p-4 space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e3a74c]">
          ADD CUSTOM TIMELINE HYPOTHESIS MARKER
        </div>

        <form onSubmit={addCustomEvent} className="grid sm:grid-cols-12 gap-2">
          <input
            type="text"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            placeholder="Time (e.g. 22:14 UTC)"
            className="sm:col-span-3 rounded border border-[#293245] bg-[#090b10] px-3 py-1.5 font-mono text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
          />
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Hypothesis title..."
            className="sm:col-span-4 rounded border border-[#293245] bg-[#090b10] px-3 py-1.5 text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
          />
          <input
            type="text"
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            placeholder="Supporting reasoning..."
            className="sm:col-span-3 rounded border border-[#293245] bg-[#090b10] px-3 py-1.5 text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
          />
          <button
            type="submit"
            className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded bg-[#9e1b24] hover:bg-[#b5222c] px-3 py-1.5 font-mono text-xs text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> ADD
          </button>
        </form>

        {timelineState.customEvents.length > 0 && (
          <div className="space-y-2 pt-2">
            {timelineState.customEvents.map((ce) => (
              <div
                key={ce.id}
                className="rounded border border-[#293245] bg-[#131822] px-3 py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-mono text-[#e3a74c] mr-2">[{ce.displayTime}]</span>
                  <strong className="text-[#e8ecf2]">{ce.title}</strong>
                  {ce.description && <span className="text-[#9aa5b8] ml-2">— {ce.description}</span>}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChangeTimeline({
                      ...timelineState,
                      customEvents: timelineState.customEvents.filter((x) => x.id !== ce.id),
                    })
                  }
                  className="text-[#7f8ca1] hover:text-[#f87171] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
