'use client';

import React, { useMemo, useState } from 'react';
import {
  Search,
  Bookmark,
  Lock,
  Eye,
  Filter,
  FileText,
  Image as ImageIcon,
  Headphones,
  Video,
  MessageSquareText,
  Table2,
  Mail,
  Binary,
} from 'lucide-react';
import type {
  ClientEvidence,
  ClientEvidenceRelation,
  ClientSuspect,
} from '@/lib/client-types';
import type { EvidenceAnnotation, EvidenceSection } from '@/lib/types';
import UniversalEvidenceViewer from './UniversalEvidenceViewer';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  image: ImageIcon,
  audio: Headphones,
  video: Video,
  transcript: MessageSquareText,
  spreadsheet: Table2,
  digital_comm: Mail,
  metadata: Binary,
};

export default function EvidenceArchiveView({
  sectionTitle,
  sectionFilter,
  allEvidence,
  evidenceRelations,
  suspects,
  selectedEvidenceId,
  viewedIds,
  bookmarkedIds,
  annotations,
  onSelectEvidence,
  onToggleBookmark,
  onUpdateAnnotation,
  onPinToBoard,
  onAddToCompare,
  onSelectSuspectById,
  onUnlockEvidence,
}: {
  sectionTitle: string;
  sectionFilter?: EvidenceSection;
  allEvidence: ClientEvidence[];
  evidenceRelations: ClientEvidenceRelation[];
  suspects: ClientSuspect[];
  selectedEvidenceId: string | null;
  viewedIds: string[];
  bookmarkedIds: string[];
  annotations: Record<string, EvidenceAnnotation>;
  onSelectEvidence: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onUpdateAnnotation: (id: string, ann: EvidenceAnnotation) => void;
  onPinToBoard: (ev: ClientEvidence) => void;
  onAddToCompare: (id: string) => void;
  onSelectSuspectById: (id: string) => void;
  onUnlockEvidence: (id: string, passcode?: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [query, setQuery] = useState('');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [viewerTypeFilter, setViewerTypeFilter] = useState<string>('all');

  const sectionItems = useMemo(() => {
    return allEvidence.filter((e) => {
      if (sectionFilter && e.section !== sectionFilter) return false;
      if (onlyBookmarked && !bookmarkedIds.includes(e.id)) return false;
      if (viewerTypeFilter !== 'all' && e.viewerType !== viewerTypeFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${e.evidenceCode} ${e.title} ${e.summary} ${e.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allEvidence, sectionFilter, onlyBookmarked, bookmarkedIds, viewerTypeFilter, query]);

  const activeEvidence =
    sectionItems.find((e) => e.id === selectedEvidenceId) ??
    allEvidence.find((e) => e.id === selectedEvidenceId && (!sectionFilter || e.section === sectionFilter)) ??
    sectionItems[0] ??
    null;

  return (
    <div className="space-y-4">
      {/* Section Header & Filters */}
      <div className="rounded-lg border border-[#222937] bg-[#10141c] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c88a2e]">
            EVIDENCE ARCHIVE MODULE
          </div>
          <h1 className="text-lg font-semibold text-[#e8ecf2]">{sectionTitle}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#667389] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code, title, tag..."
              className="rounded border border-[#293245] bg-[#090b10] pl-8 pr-3 py-1.5 text-xs font-mono text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none w-48"
            />
          </div>

          <select
            value={viewerTypeFilter}
            onChange={(e) => setViewerTypeFilter(e.target.value)}
            className="rounded border border-[#293245] bg-[#090b10] px-2.5 py-1.5 text-xs font-mono text-[#cbd5e1] focus:border-[#c88a2e] focus:outline-none"
          >
            <option value="all">ALL FORMATS</option>
            <option value="pdf">PDF</option>
            <option value="image">IMAGE</option>
            <option value="audio">AUDIO</option>
            <option value="video">VIDEO/CCTV</option>
            <option value="transcript">TRANSCRIPT</option>
            <option value="spreadsheet">SPREADSHEET</option>
            <option value="digital_comm">DIGITAL COMMS</option>
            <option value="metadata">METADATA</option>
          </select>

          <button
            type="button"
            onClick={() => setOnlyBookmarked((v) => !v)}
            className={`inline-flex items-center gap-1 rounded border px-2.5 py-1.5 font-mono text-[11px] cursor-pointer ${
              onlyBookmarked
                ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                : 'border-[#293245] bg-[#141821] text-[#9aa5b8]'
            }`}
          >
            <Bookmark className="w-3 h-3" /> BOOKMARKS
          </button>
        </div>
      </div>

      {sectionItems.length === 0 ? (
        <div className="rounded-lg border border-[#222937] bg-[#0e1118] p-10 text-center">
          <Filter className="w-6 h-6 text-[#667389] mx-auto mb-2" />
          <div className="font-mono text-xs text-[#9aa5b8]">
            No evidence exhibits match the active filter in {sectionTitle}.
          </div>
        </div>
      ) : (
        <div className="grid xl:grid-cols-12 gap-4 items-start">
          {/* Exhibit List Rail */}
          <div className="xl:col-span-4 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {sectionItems.map((item) => {
              const Icon = TYPE_ICONS[item.viewerType] ?? FileText;
              const isSelected = activeEvidence?.id === item.id;
              const isViewed = viewedIds.includes(item.id);
              const isSaved = bookmarkedIds.includes(item.id);
              const flag = annotations[item.id]?.flag;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectEvidence(item.id)}
                  className={`w-full text-left rounded-lg border p-3 transition cursor-pointer ${
                    isSelected
                      ? 'border-[#c88a2e] bg-[#171c27]'
                      : 'border-[#212836] bg-[#0e1118] hover:border-[#344056]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#e3a74c]">{item.evidenceCode}</span>
                      <span className="text-[#728096] inline-flex items-center gap-1">
                        <Icon className="w-3 h-3" /> {item.viewerType.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.accessRules?.locked && <Lock className="w-3 h-3 text-[#f87171]" />}
                      {isSaved && <Bookmark className="w-3 h-3 text-[#e3a74c] fill-[#e3a74c]" />}
                      {isViewed && <Eye className="w-3 h-3 text-[#2e7d5b]" />}
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-[#e8ecf2] mt-1.5 line-clamp-2">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-[#8894a8] mt-1 line-clamp-2 leading-snug">
                    {item.summary}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {flag && flag !== 'none' && (
                      <span
                        className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded ${
                          flag === 'contradiction'
                            ? 'bg-[#9e1b24]/30 text-[#fca5a5]'
                            : 'bg-[#c88a2e]/25 text-[#e3a74c]'
                        }`}
                      >
                        {flag}
                      </span>
                    )}
                    {item.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#161c28] text-[#7f8ca1]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Universal Evidence Viewer Stage */}
          <div className="xl:col-span-8 min-w-0">
            {activeEvidence && (
              <UniversalEvidenceViewer
                evidence={activeEvidence}
                allEvidence={allEvidence}
                evidenceRelations={evidenceRelations}
                suspects={suspects}
                isBookmarked={bookmarkedIds.includes(activeEvidence.id)}
                annotation={annotations[activeEvidence.id]}
                onToggleBookmark={onToggleBookmark}
                onUpdateAnnotation={onUpdateAnnotation}
                onPinToBoard={onPinToBoard}
                onAddToCompare={onAddToCompare}
                onSelectEvidenceById={onSelectEvidence}
                onSelectSuspectById={onSelectSuspectById}
                onUnlockEvidence={onUnlockEvidence}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
