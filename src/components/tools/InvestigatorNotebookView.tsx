'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Pin, Trash2, Search, BookOpen, Tag } from 'lucide-react';
import type { ClientEvidence, ClientSuspect } from '@/lib/client-types';
import type { NotebookEntry } from '@/lib/types';

export default function InvestigatorNotebookView({
  entries,
  allEvidence,
  suspects,
  onChangeEntries,
  onOpenEvidenceByCode,
  onOpenSuspectByCode,
}: {
  entries: NotebookEntry[];
  allEvidence: ClientEvidence[];
  suspects: ClientSuspect[];
  onChangeEntries: (next: NotebookEntry[]) => void;
  onOpenEvidenceByCode: (code: string) => void;
  onOpenSuspectByCode: (code: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [tagInput, setTagInput] = useState('');

  const filtered = useMemo(() => {
    const list = [...entries].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const activeEntry =
    entries.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  function createEntry() {
    const created: NotebookEntry = {
      id: `nb-${Date.now().toString(36)}`,
      title: `Field Note #${entries.length + 1}`,
      content: '',
      tags: ['lead'],
      linkedEvidenceCodes: [],
      linkedSuspectCodes: [],
      pinned: false,
      updatedAt: new Date().toISOString(),
    };
    onChangeEntries([created, ...entries]);
    setSelectedId(created.id);
  }

  function updateActive(patch: Partial<NotebookEntry>) {
    if (!activeEntry) return;
    onChangeEntries(
      entries.map((e) =>
        e.id === activeEntry.id
          ? { ...e, ...patch, updatedAt: new Date().toISOString() }
          : e,
      ),
    );
  }

  function deleteEntry(id: string) {
    const next = entries.filter((e) => e.id !== id);
    onChangeEntries(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  function insertCodeChip(kind: 'evidence' | 'suspect', code: string) {
    if (!activeEntry) return;
    const nextContent = `${activeEntry.content}${activeEntry.content ? ' ' : ''}[${code}]`;
    if (kind === 'evidence') {
      updateActive({
        content: nextContent,
        linkedEvidenceCodes: Array.from(new Set([...activeEntry.linkedEvidenceCodes, code])),
      });
    } else {
      updateActive({
        content: nextContent,
        linkedSuspectCodes: Array.from(new Set([...activeEntry.linkedSuspectCodes, code])),
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#222937] bg-[#10141c] p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c88a2e]">
            ENCRYPTED PERSONAL FIELD LOG
          </div>
          <h1 className="text-lg font-semibold text-[#e8ecf2]">Investigator Notebook</h1>
        </div>
        <button
          type="button"
          onClick={createEntry}
          className="inline-flex items-center gap-1.5 rounded bg-[#9e1b24] hover:bg-[#b5222c] px-3.5 py-2 font-mono text-xs font-semibold text-white cursor-pointer"
        >
          <Plus className="w-4 h-4" /> NEW CASE NOTE
        </button>
      </div>

      <div className="grid xl:grid-cols-12 gap-4 items-start">
        {/* Note List */}
        <div className="xl:col-span-4 rounded-lg border border-[#222937] bg-[#0e1118] p-3 space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#667389] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes or tags..."
              className="w-full rounded border border-[#283143] bg-[#090b10] pl-8 pr-3 py-1.5 font-mono text-xs text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <BookOpen className="w-6 h-6 text-[#667389] mx-auto" />
              <div className="font-mono text-xs text-[#7f8ca1]">
                No investigator notes yet. Click “New Case Note” to begin.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {filtered.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full text-left rounded border p-3 transition cursor-pointer ${
                    activeEntry?.id === entry.id
                      ? 'border-[#c88a2e] bg-[#161c28]'
                      : 'border-[#202736] bg-[#11151e] hover:border-[#323d52]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#e8ecf2] truncate">
                      {entry.title || 'Untitled Note'}
                    </span>
                    {entry.pinned && <Pin className="w-3 h-3 text-[#e3a74c] shrink-0" />}
                  </div>
                  <p className="text-[11px] text-[#8894a8] line-clamp-2 mt-1">
                    {entry.content || 'Empty note...'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.tags.map((t) => (
                      <span
                        key={t}
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#1b2230] text-[#9aa5b8]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active Note Editor */}
        <div className="xl:col-span-8 rounded-lg border border-[#232b3a] bg-[#0e1118] p-5 space-y-4">
          {!activeEntry ? (
            <div className="py-20 text-center font-mono text-xs text-[#7f8ca1]">
              Select a note or create a new entry to record case hypotheses.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222937] pb-3">
                <input
                  type="text"
                  value={activeEntry.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  className="flex-1 min-w-[200px] bg-transparent text-lg font-semibold text-[#e8ecf2] focus:outline-none"
                  placeholder="Note Title..."
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateActive({ pinned: !activeEntry.pinned })}
                    className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 font-mono text-[11px] cursor-pointer ${
                      activeEntry.pinned
                        ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                        : 'border-[#293245] bg-[#141821] text-[#9aa5b8]'
                    }`}
                  >
                    <Pin className="w-3 h-3" /> {activeEntry.pinned ? 'PINNED' : 'PIN'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEntry(activeEntry.id)}
                    className="rounded border border-[#293245] hover:border-[#9e1b24] bg-[#141821] p-1.5 text-[#9aa5b8] hover:text-[#f87171] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <textarea
                rows={11}
                value={activeEntry.content}
                onChange={(e) => updateActive({ content: e.target.value })}
                placeholder="Write deductions, timeline contradictions, motive chains, and codes discovered across the archive..."
                className="w-full rounded border border-[#262f40] bg-[#090b10] p-4 text-sm text-[#e1e6ef] leading-relaxed focus:border-[#c88a2e] focus:outline-none font-sans"
              />

              {/* Quick Cross-Reference Inserter */}
              <div className="rounded border border-[#212836] bg-[#121620] p-3.5 space-y-2.5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#7f8ca1]">
                  QUICK-LINK EXHIBITS &amp; SUBJECTS INTO THIS NOTE
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allEvidence.slice(0, 12).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => insertCodeChip('evidence', ev.evidenceCode)}
                      className="font-mono text-[10px] px-2 py-0.5 rounded border border-[#2a3345] bg-[#171d29] hover:border-[#c88a2e] text-[#cbd5e1] cursor-pointer"
                    >
                      + {ev.evidenceCode}
                    </button>
                  ))}
                  {suspects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => insertCodeChip('suspect', s.suspectCode)}
                      className="font-mono text-[10px] px-2 py-0.5 rounded border border-[#9e1b24]/50 bg-[#1c1317] hover:border-[#dc2626] text-[#fca5a5] cursor-pointer"
                    >
                      + {s.suspectCode}
                    </button>
                  ))}
                </div>

                {(activeEntry.linkedEvidenceCodes.length > 0 ||
                  activeEntry.linkedSuspectCodes.length > 0) && (
                  <div className="pt-2 border-t border-[#1e2533] flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-[#e3a74c]">JUMP TO LINKED:</span>
                    {activeEntry.linkedEvidenceCodes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onOpenEvidenceByCode(code)}
                        className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#c88a2e]/20 border border-[#c88a2e]/60 text-[#e3a74c] cursor-pointer"
                      >
                        {code} →
                      </button>
                    ))}
                    {activeEntry.linkedSuspectCodes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => onOpenSuspectByCode(code)}
                        className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#9e1b24]/25 border border-[#9e1b24] text-[#fca5a5] cursor-pointer"
                      >
                        {code} →
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-[#7f8ca1]" />
                {activeEntry.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-[#161c28] border border-[#2a3345] text-[#cbd5e1]"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() =>
                        updateActive({ tags: activeEntry.tags.filter((x) => x !== t) })
                      }
                      className="text-[#667389] hover:text-[#f87171] cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      updateActive({
                        tags: Array.from(new Set([...activeEntry.tags, tagInput.trim().toLowerCase()])),
                      });
                      setTagInput('');
                    }
                  }}
                  placeholder="+ Add tag (Enter)"
                  className="bg-transparent border-b border-[#2c3547] font-mono text-xs text-[#e8ecf2] px-1 py-0.5 focus:border-[#c88a2e] focus:outline-none w-32"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
