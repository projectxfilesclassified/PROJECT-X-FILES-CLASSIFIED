'use client';

import React, { useMemo, useState } from 'react';
import {
  Users,
  Network,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSearch,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  ClientEvidence,
  ClientSuspect,
  ClientSuspectRelationship,
} from '@/lib/client-types';
import type { SuspectPlayerNote } from '@/lib/types';

const REL_COLORS: Record<string, string> = {
  conflict: '#dc2626',
  secret: '#e3a74c',
  financial: '#3b82a6',
  romantic: '#ec4899',
  family: '#6ee7b7',
  professional: '#94a3b8',
};

export default function SuspectDatabaseView({
  suspects,
  relationships,
  allEvidence,
  selectedSuspectId,
  suspectNotes,
  onSelectSuspect,
  onUpdateSuspectNote,
  onOpenEvidenceByCode,
  onPinSuspectToBoard,
}: {
  suspects: ClientSuspect[];
  relationships: ClientSuspectRelationship[];
  allEvidence: ClientEvidence[];
  selectedSuspectId: string | null;
  suspectNotes: Record<string, SuspectPlayerNote>;
  onSelectSuspect: (id: string) => void;
  onUpdateSuspectNote: (suspectId: string, note: SuspectPlayerNote) => void;
  onOpenEvidenceByCode: (code: string) => void;
  onPinSuspectToBoard: (suspect: ClientSuspect) => void;
}) {
  const [viewMode, setViewMode] = useState<'dossiers' | 'relationship_map'>('dossiers');
  const [roleFilter, setRoleFilter] = useState<'all' | 'suspect' | 'witness'>('all');
  const [newContradiction, setNewContradiction] = useState('');

  const filteredSuspects = useMemo(
    () =>
      suspects.filter((s) => {
        if (roleFilter === 'all') return true;
        return s.roleType === roleFilter;
      }),
    [suspects, roleFilter],
  );

  const activeSuspect =
    filteredSuspects.find((s) => s.id === selectedSuspectId) ??
    suspects.find((s) => s.id === selectedSuspectId) ??
    filteredSuspects[0] ??
    null;

  const activeNote: SuspectPlayerNote = (activeSuspect && suspectNotes[activeSuspect.id]) || {
    notes: '',
    suspicionLevel: 25,
    customContradictions: [],
    updatedAt: '',
  };

  const linkedEvidence = useMemo(() => {
    if (!activeSuspect) return [];
    return allEvidence.filter((e) => e.relatedSuspectIds?.includes(activeSuspect.id));
  }, [activeSuspect, allEvidence]);

  function saveNote(patch: Partial<SuspectPlayerNote>) {
    if (!activeSuspect) return;
    onUpdateSuspectNote(activeSuspect.id, {
      ...activeNote,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }

  // Circular layout coordinates for Relationship Map SVG
  const graphNodes = useMemo(() => {
    const cx = 420;
    const cy = 230;
    const rx = 270;
    const ry = 155;
    return suspects.map((s, idx) => {
      const angle = (idx / Math.max(1, suspects.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        suspect: s,
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      };
    });
  }, [suspects]);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="rounded-lg border border-[#222937] bg-[#10141c] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c88a2e]">
            INTELLIGENCE PROFILES
          </div>
          <h1 className="text-lg font-semibold text-[#e8ecf2]">
            Suspect Database &amp; Relationship Network
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded border border-[#283143] bg-[#090b10] p-0.5 font-mono text-[11px]">
            {(
              [
                ['all', 'ALL'],
                ['suspect', 'SUSPECTS'],
                ['witness', 'WITNESSES'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setRoleFilter(k)}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  roleFilter === k ? 'bg-[#1c2333] text-[#e3a74c]' : 'text-[#7f8ca1]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded border border-[#283143] bg-[#090b10] p-0.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('dossiers')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded cursor-pointer ${
                viewMode === 'dossiers'
                  ? 'bg-[#9e1b24] text-white'
                  : 'text-[#9aa5b8] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> DOSSIERS
            </button>
            <button
              type="button"
              onClick={() => setViewMode('relationship_map')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded cursor-pointer ${
                viewMode === 'relationship_map'
                  ? 'bg-[#9e1b24] text-white'
                  : 'text-[#9aa5b8] hover:text-white'
              }`}
            >
              <Network className="w-3.5 h-3.5" /> RELATIONSHIP MAP
            </button>
          </div>
        </div>
      </div>

      {/* SUSPECT RELATIONSHIP MAP VIEW */}
      {viewMode === 'relationship_map' ? (
        <div className="rounded-lg border border-[#232b3a] bg-[#0c0f15] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#202736] pb-3">
            <span className="font-mono text-xs text-[#9aa5b8]">
              CLICK ANY SUBJECT NODE TO INSPECT THEIR FULL DOSSIER
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
              {Object.entries(REL_COLORS).map(([type, hex]) => (
                <span key={type} className="inline-flex items-center gap-1.5 text-[#9aa5b8] uppercase">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }} />
                  {type}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded border border-[#1f2634] bg-[#07090d] forensic-grid overflow-x-auto">
            <svg viewBox="0 0 840 460" className="w-full min-w-[680px] h-[440px]">
              {/* Edges */}
              {relationships.map((rel) => {
                const src = graphNodes.find((n) => n.suspect.id === rel.sourceSuspectId);
                const dst = graphNodes.find((n) => n.suspect.id === rel.targetSuspectId);
                if (!src || !dst) return null;
                const mx = (src.x + dst.x) / 2;
                const my = (src.y + dst.y) / 2;
                const color = REL_COLORS[rel.relationshipType] ?? '#94a3b8';
                return (
                  <g key={rel.id}>
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={dst.x}
                      y2={dst.y}
                      stroke={color}
                      strokeWidth={Math.max(1.5, rel.strength * 0.6)}
                      strokeDasharray={rel.relationshipType === 'secret' ? '6 4' : undefined}
                      opacity={0.78}
                    />
                    <rect
                      x={mx - 74}
                      y={my - 11}
                      width="148"
                      height="20"
                      rx="3"
                      fill="#0e1219"
                      stroke={color}
                      strokeWidth="1"
                    />
                    <text
                      x={mx}
                      y={my + 3}
                      textAnchor="middle"
                      fill="#e8ecf2"
                      fontSize="9.5"
                      fontFamily="monospace"
                    >
                      {rel.relationshipLabel.slice(0, 24)}
                    </text>
                  </g>
                );
              })}

              {/* Suspect Nodes */}
              {graphNodes.map(({ suspect, x, y }) => {
                const isSelected = activeSuspect?.id === suspect.id;
                const note = suspectNotes[suspect.id];
                const borderHex = isSelected
                  ? '#e3a74c'
                  : suspect.contradictions.length > 0
                    ? '#dc2626'
                    : '#475569';
                return (
                  <g
                    key={suspect.id}
                    transform={`translate(${x - 78}, ${y - 34})`}
                    onClick={() => {
                      onSelectSuspect(suspect.id);
                      setViewMode('dossiers');
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      width="156"
                      height="68"
                      rx="6"
                      fill="#121722"
                      stroke={borderHex}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    <text
                      x="12"
                      y="20"
                      fill="#e3a74c"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {suspect.suspectCode} · {suspect.roleType.toUpperCase()}
                    </text>
                    <text x="12" y="39" fill="#e8ecf2" fontSize="12" fontWeight="bold">
                      {suspect.fullName.slice(0, 19)}
                    </text>
                    <text x="12" y="56" fill="#8b98ae" fontSize="9.5" fontFamily="monospace">
                      {suspect.contradictions.length} conflict(s) · Susp {note?.suspicionLevel ?? 25}%
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {relationships.map((rel) => {
              const s1 = suspects.find((s) => s.id === rel.sourceSuspectId);
              const s2 = suspects.find((s) => s.id === rel.targetSuspectId);
              return (
                <div
                  key={rel.id}
                  className="rounded border border-[#222937] bg-[#121620] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="font-semibold text-[#e8ecf2]">
                      {s1?.fullName} ↔ {s2?.fullName}
                    </span>
                    <span
                      className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-[#1b2230]"
                      style={{ color: REL_COLORS[rel.relationshipType] ?? '#cbd5e1' }}
                    >
                      {rel.relationshipType}
                    </span>
                  </div>
                  <div className="text-[#e3a74c] font-mono text-[11px] mt-0.5">
                    {rel.relationshipLabel}
                  </div>
                  {rel.notes && <p className="text-[#9aa5b8] mt-1 leading-snug">{rel.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* DOSSIER MASTER-DETAIL WORKSPACE */
        <div className="grid xl:grid-cols-12 gap-4 items-start">
          {/* Suspect Roster */}
          <div className="xl:col-span-4 space-y-2.5">
            {filteredSuspects.map((s) => {
              const active = activeSuspect?.id === s.id;
              const userSuspicion = suspectNotes[s.id]?.suspicionLevel ?? 25;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSuspect(s.id)}
                  className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition cursor-pointer ${
                    active
                      ? 'border-[#c88a2e] bg-[#161c27]'
                      : 'border-[#212836] bg-[#0e1118] hover:border-[#344056]'
                  }`}
                >
                  {s.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.photoUrl}
                      alt={s.fullName}
                      className="w-14 h-16 object-cover rounded border border-[#2a3345] shrink-0 bg-[#090b10]"
                    />
                  ) : (
                    <div className="w-14 h-16 rounded border border-[#2a3345] bg-[#141821] flex items-center justify-center font-mono text-xs text-[#667389] shrink-0">
                      {s.suspectCode}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                      <span className="text-[#e3a74c] font-semibold">{s.suspectCode}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded uppercase ${
                          s.alibiVerified
                            ? 'bg-[#2e7d5b]/20 text-[#86efac]'
                            : 'bg-[#9e1b24]/20 text-[#fca5a5]'
                        }`}
                      >
                        {s.alibiVerified ? 'ALIBI VERIFIED' : 'UNVERIFIED'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#e8ecf2] truncate mt-0.5">
                      {s.fullName}
                    </div>
                    <div className="text-[11px] text-[#8894a8] truncate">{s.occupation}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#7f8ca1]">
                      <span>
                        {s.contradictions.length > 0 ? (
                          <span className="text-[#f87171]">
                            {s.contradictions.length} CONTRADICTION(S)
                          </span>
                        ) : (
                          '0 CONFLICTS'
                        )}
                      </span>
                      <span>SUSP: {userSuspicion}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Suspect Full Intelligence Profile */}
          {activeSuspect && (
            <div className="xl:col-span-8 rounded-lg border border-[#232b3a] bg-[#0e1118] overflow-hidden">
              <div className="border-b border-[#222937] bg-[#131822] p-5 flex flex-col sm:flex-row gap-5">
                {activeSuspect.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeSuspect.photoUrl}
                    alt={activeSuspect.fullName}
                    className="w-32 h-38 object-cover rounded border border-[#313b4f] shrink-0 bg-[#090b10]"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-[#c88a2e]/20 border border-[#c88a2e]/50 text-[#e3a74c] font-semibold">
                        {activeSuspect.suspectCode}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#1b2230] text-[#cbd5e1] uppercase">
                        {activeSuspect.roleType}
                      </span>
                      <span className="px-2 py-0.5 rounded border border-[#2f394d] text-[#9aa5b8] uppercase">
                        {activeSuspect.statusTag.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onPinSuspectToBoard(activeSuspect)}
                      className="inline-flex items-center gap-1.5 rounded border border-[#2a3345] bg-[#161c28] hover:border-[#c88a2e] px-2.5 py-1 font-mono text-[11px] text-[#e3a74c] cursor-pointer"
                    >
                      <Pin className="w-3.5 h-3.5" /> PIN TO BOARD
                    </button>
                  </div>

                  <h2 className="text-2xl font-semibold text-[#e8ecf2] mt-2">
                    {activeSuspect.fullName}
                  </h2>
                  <p className="text-xs text-[#c88a2e] mt-0.5">
                    {activeSuspect.occupation} · {activeSuspect.relationshipToVictim}
                  </p>
                  <p className="text-xs text-[#9aa5b8] mt-2.5 leading-relaxed">
                    {activeSuspect.bioSummary}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-[#8492a8]">
                    {activeSuspect.age && <span>AGE: {activeSuspect.age}</span>}
                    {activeSuspect.dateOfBirth && <span>DOB: {activeSuspect.dateOfBirth}</span>}
                    {activeSuspect.residence && <span>RESIDENCE: {activeSuspect.residence}</span>}
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Motive & Alibi Comparison Row */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded border border-[#242c3b] bg-[#121620] p-4">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e3a74c] mb-1.5">
                      POTENTIAL MOTIVE INTELLIGENCE
                    </div>
                    <p className="text-xs text-[#dce2ec] leading-relaxed">
                      {activeSuspect.motiveSummary || 'No verified financial or personal motive logged.'}
                    </p>
                  </div>

                  <div className="rounded border border-[#242c3b] bg-[#121620] p-4">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9aa5b8]">
                        STATED ALIBI ({activeSuspect.alibiTimeWindow || 'WINDOW UNSPECIFIED'})
                      </span>
                      {activeSuspect.alibiVerified ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#6ee7b7]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> CORROBORATED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#f87171]">
                          <XCircle className="w-3.5 h-3.5" /> UNVERIFIED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#dce2ec] leading-relaxed">
                      {activeSuspect.alibiSummary}
                    </p>
                  </div>
                </div>

                {/* Personal Details Record */}
                {Object.keys(activeSuspect.personalDetails ?? {}).length > 0 && (
                  <div className="rounded border border-[#212836] bg-[#11151e] p-4">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1] mb-2">
                      PERSONAL &amp; CREDENTIAL RECORD
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5 text-xs">
                      {Object.entries(activeSuspect.personalDetails).map(([k, v]) => (
                        <div key={k} className="rounded border border-[#1d2432] bg-[#0b0e14] px-3 py-2">
                          <div className="font-mono text-[10px] text-[#6d7a90] uppercase">{k}</div>
                          <div className="text-[#dce2ec] mt-0.5">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contradictions Panel */}
                <div className="rounded border border-[#9e1b24]/45 bg-[#140e12] p-4 space-y-2.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#fca5a5] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#dc2626]" />
                    LOGGED EVIDENTIARY CONTRADICTIONS ({activeSuspect.contradictions.length + activeNote.customContradictions.length})
                  </div>

                  {activeSuspect.contradictions.length === 0 &&
                  activeNote.customContradictions.length === 0 ? (
                    <div className="text-xs text-[#8b98ae]">
                      No evidentiary contradictions flagged yet. Add your own below as you cross-examine exhibits.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeSuspect.contradictions.map((c) => (
                        <div
                          key={c.id}
                          className="rounded border border-[#9e1b24]/50 bg-[#0d0a0d] p-3 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#9e1b24]/30 text-[#fca5a5]">
                              {c.severity} DISCREPANCY
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {c.linkedEvidenceCodes.map((code) => (
                                <button
                                  key={code}
                                  type="button"
                                  onClick={() => onOpenEvidenceByCode(code)}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#c88a2e]/60 text-[#e3a74c] hover:bg-[#c88a2e]/20 cursor-pointer"
                                >
                                  {code}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="text-[#9aa5b8]">
                            <strong className="text-[#e8ecf2]">Claim:</strong> {c.statement}
                          </div>
                          <div className="text-[#fca5a5]">
                            <strong>Conflict:</strong> {c.conflictingDetail}
                          </div>
                        </div>
                      ))}

                      {activeNote.customContradictions.map((txt, idx) => (
                        <div
                          key={idx}
                          className="rounded border border-[#c88a2e]/50 bg-[#14120c] p-2.5 text-xs flex items-center justify-between gap-2"
                        >
                          <span className="text-[#fef3c7]">
                            <strong className="font-mono text-[10px] text-[#e3a74c] mr-2">
                              INVESTIGATOR FLAG:
                            </strong>
                            {txt}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              saveNote({
                                customContradictions: activeNote.customContradictions.filter(
                                  (_, i) => i !== idx,
                                ),
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

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newContradiction}
                      onChange={(e) => setNewContradiction(e.target.value)}
                      placeholder="Log custom contradiction you uncovered..."
                      className="flex-1 rounded border border-[#2c3547] bg-[#090b10] px-3 py-1.5 text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newContradiction.trim()) return;
                        saveNote({
                          customContradictions: [
                            ...activeNote.customContradictions,
                            newContradiction.trim(),
                          ],
                        });
                        setNewContradiction('');
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[#c88a2e]/60 bg-[#c88a2e]/15 px-3 py-1.5 font-mono text-[11px] text-[#e3a74c] hover:bg-[#c88a2e]/25 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> LOG
                    </button>
                  </div>
                </div>

                {/* Interviews & Linked Evidence */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded border border-[#222937] bg-[#11151e] p-4 space-y-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1]">
                      INTERVIEW RECORDS ({activeSuspect.interviewRecords.length})
                    </div>
                    {activeSuspect.interviewRecords.length === 0 ? (
                      <div className="text-xs text-[#667389]">No interview excerpts on file.</div>
                    ) : (
                      activeSuspect.interviewRecords.map((rec) => (
                        <div
                          key={rec.id}
                          className="rounded border border-[#1f2634] bg-[#0b0e14] p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                            <span className="text-[#e3a74c] font-semibold">{rec.title}</span>
                            <span className="text-[#667389]">{rec.recordedAt}</span>
                          </div>
                          <p className="text-[#cbd5e1] italic leading-relaxed">“{rec.excerpt}”</p>
                          {rec.linkedEvidenceCode && (
                            <button
                              type="button"
                              onClick={() => onOpenEvidenceByCode(rec.linkedEvidenceCode!)}
                              className="font-mono text-[10px] text-[#c88a2e] hover:underline cursor-pointer"
                            >
                              OPEN FULL TRANSCRIPT ({rec.linkedEvidenceCode}) →
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded border border-[#222937] bg-[#11151e] p-4 space-y-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1] flex items-center gap-1.5">
                      <FileSearch className="w-3.5 h-3.5 text-[#c88a2e]" />
                      LINKED EVIDENCE ({linkedEvidence.length})
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {linkedEvidence.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onOpenEvidenceByCode(ev.evidenceCode)}
                          className="w-full text-left rounded border border-[#1f2634] bg-[#0b0e14] hover:border-[#c88a2e] px-3 py-2 transition cursor-pointer"
                        >
                          <div className="font-mono text-[10px] text-[#e3a74c] font-semibold">
                            {ev.evidenceCode} · {ev.viewerType.toUpperCase()}
                          </div>
                          <div className="text-xs text-[#dce2ec] truncate">{ev.title}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Player-Generated Suspect Notes & Suspicion Assessment */}
                <div className="rounded border border-[#263042] bg-[#11151e] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e3a74c]">
                      PRIVATE INVESTIGATOR DOSSIER NOTES (AUTO-SAVED)
                    </span>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-[#7f8ca1]">SUSPICION INDEX:</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={activeNote.suspicionLevel}
                        onChange={(e) => saveNote({ suspicionLevel: Number(e.target.value) })}
                        className="w-28 accent-[#dc2626] cursor-pointer"
                      />
                      <span
                        className={`font-bold w-10 text-right ${
                          activeNote.suspicionLevel >= 70
                            ? 'text-[#f87171]'
                            : activeNote.suspicionLevel >= 40
                              ? 'text-[#e3a74c]'
                              : 'text-[#86efac]'
                        }`}
                      >
                        {activeNote.suspicionLevel}%
                      </span>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={activeNote.notes}
                    onChange={(e) => saveNote({ notes: e.target.value })}
                    placeholder={`Record behavioral observations, opportunity windows, and theories about ${activeSuspect.fullName}...`}
                    className="w-full rounded border border-[#293245] bg-[#090b10] p-3 text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
