'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Columns2,
  Pin,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  Headphones,
  Video,
  MessageSquareText,
  Table2,
  Mail,
  Binary,
  Shield,
  Link2,
  Users,
  Search,
  Play,
  Pause,
  AlertTriangle,
  ExternalLink,
  ArrowUpDown,
} from 'lucide-react';
import type {
  ClientEvidence,
  ClientEvidenceRelation,
  ClientSuspect,
} from '@/lib/client-types';
import type { EvidenceAnnotation } from '@/lib/types';
import CctvCanvasPlayer from './CctvCanvasPlayer';

export interface UniversalEvidenceViewerProps {
  evidence: ClientEvidence;
  allEvidence: ClientEvidence[];
  evidenceRelations: ClientEvidenceRelation[];
  suspects: ClientSuspect[];
  isBookmarked: boolean;
  annotation?: EvidenceAnnotation;
  compact?: boolean;
  onToggleBookmark: (evidenceId: string) => void;
  onUpdateAnnotation: (evidenceId: string, annotation: EvidenceAnnotation) => void;
  onPinToBoard: (evidence: ClientEvidence) => void;
  onAddToCompare: (evidenceId: string) => void;
  onSelectEvidenceById: (evidenceId: string) => void;
  onSelectSuspectById: (suspectId: string) => void;
  onUnlockEvidence: (evidenceId: string, passcode?: string) => Promise<{ ok: boolean; error?: string }>;
}

const VIEWER_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  pdf: { label: 'PDF Document', icon: FileText },
  image: { label: 'Forensic Image', icon: ImageIcon },
  audio: { label: 'Audio Recording', icon: Headphones },
  video: { label: 'CCTV / Video', icon: Video },
  transcript: { label: 'Transcript', icon: MessageSquareText },
  spreadsheet: { label: 'Spreadsheet', icon: Table2 },
  digital_comm: { label: 'Digital Comms', icon: Mail },
  metadata: { label: 'Metadata Record', icon: Binary },
};

export default function UniversalEvidenceViewer({
  evidence,
  allEvidence,
  evidenceRelations,
  suspects,
  isBookmarked,
  annotation,
  compact = false,
  onToggleBookmark,
  onUpdateAnnotation,
  onPinToBoard,
  onAddToCompare,
  onSelectEvidenceById,
  onSelectSuspectById,
  onUnlockEvidence,
}: UniversalEvidenceViewerProps) {
  const [passcodeInput, setPasscodeInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // PDF view toggle (native signed PDF vs high-contrast forensic reader)
  const [pdfMode, setPdfMode] = useState<'embed' | 'reader'>('reader');

  // Image forensic controls
  const [imgZoom, setImgZoom] = useState(1);
  const [imgFilter, setImgFilter] = useState<'normal' | 'contrast' | 'invert' | 'mono'>('normal');
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioSpeed, setAudioSpeed] = useState(1);

  // Transcript / Spreadsheet search & sort
  const [localSearch, setLocalSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Local note draft
  const [noteText, setNoteText] = useState(annotation?.note ?? '');
  const [noteFlag, setNoteFlag] = useState<EvidenceAnnotation['flag']>(annotation?.flag ?? 'none');
  const [showChain, setShowChain] = useState(false);

  useEffect(() => {
    setNoteText(annotation?.note ?? '');
    setNoteFlag(annotation?.flag ?? 'none');
  }, [evidence.id, annotation?.note, annotation?.flag]);

  useEffect(() => {
    setImgZoom(1);
    setImgFilter('normal');
    setActiveHotspotId(null);
    setLocalSearch('');
    setSortCol(null);
    setPasscodeInput('');
    setUnlockError('');
    setAudioPlaying(false);
    setAudioTime(0);
    setPdfMode(evidence.structuredContent?.documentPages?.length ? 'reader' : 'embed');
  }, [evidence.id, evidence.structuredContent?.documentPages?.length]);

  const primaryAsset = evidence.assets?.[0] ?? null;
  const viewerMeta = VIEWER_META[evidence.viewerType] ?? VIEWER_META.pdf;
  const ViewerIcon = viewerMeta.icon;

  // Related exhibits from evidenceRelations
  const relatedExhibits = useMemo(() => {
    const links: { item: ClientEvidence; relationLabel: string; relationType: string }[] = [];
    for (const rel of evidenceRelations) {
      if (rel.sourceEvidenceId === evidence.id) {
        const target = allEvidence.find((e) => e.id === rel.targetEvidenceId);
        if (target) links.push({ item: target, relationLabel: rel.label, relationType: rel.relationType });
      } else if (rel.targetEvidenceId === evidence.id) {
        const source = allEvidence.find((e) => e.id === rel.sourceEvidenceId);
        if (source) links.push({ item: source, relationLabel: rel.label, relationType: rel.relationType });
      }
    }
    return links;
  }, [evidence.id, evidenceRelations, allEvidence]);

  const linkedSuspects = useMemo(
    () => suspects.filter((s) => evidence.relatedSuspectIds?.includes(s.id)),
    [suspects, evidence.relatedSuspectIds],
  );

  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError('');
    setUnlocking(true);
    try {
      const res = await onUnlockEvidence(evidence.id, passcodeInput);
      if (!res.ok) {
        setUnlockError(res.error || 'Unlock condition failed.');
      }
    } finally {
      setUnlocking(false);
    }
  }

  function persistAnnotation(nextText: string, nextFlag: EvidenceAnnotation['flag']) {
    setNoteText(nextText);
    setNoteFlag(nextFlag);
    onUpdateAnnotation(evidence.id, {
      note: nextText,
      flag: nextFlag,
      updatedAt: new Date().toISOString(),
    });
  }

  const imgFilterCss =
    imgFilter === 'contrast'
      ? 'contrast(1.45) brightness(1.08)'
      : imgFilter === 'invert'
        ? 'invert(1) hue-rotate(180deg)'
        : imgFilter === 'mono'
          ? 'grayscale(1) contrast(1.25)'
          : 'none';

  // Render Lock Gate for server-locked Hidden Clues
  if (evidence.accessRules?.locked) {
    return (
      <div className="rounded-lg border border-[#c88a2e]/50 bg-[#0e1118] overflow-hidden">
        <div className="border-b border-[#242c3b] bg-[#131722] px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-[#c88a2e]/20 border border-[#c88a2e]/60 text-[#e3a74c] font-semibold">
                {evidence.evidenceCode}
              </span>
              <span className="text-[#f87171] flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> ENCRYPTED / RESTRICTED ACCESS
              </span>
            </div>
            <h2 className="text-lg font-semibold text-[#e8ecf2] mt-1">{evidence.title}</h2>
          </div>
        </div>

        <div className="p-8 max-w-xl mx-auto text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#c88a2e]/15 border border-[#c88a2e]/60 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-[#e3a74c]" />
          </div>
          <div className="font-mono text-xs tracking-[0.2em] text-[#e3a74c] uppercase">
            {evidence.accessRules.lockReason || 'RESTRICTED FORENSIC VAULT'}
          </div>
          <p className="text-sm text-[#9aa5b8] mt-3 leading-relaxed">
            {evidence.accessRules.hint ||
              'Cross-reference other case exhibits to discover the authorization credential.'}
          </p>

          <form onSubmit={handleUnlockSubmit} className="mt-6 space-y-3">
            {evidence.accessRules.unlockType === 'passcode' && (
              <input
                type="text"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="ENTER DECRYPTION CODE..."
                className="w-full max-w-xs mx-auto block text-center rounded border border-[#313b4f] bg-[#07080b] px-4 py-2.5 font-mono text-sm tracking-[0.25em] text-[#e8ecf2] uppercase focus:border-[#c88a2e] focus:outline-none"
              />
            )}

            {unlockError && (
              <div className="text-xs font-mono text-[#fca5a5] bg-[#9e1b24]/20 border border-[#9e1b24]/60 rounded px-3 py-2">
                {unlockError}
              </div>
            )}

            <button
              type="submit"
              disabled={unlocking}
              className="inline-flex items-center gap-2 rounded bg-[#c88a2e] hover:bg-[#dfa03f] text-[#07080b] font-mono text-xs font-bold uppercase tracking-wider px-5 py-2.5 transition cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              {unlocking ? 'VERIFYING ON SERVER...' : 'DECRYPT & UNLOCK EXHIBIT'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232b3a] bg-[#0e1118] flex flex-col overflow-hidden">
      {/* Header Strip */}
      <div className="border-b border-[#222937] bg-[#131822] px-4 sm:px-5 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-[#c88a2e]/20 border border-[#c88a2e]/50 text-[#e3a74c] font-semibold">
                {evidence.evidenceCode}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#1b2230] border border-[#2d374a] text-[#cbd5e1] inline-flex items-center gap-1">
                <ViewerIcon className="w-3 h-3 text-[#c88a2e]" />
                {viewerMeta.label}
              </span>
              <span
                className={`px-2 py-0.5 rounded border text-[10px] ${
                  evidence.classification === 'FORENSIC_SEALED' ||
                  evidence.classification === 'RESTRICTED'
                    ? 'border-[#9e1b24]/70 bg-[#9e1b24]/15 text-[#fca5a5]'
                    : 'border-[#2c3547] bg-[#161c28] text-[#9aa5b8]'
                }`}
              >
                {evidence.classification.replace(/_/g, ' ')}
              </span>
              {evidence.isHiddenClue && (
                <span className="px-2 py-0.5 rounded border border-[#2e7d5b] bg-[#2e7d5b]/15 text-[#86efac] text-[10px]">
                  DECRYPTED VAULT
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-[#e8ecf2] mt-1.5 leading-snug">
              {evidence.title}
            </h2>
            {evidence.summary && (
              <p className="text-xs text-[#9aa5b8] mt-1 leading-relaxed">{evidence.summary}</p>
            )}
          </div>

          {!compact && (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onToggleBookmark(evidence.id)}
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[11px] transition cursor-pointer ${
                  isBookmarked
                    ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                    : 'border-[#2a3345] bg-[#151a24] text-[#9aa5b8] hover:text-white'
                }`}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                {isBookmarked ? 'BOOKMARKED' : 'BOOKMARK'}
              </button>

              <button
                type="button"
                onClick={() => onPinToBoard(evidence)}
                className="inline-flex items-center gap-1.5 rounded border border-[#2a3345] bg-[#151a24] hover:border-[#c88a2e] px-2.5 py-1.5 font-mono text-[11px] text-[#cbd5e1] transition cursor-pointer"
              >
                <Pin className="w-3.5 h-3.5 text-[#c88a2e]" />
                PIN TO BOARD
              </button>

              <button
                type="button"
                onClick={() => onAddToCompare(evidence.id)}
                className="inline-flex items-center gap-1.5 rounded border border-[#2a3345] bg-[#151a24] hover:border-[#3b82a6] px-2.5 py-1.5 font-mono text-[11px] text-[#cbd5e1] transition cursor-pointer"
              >
                <Columns2 className="w-3.5 h-3.5 text-[#3b82a6]" />
                COMPARE
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Stage — Adapts Dynamically to ALL 8 Viewer Types */}
      <div className="p-4 sm:p-5 space-y-5">
        {/* 1. PDF VIEWER */}
        {evidence.viewerType === 'pdf' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                {evidence.structuredContent?.documentPages?.length ? (
                  <button
                    type="button"
                    onClick={() => setPdfMode('reader')}
                    className={`px-3 py-1 rounded border cursor-pointer ${
                      pdfMode === 'reader'
                        ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                        : 'border-[#273042] bg-[#141821] text-[#9aa5b8]'
                    }`}
                  >
                    FORENSIC TEXT READER
                  </button>
                ) : null}
                {primaryAsset && (
                  <button
                    type="button"
                    onClick={() => setPdfMode('embed')}
                    className={`px-3 py-1 rounded border cursor-pointer ${
                      pdfMode === 'embed'
                        ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                        : 'border-[#273042] bg-[#141821] text-[#9aa5b8]'
                    }`}
                  >
                    ORIGINAL PDF ({Math.max(1, Math.round(primaryAsset.byteSize / 1024))} KB)
                  </button>
                )}
              </div>

              {primaryAsset && (
                <a
                  href={primaryAsset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-[#c88a2e] hover:text-[#e3a74c]"
                >
                  OPEN SIGNED PDF <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {pdfMode === 'embed' && primaryAsset ? (
              <div className="rounded border border-[#2a3345] bg-[#0a0c10] overflow-hidden">
                <iframe
                  src={primaryAsset.url}
                  title={evidence.title}
                  className="w-full h-[500px] bg-white"
                />
              </div>
            ) : (
              <div className="space-y-3">
                {(evidence.structuredContent?.documentPages ?? []).map((page) => (
                  <div
                    key={page.pageNumber}
                    className="rounded border border-[#293245] bg-[#121620] p-5 relative"
                  >
                    <div className="flex items-center justify-between border-b border-[#222937] pb-2 mb-3">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#e3a74c]">
                        {page.heading || `Document Page ${page.pageNumber}`}
                      </span>
                      <span className="font-mono text-[10px] text-[#667389]">
                        PAGE {page.pageNumber} // {evidence.evidenceCode}
                      </span>
                    </div>
                    <p className="text-sm text-[#dce2ec] leading-relaxed whitespace-pre-line font-sans">
                      {page.body}
                    </p>
                  </div>
                ))}
                {!evidence.structuredContent?.documentPages?.length && (
                  <div className="rounded border border-[#242c3b] bg-[#121620] p-5 text-sm text-[#9aa5b8]">
                    {evidence.description || 'Open the signed PDF above to inspect this exhibit.'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. IMAGE & INTERACTIVE CRIME SCENE VIEWER */}
        {evidence.viewerType === 'image' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#232b3a] bg-[#12161f] px-3 py-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setImgZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))}
                  className="rounded border border-[#2a3345] bg-[#171d29] p-1.5 text-[#cbd5e1] hover:border-[#c88a2e] cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] text-[#e3a74c] w-12 text-center">
                  {Math.round(imgZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setImgZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  className="rounded border border-[#2a3345] bg-[#171d29] p-1.5 text-[#cbd5e1] hover:border-[#c88a2e] cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImgZoom(1);
                    setImgFilter('normal');
                  }}
                  className="rounded border border-[#2a3345] bg-[#171d29] p-1.5 text-[#cbd5e1] hover:border-[#c88a2e] cursor-pointer"
                  title="Reset View"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1 font-mono text-[10px]">
                {(
                  [
                    ['normal', 'RAW'],
                    ['contrast', 'ENHANCE'],
                    ['invert', 'UV/INVERT'],
                    ['mono', 'MONO'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setImgFilter(key)}
                    className={`px-2 py-1 rounded border cursor-pointer ${
                      imgFilter === key
                        ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                        : 'border-[#273042] bg-[#151a24] text-[#8d99ad]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded border border-[#262f40] bg-[#07090d] overflow-auto max-h-[520px] p-3">
              {primaryAsset ? (
                <div
                  className="relative inline-block origin-top-left transition-transform"
                  style={{ transform: `scale(${imgZoom})`, width: '100%' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={primaryAsset.url}
                    alt={evidence.title}
                    style={{ filter: imgFilterCss }}
                    className="w-full h-auto rounded block select-none"
                  />

                  {/* Interactive Crime Scene / Photo Hotspots */}
                  {(evidence.structuredContent?.hotspots ?? []).map((hs, idx) => (
                    <button
                      key={hs.id}
                      type="button"
                      onClick={() =>
                        setActiveHotspotId(activeHotspotId === hs.id ? null : hs.id)
                      }
                      style={{ left: `${hs.xPercent}%`, top: `${hs.yPercent}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full font-mono text-[11px] font-bold flex items-center justify-center border-2 transition cursor-pointer shadow-lg ${
                        activeHotspotId === hs.id
                          ? 'bg-[#dc2626] border-white text-white scale-125'
                          : 'bg-[#c88a2e] border-[#090b10] text-[#090b10] hover:scale-110'
                      }`}
                      title={hs.label}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center font-mono text-xs text-[#667389]">
                  No image asset attached to this exhibit.
                </div>
              )}
            </div>

            {/* Active Hotspot Inspector */}
            {evidence.structuredContent?.hotspots?.length ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {evidence.structuredContent.hotspots.map((hs, idx) => {
                  const linked = hs.linkedEvidenceCode
                    ? allEvidence.find((e) => e.evidenceCode === hs.linkedEvidenceCode)
                    : null;
                  const active = activeHotspotId === hs.id;
                  return (
                    <div
                      key={hs.id}
                      onClick={() => setActiveHotspotId(hs.id)}
                      className={`rounded border p-2.5 text-xs transition cursor-pointer ${
                        active
                          ? 'border-[#dc2626] bg-[#9e1b24]/15'
                          : 'border-[#232b3a] bg-[#131722] hover:border-[#c88a2e]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                        <span className="font-semibold text-[#e3a74c]">
                          [{idx + 1}] {hs.label}
                        </span>
                        {linked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEvidenceById(linked.id);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[#9e1b24]/30 border border-[#9e1b24] text-[#fca5a5] hover:bg-[#9e1b24] hover:text-white cursor-pointer"
                          >
                            OPEN {linked.evidenceCode}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9aa5b8] mt-1 leading-snug">{hs.detail}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        {/* 3. AUDIO ARCHIVE PLAYER + SYNCHRONIZED TRANSCRIPT */}
        {evidence.viewerType === 'audio' && (
          <div className="space-y-4">
            <div className="rounded border border-[#262f40] bg-[#10141c] p-4 space-y-3">
              {primaryAsset && (
                <audio
                  ref={audioRef}
                  src={primaryAsset.url}
                  onTimeUpdate={(e) => setAudioTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
                  onEnded={() => setAudioPlaying(false)}
                  className="hidden"
                />
              )}

              {/* Stylized Forensic Waveform Bars */}
              <div className="h-16 rounded bg-[#07090d] border border-[#1d2432] px-3 flex items-center gap-1 overflow-hidden">
                {Array.from({ length: 56 }, (_, idx) => {
                  const pct = audioDuration > 0 ? audioTime / audioDuration : 0;
                  const played = idx / 56 <= pct;
                  const barHeight = 20 + Math.abs(Math.sin(idx * 0.72 + 1.3) * 65);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (audioRef.current && audioDuration > 0) {
                          audioRef.current.currentTime = (idx / 56) * audioDuration;
                        }
                      }}
                      className={`flex-1 rounded-sm transition-all cursor-pointer ${
                        played ? 'bg-[#dc2626]' : 'bg-[#2a3447] hover:bg-[#c88a2e]/70'
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!audioRef.current) return;
                      if (audioPlaying) {
                        audioRef.current.pause();
                        setAudioPlaying(false);
                      } else {
                        void audioRef.current.play();
                        setAudioPlaying(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded bg-[#9e1b24] hover:bg-[#b5222c] px-3.5 py-1.5 font-mono text-xs font-semibold text-white cursor-pointer"
                  >
                    {audioPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {audioPlaying ? 'PAUSE' : 'PLAY AUDIO'}
                  </button>
                  <span className="font-mono text-xs text-[#e3a74c]">
                    {audioTime.toFixed(1)}s / {(audioDuration || evidence.structuredContent?.mediaDurationSeconds || 0).toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center gap-1 font-mono text-[11px]">
                  {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setAudioSpeed(r);
                        if (audioRef.current) audioRef.current.playbackRate = r;
                      }}
                      className={`px-2 py-1 rounded border cursor-pointer ${
                        audioSpeed === r
                          ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                          : 'border-[#262f40] bg-[#151a24] text-[#9aa5b8]'
                      }`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Synchronized Audio Transcript */}
            {evidence.structuredContent?.transcriptLines?.length ? (
              <div className="rounded border border-[#232b3a] bg-[#11151e] p-4 space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1] mb-2">
                  SYNCHRONIZED AUDIO TRANSCRIPT (CLICK LINE TO SEEK)
                </div>
                {evidence.structuredContent.transcriptLines.map((line) => {
                  const isActive =
                    typeof line.seconds === 'number' &&
                    audioTime >= line.seconds &&
                    audioTime < line.seconds + 5;
                  return (
                    <div
                      key={line.id}
                      onClick={() => {
                        if (audioRef.current && typeof line.seconds === 'number') {
                          audioRef.current.currentTime = line.seconds;
                          void audioRef.current.play();
                          setAudioPlaying(true);
                        }
                      }}
                      className={`rounded border px-3 py-2 text-xs transition cursor-pointer ${
                        isActive
                          ? 'border-[#c88a2e] bg-[#c88a2e]/15'
                          : line.highlight
                            ? 'border-[#9e1b24]/60 bg-[#9e1b24]/10'
                            : 'border-[#1f2634] bg-[#0c1017] hover:border-[#323d52]'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-[#c88a2e]">[{line.timestamp}]</span>
                        <span className="font-bold text-[#e8ecf2]">{line.speaker}</span>
                        {line.role && <span className="text-[#667389]">({line.role})</span>}
                      </div>
                      <p className="text-[#dce2ec] mt-1 leading-relaxed">{line.text}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        {/* 4. VIDEO / CCTV VIEWER */}
        {evidence.viewerType === 'video' && primaryAsset && (
          <CctvCanvasPlayer
            assetUrl={primaryAsset.url}
            mimeType={primaryAsset.mimeType}
            fallbackMarkers={evidence.structuredContent?.mediaMarkers}
          />
        )}

        {/* 5. TRANSCRIPT VIEWER (Witness Statements & Interrogations) */}
        {evidence.viewerType === 'transcript' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#667389] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Filter transcript keywords or speaker..."
                className="w-full rounded border border-[#283143] bg-[#090b10] pl-9 pr-3 py-2 text-xs font-mono text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {(evidence.structuredContent?.transcriptLines ?? [])
                .filter((ln) => {
                  if (!localSearch.trim()) return true;
                  const q = localSearch.toLowerCase();
                  return (
                    ln.text.toLowerCase().includes(q) || ln.speaker.toLowerCase().includes(q)
                  );
                })
                .map((ln) => (
                  <div
                    key={ln.id}
                    className={`rounded border p-3.5 ${
                      ln.highlight
                        ? 'border-[#9e1b24]/70 bg-[#9e1b24]/10'
                        : 'border-[#212836] bg-[#121620]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[#c88a2e]">{ln.timestamp}</span>
                        <span className="font-semibold text-[#e8ecf2]">{ln.speaker}</span>
                        {ln.role && <span className="text-[#6c798f]">· {ln.role}</span>}
                      </div>
                      {ln.highlight && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#9e1b24]/30 text-[#fca5a5]">
                          KEY STATEMENT
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#dde3ed] mt-1.5 leading-relaxed">{ln.text}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 6. SPREADSHEET / ACCESS LEDGER VIEWER */}
        {evidence.viewerType === 'spreadsheet' && evidence.structuredContent?.spreadsheet && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-xs text-[#e3a74c]">
                SHEET: {evidence.structuredContent.spreadsheet.sheetName}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#667389] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Filter rows..."
                  className="w-full rounded border border-[#283143] bg-[#090b10] pl-8 pr-3 py-1.5 text-xs font-mono text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded border border-[#252e3f] overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-[#151a25] border-b border-[#283143] text-[#9aa5b8]">
                    {evidence.structuredContent.spreadsheet.columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => {
                          if (sortCol === col.key) {
                            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSortCol(col.key);
                            setSortDir('asc');
                          }
                        }}
                        className="px-3 py-2.5 uppercase text-[10px] tracking-wider cursor-pointer hover:text-white select-none"
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label} <ArrowUpDown className="w-3 h-3 opacity-60" />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1d2432]">
                  {(() => {
                    const sheet = evidence.structuredContent.spreadsheet!;
                    let rows = [...sheet.rows];
                    if (localSearch.trim()) {
                      const q = localSearch.toLowerCase();
                      rows = rows.filter((r) =>
                        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)),
                      );
                    }
                    if (sortCol) {
                      rows.sort((a, b) => {
                        const va = String(a[sortCol] ?? '');
                        const vb = String(b[sortCol] ?? '');
                        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                      });
                    }
                    return rows.map((row, idx) => {
                      const flagVal = String(row.flag ?? '').toUpperCase();
                      const isCrit = flagVal.includes('CRITICAL');
                      const isWarn =
                        flagVal.includes('ANOMALY') ||
                        flagVal.includes('CHECK') ||
                        flagVal.includes('VERIFY');
                      return (
                        <tr
                          key={idx}
                          className={
                            isCrit
                              ? 'bg-[#9e1b24]/18 text-[#fee2e2]'
                              : isWarn
                                ? 'bg-[#c88a2e]/12 text-[#fef3c7]'
                                : 'bg-[#0c1017] hover:bg-[#131823] text-[#d4dce8]'
                          }
                        >
                          {sheet.columns.map((col) => (
                            <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                              {col.type === 'flag' ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    isCrit
                                      ? 'bg-[#dc2626] text-white'
                                      : isWarn
                                        ? 'bg-[#c88a2e]/30 text-[#e3a74c]'
                                        : 'bg-[#1c2331] text-[#8592a6]'
                                  }`}
                                >
                                  {String(row[col.key] ?? '')}
                                </span>
                              ) : (
                                String(row[col.key] ?? '')
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            {evidence.structuredContent.spreadsheet.summaryNote && (
              <div className="text-[11px] font-mono text-[#7f8ca1]">
                NOTE: {evidence.structuredContent.spreadsheet.summaryNote}
              </div>
            )}
          </div>
        )}

        {/* 7. DIGITAL COMMUNICATIONS VIEWER */}
        {evidence.viewerType === 'digital_comm' && (
          <div className="space-y-3">
            {evidence.structuredContent?.commHeader && (
              <div className="rounded border border-[#242c3b] bg-[#121620] p-3 grid sm:grid-cols-2 gap-2 font-mono text-[11px]">
                <div>
                  <span className="text-[#667389]">SOURCE: </span>
                  <span className="text-[#e8ecf2]">{evidence.structuredContent.commHeader.deviceOwner}</span>
                </div>
                <div>
                  <span className="text-[#667389]">EXTRACTION: </span>
                  <span className="text-[#e3a74c]">{evidence.structuredContent.commHeader.extractionTool}</span>
                </div>
                <div>
                  <span className="text-[#667389]">CHANNELS: </span>
                  <span className="text-[#cbd5e1]">{evidence.structuredContent.commHeader.account}</span>
                </div>
                <div>
                  <span className="text-[#667389]">WINDOW: </span>
                  <span className="text-[#cbd5e1]">{evidence.structuredContent.commHeader.dateRange}</span>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {(evidence.structuredContent?.messages ?? []).map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-3.5 ${
                    msg.deletedRecovered
                      ? 'border-[#9e1b24]/65 bg-[#171117]'
                      : msg.direction === 'internal'
                        ? 'border-[#3b82a6]/50 bg-[#0f1620]'
                        : 'border-[#252e3f] bg-[#121620]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#e8ecf2]">{msg.sender}</span>
                      {msg.recipient && (
                        <span className="text-[#6d7a90]">→ {msg.recipient}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.deletedRecovered && (
                        <span className="px-1.5 py-0.5 rounded bg-[#9e1b24]/30 border border-[#9e1b24] text-[#fca5a5] text-[10px]">
                          RECOVERED DELETED
                        </span>
                      )}
                      <span className="text-[#c88a2e]">{msg.timestamp}</span>
                    </div>
                  </div>
                  {msg.subject && (
                    <div className="font-mono text-xs text-[#7dd3fc] mt-1">
                      SUBJ: {msg.subject}
                    </div>
                  )}
                  <p className="text-sm text-[#e1e6ef] mt-2 leading-relaxed">{msg.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. STRUCTURED METADATA / FORENSIC LOG VIEWER */}
        {evidence.viewerType === 'metadata' && (
          <div className="space-y-4">
            {(evidence.structuredContent?.metadataSections ?? []).map((sec, idx) => (
              <div
                key={idx}
                className="rounded border border-[#262f40] bg-[#10141c] overflow-hidden"
              >
                <div className="bg-[#161c28] border-b border-[#242c3b] px-4 py-2 font-mono text-xs font-semibold text-[#e3a74c]">
                  {sec.section}
                </div>
                <div className="divide-y divide-[#1d2432]">
                  {sec.entries.map((entry, eIdx) => (
                    <div
                      key={eIdx}
                      className={`px-4 py-2.5 grid sm:grid-cols-12 gap-2 text-xs ${
                        entry.anomaly ? 'bg-[#9e1b24]/15' : ''
                      }`}
                    >
                      <div className="sm:col-span-4 font-mono text-[#8b98ae] flex items-center gap-1.5">
                        {entry.anomaly && <AlertTriangle className="w-3.5 h-3.5 text-[#f87171] shrink-0" />}
                        {entry.key}
                      </div>
                      <div className="sm:col-span-8 font-mono text-[#e8ecf2] break-all">
                        <div>{entry.value}</div>
                        {entry.note && (
                          <div className="text-[11px] font-sans text-[#fca5a5] mt-1">
                            {entry.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Technical Metadata & Chain of Custody Grid */}
        {!compact && (
          <div className="grid lg:grid-cols-2 gap-4 pt-3 border-t border-[#202736]">
            {/* Exhibit Technical Metadata */}
            <div className="rounded border border-[#212836] bg-[#11151e] p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#c88a2e]" /> EXHIBIT METADATA
                </span>
                {evidence.chainOfCustody?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowChain((v) => !v)}
                    className="font-mono text-[10px] text-[#c88a2e] hover:underline cursor-pointer"
                  >
                    {showChain ? 'HIDE CUSTODY' : `CHAIN OF CUSTODY (${evidence.chainOfCustody.length})`}
                  </button>
                )}
              </div>

              <dl className="space-y-1.5 text-xs">
                {evidence.sourceOrigin && (
                  <div className="flex justify-between gap-3">
                    <dt className="font-mono text-[11px] text-[#6d7a90]">Origin</dt>
                    <dd className="text-right text-[#dce2ec]">{evidence.sourceOrigin}</dd>
                  </div>
                )}
                {evidence.collectedAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="font-mono text-[11px] text-[#6d7a90]">Collected</dt>
                    <dd className="text-right font-mono text-[11px] text-[#cbd5e1]">{evidence.collectedAt}</dd>
                  </div>
                )}
                {evidence.locationFound && (
                  <div className="flex justify-between gap-3">
                    <dt className="font-mono text-[11px] text-[#6d7a90]">Location</dt>
                    <dd className="text-right text-[#cbd5e1]">{evidence.locationFound}</dd>
                  </div>
                )}
                {Object.entries(evidence.metadata ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="font-mono text-[11px] text-[#6d7a90]">{k}</dt>
                    <dd className="text-right font-mono text-[11px] text-[#cbd5e1] break-words max-w-[65%]">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              {showChain && evidence.chainOfCustody?.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#222937] space-y-1.5">
                  {evidence.chainOfCustody.map((c, idx) => (
                    <div key={idx} className="font-mono text-[10px] text-[#9aa5b8] flex justify-between gap-2">
                      <span>
                        {c.timestamp} · <strong className="text-[#e8ecf2]">{c.handler}</strong> — {c.action}
                      </span>
                      {c.sealId && <span className="text-[#c88a2e]">{c.sealId}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Investigator Personal Annotation & Cross-References */}
            <div className="rounded border border-[#212836] bg-[#11151e] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1]">
                  INVESTIGATOR ANNOTATION (AUTO-SAVED)
                </span>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  {(
                    [
                      ['none', 'NONE'],
                      ['key', 'KEY'],
                      ['contradiction', 'CONFLICT'],
                      ['verify', 'VERIFY'],
                    ] as const
                  ).map(([flag, lbl]) => (
                    <button
                      key={flag}
                      type="button"
                      onClick={() => persistAnnotation(noteText, flag)}
                      className={`px-1.5 py-0.5 rounded border cursor-pointer ${
                        noteFlag === flag
                          ? flag === 'contradiction'
                            ? 'border-[#dc2626] bg-[#dc2626]/25 text-[#fca5a5]'
                            : flag === 'key'
                              ? 'border-[#c88a2e] bg-[#c88a2e]/25 text-[#e3a74c]'
                              : 'border-[#475569] bg-[#1e2636] text-white'
                          : 'border-[#252e3f] text-[#6d7a90]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                value={noteText}
                onChange={(e) => persistAnnotation(e.target.value, noteFlag)}
                placeholder="Record forensic deductions, alibi discrepancies, or lead codes for this exhibit..."
                className="w-full rounded border border-[#273042] bg-[#090b10] p-2.5 text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none resize-none"
              />

              {/* Related Evidence & Suspect Chips */}
              {(relatedExhibits.length > 0 || linkedSuspects.length > 0) && (
                <div className="space-y-2 pt-1">
                  {relatedExhibits.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-[#6d7a90] inline-flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> RELATED:
                      </span>
                      {relatedExhibits.map(({ item, relationType }) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectEvidenceById(item.id)}
                          className={`px-2 py-0.5 rounded border font-mono text-[10px] transition cursor-pointer ${
                            relationType === 'contradicts'
                              ? 'border-[#9e1b24]/70 bg-[#9e1b24]/15 text-[#fca5a5] hover:bg-[#9e1b24]/30'
                              : 'border-[#2b3549] bg-[#161c28] text-[#cbd5e1] hover:border-[#c88a2e]'
                          }`}
                        >
                          {item.evidenceCode} · {relationType}
                        </button>
                      ))}
                    </div>
                  )}

                  {linkedSuspects.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-[#6d7a90] inline-flex items-center gap-1">
                        <Users className="w-3 h-3" /> SUBJECTS:
                      </span>
                      {linkedSuspects.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSelectSuspectById(s.id)}
                          className="px-2 py-0.5 rounded border border-[#2b3549] bg-[#161c28] hover:border-[#c88a2e] font-mono text-[10px] text-[#e3a74c] transition cursor-pointer"
                        >
                          {s.suspectCode} {s.fullName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
