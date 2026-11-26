'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Copy,
  Eye,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Archive,
  Rocket,
  Lock,
  Trash2,
  Save,
  ArrowLeft,
  FlaskConical,
  Users,
  FileSearch,
  CalendarClock,
  Sliders,
  KeyRound,
  Activity,
} from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import type { ClientUser } from '@/lib/client-types';
import {
  DEFAULT_SCORING_CONFIG,
  EVIDENCE_SECTIONS,
  VIEWER_TYPES,
  type CaseValidationReport,
  type ScoringConfig,
} from '@/lib/types';
import AdminSessionsAuditTab from './AdminSessionsAuditTab';

interface AdminCaseSummary {
  id: string;
  caseNumber: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  difficulty: 'standard' | 'advanced' | 'expert';
  suspectCount: number;
  evidenceCount: number;
  sessionCount: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AdminCaseDetail {
  case: any;
  suspects: any[];
  suspectRelationships: any[];
  evidence: any[];
  assets: any[];
  evidenceRelations: any[];
  timelineEvents: any[];
  solution: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type AdminTab =
  | 'config'
  | 'suspects'
  | 'evidence'
  | 'timeline'
  | 'solution'
  | 'validate'
  | 'sessions';

export default function AdminCmsWorkspace({ adminUser }: { adminUser: ClientUser }) {
  const [cases, setCases] = useState<AdminCaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [detail, setDetail] = useState<AdminCaseDetail | null>(null);
  const [tab, setTab] = useState<AdminTab>('config');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Create Case Modal
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCaseNum, setNewCaseNum] = useState('');
  const [newVictim, setNewVictim] = useState('');
  const [newLocation, setNewLocation] = useState('');

  // Editable Case Config
  const [cfg, setCfg] = useState({
    title: '',
    caseNumber: '',
    subtitle: '',
    classification: '',
    difficulty: 'standard' as 'standard' | 'advanced' | 'expert',
    priceCents: 1999,
    summary: '',
    briefingMarkdown: '',
    incidentLocation: '',
    incidentDate: '',
    victimName: '',
    victimSummary: '',
    defaultDurationSeconds: 14400,
    expiryPolicy: 'allow_late_penalty' as 'lock_and_auto_submit' | 'allow_late_penalty' | 'hard_lock',
    latePenaltyPercent: 15,
    maxAccusationAttempts: 1,
    scoringConfig: DEFAULT_SCORING_CONFIG as ScoringConfig,
  });

  // New Suspect quick form
  const [susForm, setSusForm] = useState({
    suspectCode: 'SUS-05',
    fullName: '',
    roleType: 'suspect',
    occupation: '',
    relationshipToVictim: '',
    motiveSummary: '',
    alibiSummary: '',
    alibiTimeWindow: '',
    alibiVerified: false,
  });

  // New Suspect Relationship form
  const [srelForm, setSrelForm] = useState({
    sourceSuspectId: '',
    targetSuspectId: '',
    relationshipLabel: '',
    relationshipType: 'conflict',
    notes: '',
  });

  // New Evidence form
  const [evForm, setEvForm] = useState({
    evidenceCode: '',
    title: '',
    summary: '',
    section: 'documents',
    viewerType: 'transcript',
    classification: 'CONFIDENTIAL',
    locked: false,
    passcode: '',
    hint: '',
    bodyText: '',
  });

  // Bulk Upload state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkSection, setBulkSection] = useState('documents');
  const [bulkClassification, setBulkClassification] = useState('CONFIDENTIAL');
  const [bulkTags, setBulkTags] = useState('bulk-ingest');

  // Evidence relation form
  const [erelForm, setErelForm] = useState({
    sourceEvidenceId: '',
    targetEvidenceId: '',
    relationType: 'corroborates',
    label: '',
  });

  // Timeline event form
  const [tlForm, setTlForm] = useState({
    eventCode: 'TL-07',
    title: '',
    displayTime: '',
    location: '',
    description: '',
    isAnchor: false,
    sortOrder: 10,
  });

  // Confidential Solution form
  const [solForm, setSolForm] = useState({
    killerSuspectId: '',
    motiveKeywordsCsv: '',
    motiveCanonical: '',
    methodKeywordsCsv: '',
    methodCanonical: '',
    requiredEvidenceIds: [] as string[],
    bonusEvidenceIds: [] as string[],
    solutionNarrative: '',
  });

  // Validation report
  const [validationReport, setValidationReport] = useState<CaseValidationReport | null>(null);

  const loadCasesList = useCallback(async () => {
    const res = await fetch('/api/admin/cases', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const list = data.cases ?? [];
      setCases(list);
      setSelectedCaseId((prev) => prev || list[0]?.id || '');
    }
  }, []);

  const loadCaseDetail = useCallback(async (caseId: string) => {
    if (!caseId) return;
    const res = await fetch(`/api/admin/cases/${caseId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data: AdminCaseDetail = await res.json();
    setDetail(data);
    setValidationReport(null);

    const c = data.case;
    setCfg({
      title: c.title || '',
      caseNumber: c.caseNumber || '',
      subtitle: c.subtitle || '',
      classification: c.classification || '',
      difficulty: c.difficulty || 'standard',
      priceCents: c.priceCents ?? 1999,
      summary: c.summary || '',
      briefingMarkdown: c.briefingMarkdown || '',
      incidentLocation: c.incidentLocation || '',
      incidentDate: c.incidentDate || '',
      victimName: c.victimName || '',
      victimSummary: c.victimSummary || '',
      defaultDurationSeconds: c.defaultDurationSeconds ?? 14400,
      expiryPolicy: c.expiryPolicy || 'allow_late_penalty',
      latePenaltyPercent: c.latePenaltyPercent ?? 15,
      maxAccusationAttempts: c.maxAccusationAttempts ?? 1,
      scoringConfig: c.scoringConfig ?? DEFAULT_SCORING_CONFIG,
    });

    const sol = data.solution;
    setSolForm({
      killerSuspectId: sol?.killerSuspectId || '',
      motiveKeywordsCsv: (sol?.motiveKeywords ?? []).join(', '),
      motiveCanonical: sol?.motiveCanonical || '',
      methodKeywordsCsv: (sol?.methodKeywords ?? []).join(', '),
      methodCanonical: sol?.methodCanonical || '',
      requiredEvidenceIds: sol?.requiredEvidenceIds ?? [],
      bonusEvidenceIds: sol?.bonusEvidenceIds ?? [],
      solutionNarrative: sol?.solutionNarrative || '',
    });

    setSusForm((f) => ({ ...f, suspectCode: `SUS-0${data.suspects.length + 1}` }));
    setEvForm((f) => ({
      ...f,
      evidenceCode: `EV-${String(data.evidence.length + 1).padStart(3, '0')}`,
    }));
    setTlForm((f) => ({
      ...f,
      eventCode: `TL-0${data.timelineEvents.length + 1}`,
      sortOrder: data.timelineEvents.length + 1,
    }));
  }, []);

  useEffect(() => {
    void loadCasesList();
  }, [loadCasesList]);

  useEffect(() => {
    if (selectedCaseId) {
      void loadCaseDetail(selectedCaseId);
    }
  }, [selectedCaseId, loadCaseDetail]);

  async function handleCreateCase(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/admin/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          caseNumber: newCaseNum || undefined,
          victimName: newVictim || 'Unidentified Victim',
          incidentLocation: newLocation || 'Undisclosed Location',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data.error || 'Failed to create case.' });
        return;
      }
      setCreatingOpen(false);
      setNewTitle('');
      setNewCaseNum('');
      setNewVictim('');
      setNewLocation('');
      await loadCasesList();
      setSelectedCaseId(data.case.id);
      setBanner({ kind: 'ok', text: `Created draft case "${data.case.title}" (${data.case.caseNumber}).` });
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicateCase() {
    if (!selectedCaseId) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/cases/${selectedCaseId}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data.error || 'Duplication failed.' });
        return;
      }
      await loadCasesList();
      setSelectedCaseId(data.case.id);
      setBanner({
        kind: 'ok',
        text: `Deep-cloned case, suspects, evidence, private assets, and solution into "${data.case.title}".`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveConfig(nextStatus?: 'draft' | 'published' | 'archived') {
    if (!selectedCaseId) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/cases/${selectedCaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cfg,
          status: nextStatus ?? detail?.case.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.validation) {
          setValidationReport(data.validation);
          setTab('validate');
        }
        setBanner({ kind: 'err', text: data.error || 'Failed to save configuration.' });
        return;
      }
      await loadCasesList();
      await loadCaseDetail(selectedCaseId);
      setBanner({
        kind: 'ok',
        text: nextStatus
          ? `Case lifecycle transitioned to ${nextStatus.toUpperCase()}.`
          : 'Case configuration & scoring weights saved.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleAddSuspect(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cases/${selectedCaseId}/suspects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(susForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data.error });
        return;
      }
      setSusForm((f) => ({ ...f, fullName: '', occupation: '', relationshipToVictim: '', motiveSummary: '', alibiSummary: '' }));
      await loadCaseDetail(selectedCaseId);
      await loadCasesList();
      setBanner({ kind: 'ok', text: `Added profile ${data.suspect.suspectCode} (${data.suspect.fullName}).` });
    } finally {
      setBusy(false);
    }
  }

  async function handleAddSuspectRel(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId || !srelForm.sourceSuspectId || !srelForm.targetSuspectId) return;
    await fetch(`/api/admin/cases/${selectedCaseId}/suspects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_relationship', ...srelForm }),
    });
    setSrelForm((f) => ({ ...f, relationshipLabel: '', notes: '' }));
    await loadCaseDetail(selectedCaseId);
    setBanner({ kind: 'ok', text: 'Saved suspect relationship.' });
  }

  async function handleAddEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId) return;
    setBusy(true);
    try {
      const structuredContent =
        evForm.viewerType === 'transcript'
          ? {
              transcriptLines: evForm.bodyText
                .split('\n')
                .filter(Boolean)
                .map((line, i) => ({
                  id: `l-${i}`,
                  timestamp: `00:0${i}:00`,
                  speaker: 'RECORD',
                  text: line,
                })),
            }
          : evForm.viewerType === 'pdf'
            ? {
                documentPages: [
                  { pageNumber: 1, heading: evForm.title, body: evForm.bodyText || evForm.summary },
                ],
              }
            : evForm.viewerType === 'metadata'
              ? {
                  metadataSections: [
                    {
                      section: 'Forensic Metadata Record',
                      entries: [{ key: 'Summary', value: evForm.bodyText || evForm.summary, anomaly: true }],
                    },
                  ],
                }
              : {};

      const res = await fetch(`/api/admin/cases/${selectedCaseId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceCode: evForm.evidenceCode,
          title: evForm.title,
          summary: evForm.summary,
          description: evForm.bodyText || evForm.summary,
          section: evForm.section,
          viewerType: evForm.viewerType,
          classification: evForm.classification,
          structuredContent,
          isHiddenClue: evForm.locked,
          hiddenClueHint: evForm.hint,
          accessRules: evForm.locked
            ? {
                locked: true,
                unlockType: 'passcode',
                passcode: evForm.passcode,
                hint: evForm.hint,
                lockReason: 'ENCRYPTED EXHIBIT — ENTER PASSCODE',
              }
            : { locked: false },
          tags: [evForm.section, evForm.viewerType],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data.error });
        return;
      }
      setEvForm((f) => ({ ...f, title: '', summary: '', bodyText: '', passcode: '', hint: '', locked: false }));
      await loadCaseDetail(selectedCaseId);
      await loadCasesList();
      setBanner({ kind: 'ok', text: `Created evidence exhibit ${data.evidence.evidenceCode}.` });
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId || bulkFiles.length === 0) return;
    setBusy(true);
    setBanner(null);
    try {
      const fd = new FormData();
      bulkFiles.forEach((file) => fd.append('files', file));
      fd.append('section', bulkSection);
      fd.append('classification', bulkClassification);
      fd.append('tags', bulkTags);

      const res = await fetch(`/api/admin/cases/${selectedCaseId}/evidence/bulk`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data.error || 'Bulk upload failed.' });
        return;
      }
      setBulkFiles([]);
      await loadCaseDetail(selectedCaseId);
      await loadCasesList();
      setBanner({
        kind: 'ok',
        text: `Bulk-ingested ${data.created.length} file(s) into private object storage with SHA-256 verification.`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleAddEvidenceRel(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId || !erelForm.sourceEvidenceId || !erelForm.targetEvidenceId) return;
    await fetch(`/api/admin/cases/${selectedCaseId}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert_relation', ...erelForm }),
    });
    setErelForm((f) => ({ ...f, label: '' }));
    await loadCaseDetail(selectedCaseId);
    setBanner({ kind: 'ok', text: 'Evidence relationship linked.' });
  }

  async function handleAddTimeline(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId) return;
    const res = await fetch(`/api/admin/cases/${selectedCaseId}/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tlForm),
    });
    if (res.ok) {
      setTlForm((f) => ({ ...f, title: '', displayTime: '', location: '', description: '' }));
      await loadCaseDetail(selectedCaseId);
      setBanner({ kind: 'ok', text: 'Added timeline event.' });
    }
  }

  async function handleSaveSolution(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId || !detail) return;
    setBusy(true);
    try {
      const canonicalTimelineOrder = detail.timelineEvents.map((t, idx) => ({
        eventId: t.id,
        expectedOrder: idx + 1,
        weight: t.isAnchor ? 1 : 2,
      }));
      const res = await fetch(`/api/admin/cases/${selectedCaseId}/solution`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          killerSuspectId: solForm.killerSuspectId || null,
          motiveKeywords: solForm.motiveKeywordsCsv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          motiveCanonical: solForm.motiveCanonical,
          methodKeywords: solForm.methodKeywordsCsv
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          methodCanonical: solForm.methodCanonical,
          requiredEvidenceIds: solForm.requiredEvidenceIds,
          bonusEvidenceIds: solForm.bonusEvidenceIds,
          canonicalTimelineOrder,
          solutionNarrative: solForm.solutionNarrative,
        }),
      });
      if (res.ok) {
        await loadCaseDetail(selectedCaseId);
        setBanner({ kind: 'ok', text: 'Confidential answer key updated and audit-logged.' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRunValidation() {
    if (!selectedCaseId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/cases/${selectedCaseId}/validate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setValidationReport(data.report);
        setTab('validate');
      }
    } finally {
      setBusy(false);
    }
  }

  const weightSum =
    cfg.scoringConfig.weights.killer +
    cfg.scoringConfig.weights.motive +
    cfg.scoringConfig.weights.method +
    cfg.scoringConfig.weights.timeline +
    cfg.scoringConfig.weights.evidence;

  return (
    <div className="min-h-screen bg-[#07080b] text-[#e8ecf2] flex flex-col">
      {/* Top CMS Bar */}
      <header className="h-14 border-b border-[#212836] bg-[#0b0e14] px-5 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded border border-[#2a3345] bg-[#131722] hover:border-[#c88a2e] px-2.5 py-1.5 font-mono text-[11px] text-[#cbd5e1]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> DIRECTORY
          </Link>
          <BrandLogo variant="wordmark" size="sm" subtitle="ADMINISTRATOR CMS" />
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="hidden sm:inline text-[#7f8ca1]">
            {adminUser.displayName} ({adminUser.badgeNumber})
          </span>
          <button
            type="button"
            onClick={() => setCreatingOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-[#9e1b24] hover:bg-[#b8202b] px-3 py-1.5 font-mono text-xs font-semibold text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> NEW CASE
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Case Selector Sidebar */}
        <aside className="lg:w-72 border-b lg:border-b-0 lg:border-r border-[#212836] bg-[#0b0e14] p-3.5 space-y-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#728096] px-1">
            CONFIGURABLE CASES ({cases.length})
          </div>

          <div className="space-y-1.5">
            {cases.map((c) => {
              const active = c.id === selectedCaseId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`w-full text-left rounded-lg border p-3 transition cursor-pointer ${
                    active
                      ? 'border-[#c88a2e] bg-[#161c28]'
                      : 'border-[#202736] bg-[#10141c] hover:border-[#323d52]'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-[#e3a74c] font-bold">{c.caseNumber}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded uppercase ${
                        c.status === 'published'
                          ? 'bg-[#2e7d5b]/25 text-[#86efac]'
                          : c.status === 'archived'
                            ? 'bg-[#273042] text-[#94a3b8]'
                            : 'bg-[#c88a2e]/20 text-[#e3a74c]'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#e8ecf2] mt-1 truncate">{c.title}</div>
                  <div className="font-mono text-[10px] text-[#728096] mt-1">
                    {c.suspectCount} profiles · {c.evidenceCount} exhibits · {c.sessionCount} sessions
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main CMS Editor Pane */}
        <main className="flex-1 min-w-0 p-5 space-y-5 overflow-y-auto">
          {banner && (
            <div
              className={`rounded border px-4 py-2.5 font-mono text-xs flex items-center justify-between ${
                banner.kind === 'ok'
                  ? 'border-[#2e7d5b] bg-[#2e7d5b]/15 text-[#86efac]'
                  : 'border-[#dc2626] bg-[#9e1b24]/20 text-[#fca5a5]'
              }`}
            >
              <span>{banner.text}</span>
              <button type="button" onClick={() => setBanner(null)} className="cursor-pointer">
                ×
              </button>
            </div>
          )}

          {detail && (
            <>
              {/* Case Action Toolbar */}
              <div className="rounded-lg border border-[#242c3b] bg-[#10141c] p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] text-[#c88a2e] uppercase">
                    EDITING CASE // {detail.case.caseNumber} ({detail.case.status.toUpperCase()})
                  </div>
                  <h1 className="text-xl font-semibold text-[#e8ecf2]">{detail.case.title}</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/cases/${detail.case.id}`}
                    className="inline-flex items-center gap-1.5 rounded border border-[#3b82a6] bg-[#3b82a6]/15 hover:bg-[#3b82a6]/25 px-3 py-1.5 font-mono text-xs text-[#7dd3fc]"
                  >
                    <Eye className="w-3.5 h-3.5" /> PREVIEW CASE
                  </Link>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleDuplicateCase}
                    className="inline-flex items-center gap-1.5 rounded border border-[#2a3345] bg-[#151a24] hover:border-[#c88a2e] px-3 py-1.5 font-mono text-xs text-[#cbd5e1] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> DUPLICATE
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRunValidation}
                    className="inline-flex items-center gap-1.5 rounded border border-[#c88a2e]/60 bg-[#c88a2e]/15 hover:bg-[#c88a2e]/25 px-3 py-1.5 font-mono text-xs text-[#e3a74c] cursor-pointer"
                  >
                    <FlaskConical className="w-3.5 h-3.5" /> VALIDATE
                  </button>

                  {detail.case.status !== 'published' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveConfig('published')}
                      className="inline-flex items-center gap-1.5 rounded bg-[#2e7d5b] hover:bg-[#38946c] px-3.5 py-1.5 font-mono text-xs font-semibold text-white cursor-pointer"
                    >
                      <Rocket className="w-3.5 h-3.5" /> PUBLISH CASE
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveConfig('archived')}
                      className="inline-flex items-center gap-1.5 rounded border border-[#475569] bg-[#1b2230] hover:bg-[#273145] px-3 py-1.5 font-mono text-xs text-[#cbd5e1] cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" /> ARCHIVE
                    </button>
                  )}
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-[#222937] pb-2 font-mono text-xs">
                {(
                  [
                    ['config', 'Config & Scoring', Sliders],
                    ['suspects', `Suspects (${detail.suspects.length})`, Users],
                    ['evidence', `Evidence & Bulk Upload (${detail.evidence.length})`, FileSearch],
                    ['timeline', `Timeline (${detail.timelineEvents.length})`, CalendarClock],
                    ['solution', 'Confidential Solution', KeyRound],
                    ['validate', 'Validation Tests', FlaskConical],
                    ['sessions', 'Sessions, Extensions & Audit', Activity],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-2 transition cursor-pointer ${
                      tab === id
                        ? id === 'solution'
                          ? 'bg-[#9e1b24] text-white font-semibold'
                          : 'bg-[#1a2130] text-[#e3a74c] border border-[#c88a2e]/50 font-semibold'
                        : 'text-[#8d99ad] hover:bg-[#121620] hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>

              {/* TAB 1: CASE CONFIG & SCORING */}
              {tab === 'config' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 grid md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">CASE TITLE</label>
                      <input
                        value={cfg.title}
                        onChange={(e) => setCfg({ ...cfg, title: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">CASE NUMBER</label>
                      <input
                        value={cfg.caseNumber}
                        onChange={(e) => setCfg({ ...cfg, caseNumber: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">SUBTITLE</label>
                      <input
                        value={cfg.subtitle}
                        onChange={(e) => setCfg({ ...cfg, subtitle: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">CLASSIFICATION STAMP</label>
                      <input
                        value={cfg.classification}
                        onChange={(e) => setCfg({ ...cfg, classification: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">VICTIM NAME</label>
                      <input
                        value={cfg.victimName}
                        onChange={(e) => setCfg({ ...cfg, victimName: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">INCIDENT LOCATION</label>
                      <input
                        value={cfg.incidentLocation}
                        onChange={(e) => setCfg({ ...cfg, incidentLocation: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">EXECUTIVE SUMMARY</label>
                      <textarea
                        rows={2}
                        value={cfg.summary}
                        onChange={(e) => setCfg({ ...cfg, summary: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] p-3 text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">OPERATIONAL BRIEFING (MARKDOWN)</label>
                      <textarea
                        rows={5}
                        value={cfg.briefingMarkdown}
                        onChange={(e) => setCfg({ ...cfg, briefingMarkdown: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] p-3 font-mono text-white"
                      />
                    </div>
                  </div>

                  {/* Timer & Scoring Configuration */}
                  <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-4 text-xs">
                    <div className="font-mono text-xs uppercase text-[#e3a74c] font-semibold">
                      TIMER POLICY &amp; SERVER SCORING WEIGHTS (TOTAL: {weightSum}/100)
                    </div>
                    <div className="grid sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">DURATION (SECONDS)</label>
                        <input
                          type="number"
                          value={cfg.defaultDurationSeconds}
                          onChange={(e) => setCfg({ ...cfg, defaultDurationSeconds: Number(e.target.value) })}
                          className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">EXPIRY POLICY</label>
                        <select
                          value={cfg.expiryPolicy}
                          onChange={(e) =>
                            setCfg({ ...cfg, expiryPolicy: e.target.value as typeof cfg.expiryPolicy })
                          }
                          className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                        >
                          <option value="allow_late_penalty">Allow Late (Penalty)</option>
                          <option value="hard_lock">Hard Lock on Expiry</option>
                          <option value="lock_and_auto_submit">Lock &amp; Auto-Submit</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">LATE PENALTY %</label>
                        <input
                          type="number"
                          value={cfg.latePenaltyPercent}
                          onChange={(e) => setCfg({ ...cfg, latePenaltyPercent: Number(e.target.value) })}
                          className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">PRICE (CENTS)</label>
                        <input
                          type="number"
                          value={cfg.priceCents}
                          onChange={(e) => setCfg({ ...cfg, priceCents: Number(e.target.value) })}
                          className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {(['killer', 'motive', 'method', 'timeline', 'evidence'] as const).map((k) => (
                        <div key={k}>
                          <label className="block font-mono text-[10px] uppercase text-[#8b98ae] mb-1">
                            {k} WT
                          </label>
                          <input
                            type="number"
                            value={cfg.scoringConfig.weights[k]}
                            onChange={(e) =>
                              setCfg({
                                ...cfg,
                                scoringConfig: {
                                  ...cfg.scoringConfig,
                                  weights: {
                                    ...cfg.scoringConfig.weights,
                                    [k]: Number(e.target.value),
                                  },
                                },
                              })
                            }
                            className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveConfig()}
                        className="inline-flex items-center gap-2 rounded bg-[#9e1b24] hover:bg-[#b8202b] px-5 py-2 font-mono text-xs font-bold text-white cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> SAVE CONFIGURATION
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SUSPECTS & RELATIONSHIPS */}
              {tab === 'suspects' && (
                <div className="grid lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-6 space-y-4">
                    <form
                      onSubmit={handleAddSuspect}
                      className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-4 space-y-3 text-xs"
                    >
                      <div className="font-mono text-xs uppercase text-[#e3a74c] font-semibold">
                        ADD SUSPECT OR WITNESS PROFILE
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <input
                          required
                          placeholder="Code (e.g. SUS-05)"
                          value={susForm.suspectCode}
                          onChange={(e) => setSusForm({ ...susForm, suspectCode: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                        />
                        <select
                          value={susForm.roleType}
                          onChange={(e) => setSusForm({ ...susForm, roleType: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                        >
                          <option value="suspect">Suspect</option>
                          <option value="witness">Witness</option>
                          <option value="victim_associate">Associate</option>
                        </select>
                        <input
                          required
                          placeholder="Full Name"
                          value={susForm.fullName}
                          onChange={(e) => setSusForm({ ...susForm, fullName: e.target.value })}
                          className="col-span-2 rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                        />
                        <input
                          placeholder="Occupation"
                          value={susForm.occupation}
                          onChange={(e) => setSusForm({ ...susForm, occupation: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                        />
                        <input
                          placeholder="Relationship to Victim"
                          value={susForm.relationshipToVictim}
                          onChange={(e) => setSusForm({ ...susForm, relationshipToVictim: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                        />
                        <textarea
                          rows={2}
                          placeholder="Potential Motive (Never spoil solution!)"
                          value={susForm.motiveSummary}
                          onChange={(e) => setSusForm({ ...susForm, motiveSummary: e.target.value })}
                          className="col-span-2 rounded border border-[#2a3345] bg-[#090b10] p-2.5 text-white"
                        />
                        <textarea
                          rows={2}
                          placeholder="Stated Alibi"
                          value={susForm.alibiSummary}
                          onChange={(e) => setSusForm({ ...susForm, alibiSummary: e.target.value })}
                          className="col-span-2 rounded border border-[#2a3345] bg-[#090b10] p-2.5 text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full rounded bg-[#9e1b24] hover:bg-[#b8202b] py-2 font-mono text-xs font-bold text-white cursor-pointer"
                      >
                        + CREATE PROFILE (AUTO-GENERATES BIOMETRIC PORTRAIT)
                      </button>
                    </form>

                    {/* Suspect Relationship Linker */}
                    <form
                      onSubmit={handleAddSuspectRel}
                      className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-4 space-y-2.5 text-xs"
                    >
                      <div className="font-mono text-xs uppercase text-[#e3a74c] font-semibold">
                        LINK SUSPECT RELATIONSHIP
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={srelForm.sourceSuspectId}
                          onChange={(e) => setSrelForm({ ...srelForm, sourceSuspectId: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-2 py-1.5 font-mono text-white"
                        >
                          <option value="">Source Subject...</option>
                          {detail.suspects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.suspectCode} {s.fullName}
                            </option>
                          ))}
                        </select>
                        <select
                          value={srelForm.targetSuspectId}
                          onChange={(e) => setSrelForm({ ...srelForm, targetSuspectId: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-2 py-1.5 font-mono text-white"
                        >
                          <option value="">Target Subject...</option>
                          {detail.suspects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.suspectCode} {s.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="Relationship label"
                          value={srelForm.relationshipLabel}
                          onChange={(e) => setSrelForm({ ...srelForm, relationshipLabel: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 text-white"
                        />
                        <select
                          value={srelForm.relationshipType}
                          onChange={(e) => setSrelForm({ ...srelForm, relationshipType: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-2 py-1.5 font-mono text-white"
                        >
                          <option value="conflict">Conflict</option>
                          <option value="secret">Secret</option>
                          <option value="financial">Financial</option>
                          <option value="family">Family</option>
                          <option value="professional">Professional</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="rounded border border-[#c88a2e]/60 bg-[#c88a2e]/15 px-3 py-1.5 font-mono text-xs text-[#e3a74c] cursor-pointer"
                      >
                        + ADD RELATIONSHIP EDGE
                      </button>
                    </form>
                  </div>

                  {/* Existing Suspects List */}
                  <div className="lg:col-span-6 space-y-2.5">
                    {detail.suspects.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border border-[#222937] bg-[#0f131b] p-3.5 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="font-mono text-[10px] text-[#e3a74c]">
                            {s.suspectCode} · {s.roleType.toUpperCase()}
                          </div>
                          <div className="text-sm font-semibold text-[#e8ecf2]">{s.fullName}</div>
                          <div className="text-xs text-[#8b98ae]">{s.occupation}</div>
                          <div className="text-[11px] text-[#728096] mt-1">Alibi: {s.alibiSummary}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(
                              `/api/admin/cases/${selectedCaseId}/suspects?suspectId=${s.id}`,
                              { method: 'DELETE' },
                            );
                            await loadCaseDetail(selectedCaseId);
                            await loadCasesList();
                          }}
                          className="p-1.5 rounded border border-[#2a3345] hover:border-[#dc2626] text-[#8b98ae] hover:text-[#f87171] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: EVIDENCE, HIDDEN CLUES & BULK UPLOAD */}
              {tab === 'evidence' && (
                <div className="space-y-5">
                  <div className="grid lg:grid-cols-2 gap-5">
                    {/* Bulk Multi-File Uploader */}
                    <form
                      onSubmit={handleBulkUpload}
                      className="rounded-lg border border-[#c88a2e]/50 bg-[#14120e] p-5 space-y-3 text-xs"
                    >
                      <div className="font-mono text-xs uppercase text-[#e3a74c] font-semibold flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        BULK EVIDENCE UPLOADER (PRIVATE OBJECT STORAGE)
                      </div>
                      <p className="text-[11px] text-[#9aa5b8]">
                        Drop or select multiple PDF, PNG/JPG/SVG, WAV/MP3, MP4/WebM, CSV, or TXT
                        files. Automatically detects viewer type, computes SHA-256, and assigns
                        sequential evidence codes.
                      </p>

                      <input
                        type="file"
                        multiple
                        onChange={(e) => setBulkFiles(Array.from(e.target.files ?? []))}
                        className="w-full rounded border border-dashed border-[#c88a2e]/60 bg-[#090b10] p-4 font-mono text-xs text-[#cbd5e1] cursor-pointer"
                      />

                      {bulkFiles.length > 0 && (
                        <div className="font-mono text-[10px] text-[#86efac]">
                          READY TO UPLOAD: {bulkFiles.map((f) => f.name).join(', ')}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={bulkSection}
                          onChange={(e) => setBulkSection(e.target.value)}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-2.5 py-2 font-mono text-white"
                        >
                          {EVIDENCE_SECTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bulkClassification}
                          onChange={(e) => setBulkClassification(e.target.value)}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-2.5 py-2 font-mono text-white"
                        >
                          <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                          <option value="RESTRICTED">RESTRICTED</option>
                          <option value="FORENSIC_SEALED">FORENSIC SEALED</option>
                          <option value="CHAIN_OF_CUSTODY">CHAIN OF CUSTODY</option>
                          <option value="PUBLIC_RECORD">PUBLIC RECORD</option>
                        </select>
                      </div>

                      <input
                        value={bulkTags}
                        onChange={(e) => setBulkTags(e.target.value)}
                        placeholder="Comma-separated tags..."
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                      />

                      <button
                        type="submit"
                        disabled={busy || bulkFiles.length === 0}
                        className="w-full rounded bg-[#c88a2e] hover:bg-[#dfa03f] disabled:opacity-40 text-[#07080b] font-mono text-xs font-bold py-2 cursor-pointer"
                      >
                        UPLOAD {bulkFiles.length || ''} FILE(S) TO PRIVATE VAULT
                      </button>
                    </form>

                    {/* Manual Exhibit & Hidden Clue Creator */}
                    <form
                      onSubmit={handleAddEvidence}
                      className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-2.5 text-xs"
                    >
                      <div className="font-mono text-xs uppercase text-[#e3a74c] font-semibold">
                        CREATE EXHIBIT / CONFIGURE HIDDEN CLUE
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          required
                          placeholder="Code (EV-016)"
                          value={evForm.evidenceCode}
                          onChange={(e) => setEvForm({ ...evForm, evidenceCode: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 font-mono text-white"
                        />
                        <select
                          value={evForm.section}
                          onChange={(e) => setEvForm({ ...evForm, section: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-2 py-1.5 font-mono text-white"
                        >
                          {EVIDENCE_SECTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={evForm.viewerType}
                          onChange={(e) => setEvForm({ ...evForm, viewerType: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-2 py-1.5 font-mono text-white"
                        >
                          {VIEWER_TYPES.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                        <input
                          required
                          placeholder="Exhibit Title"
                          value={evForm.title}
                          onChange={(e) => setEvForm({ ...evForm, title: e.target.value })}
                          className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 text-white"
                        />
                      </div>
                      <input
                        placeholder="Short forensic summary"
                        value={evForm.summary}
                        onChange={(e) => setEvForm({ ...evForm, summary: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 text-white"
                      />
                      <textarea
                        rows={2}
                        placeholder="Exhibit transcript / document body / metadata record text..."
                        value={evForm.bodyText}
                        onChange={(e) => setEvForm({ ...evForm, bodyText: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] p-2 text-white"
                      />
                      <label className="inline-flex items-center gap-2 font-mono text-[11px] text-[#e3a74c]">
                        <input
                          type="checkbox"
                          checked={evForm.locked}
                          onChange={(e) => setEvForm({ ...evForm, locked: e.target.checked })}
                        />
                        LOCK AS HIDDEN CLUE (SERVER PASSCODE PROTECTED)
                      </label>
                      {evForm.locked && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            required
                            placeholder="Unlock Passcode (e.g. 9042)"
                            value={evForm.passcode}
                            onChange={(e) => setEvForm({ ...evForm, passcode: e.target.value })}
                            className="rounded border border-[#c88a2e] bg-[#090b10] px-3 py-1.5 font-mono text-white"
                          />
                          <input
                            placeholder="Clue Hint for Investigator"
                            value={evForm.hint}
                            onChange={(e) => setEvForm({ ...evForm, hint: e.target.value })}
                            className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 text-white"
                          />
                        </div>
                      )}
                      <button
                        type="submit"
                        className="w-full rounded bg-[#9e1b24] hover:bg-[#b8202b] py-2 font-mono text-xs font-bold text-white cursor-pointer"
                      >
                        + CREATE EVIDENCE EXHIBIT
                      </button>
                    </form>
                  </div>

                  {/* Evidence Relationships Creator */}
                  <form
                    onSubmit={handleAddEvidenceRel}
                    className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-4 grid sm:grid-cols-12 gap-2.5 items-center text-xs"
                  >
                    <select
                      value={erelForm.sourceEvidenceId}
                      onChange={(e) => setErelForm({ ...erelForm, sourceEvidenceId: e.target.value })}
                      className="sm:col-span-3 rounded border border-[#2a3345] bg-[#090b10] px-2 py-1.5 font-mono text-white"
                    >
                      <option value="">Source Exhibit...</option>
                      {detail.evidence.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.evidenceCode} — {e.title.slice(0, 26)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={erelForm.relationType}
                      onChange={(e) => setErelForm({ ...erelForm, relationType: e.target.value })}
                      className="sm:col-span-2 rounded border border-[#2a3345] bg-[#090b10] px-2 py-1.5 font-mono text-white"
                    >
                      <option value="corroborates">corroborates</option>
                      <option value="contradicts">contradicts</option>
                      <option value="links_to">links_to</option>
                      <option value="derived_from">derived_from</option>
                      <option value="timeline_adjacent">timeline_adjacent</option>
                    </select>
                    <select
                      value={erelForm.targetEvidenceId}
                      onChange={(e) => setErelForm({ ...erelForm, targetEvidenceId: e.target.value })}
                      className="sm:col-span-3 rounded border border-[#2a3345] bg-[#090b10] px-2 py-1.5 font-mono text-white"
                    >
                      <option value="">Target Exhibit...</option>
                      {detail.evidence.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.evidenceCode} — {e.title.slice(0, 26)}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Relation note..."
                      value={erelForm.label}
                      onChange={(e) => setErelForm({ ...erelForm, label: e.target.value })}
                      className="sm:col-span-2 rounded border border-[#2a3345] bg-[#090b10] px-2.5 py-1.5 text-white"
                    />
                    <button
                      type="submit"
                      className="sm:col-span-2 rounded border border-[#c88a2e] bg-[#c88a2e]/15 py-1.5 font-mono text-xs text-[#e3a74c] cursor-pointer"
                    >
                      + LINK EXHIBITS
                    </button>
                  </form>

                  {/* Existing Evidence Table */}
                  <div className="rounded-lg border border-[#222937] overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#141822] text-[#8b98ae] text-[10px] uppercase border-b border-[#252e3f]">
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Title</th>
                          <th className="px-3 py-2">Section</th>
                          <th className="px-3 py-2">Viewer</th>
                          <th className="px-3 py-2">Access</th>
                          <th className="px-3 py-2">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1d2432]">
                        {detail.evidence.map((ev) => (
                          <tr key={ev.id} className="bg-[#0c1017]">
                            <td className="px-3 py-2 text-[#e3a74c] font-bold">{ev.evidenceCode}</td>
                            <td className="px-3 py-2 font-sans text-[#e8ecf2]">{ev.title}</td>
                            <td className="px-3 py-2 text-[#9aa5b8]">{ev.section}</td>
                            <td className="px-3 py-2 uppercase">{ev.viewerType}</td>
                            <td className="px-3 py-2">
                              {ev.accessRules?.locked ? (
                                <span className="text-[#f87171] inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> PIN: {ev.accessRules.passcode}
                                </span>
                              ) : (
                                <span className="text-[#6ee7b7]">OPEN</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch(
                                    `/api/admin/cases/${selectedCaseId}/evidence?evidenceId=${ev.id}`,
                                    { method: 'DELETE' },
                                  );
                                  await loadCaseDetail(selectedCaseId);
                                  await loadCasesList();
                                }}
                                className="text-[#8b98ae] hover:text-[#f87171] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: TIMELINE BUILDER */}
              {tab === 'timeline' && (
                <div className="grid lg:grid-cols-12 gap-5">
                  <form
                    onSubmit={handleAddTimeline}
                    className="lg:col-span-5 rounded-lg border border-[#232b3a] bg-[#0f131b] p-4 space-y-2.5 text-xs h-fit"
                  >
                    <div className="font-mono text-xs uppercase text-[#e3a74c] font-semibold">
                      ADD TIMELINE EVENT
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Code (TL-07)"
                        value={tlForm.eventCode}
                        onChange={(e) => setTlForm({ ...tlForm, eventCode: e.target.value })}
                        className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 font-mono text-white"
                      />
                      <input
                        placeholder="Display Time (22:15 UTC)"
                        value={tlForm.displayTime}
                        onChange={(e) => setTlForm({ ...tlForm, displayTime: e.target.value })}
                        className="rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 font-mono text-white"
                      />
                    </div>
                    <input
                      required
                      placeholder="Event Title"
                      value={tlForm.title}
                      onChange={(e) => setTlForm({ ...tlForm, title: e.target.value })}
                      className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 text-white"
                    />
                    <input
                      placeholder="Location"
                      value={tlForm.location}
                      onChange={(e) => setTlForm({ ...tlForm, location: e.target.value })}
                      className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-1.5 text-white"
                    />
                    <textarea
                      rows={3}
                      placeholder="Description"
                      value={tlForm.description}
                      onChange={(e) => setTlForm({ ...tlForm, description: e.target.value })}
                      className="w-full rounded border border-[#2a3345] bg-[#090b10] p-2.5 text-white"
                    />
                    <label className="inline-flex items-center gap-2 font-mono text-[11px] text-[#e3a74c]">
                      <input
                        type="checkbox"
                        checked={tlForm.isAnchor}
                        onChange={(e) => setTlForm({ ...tlForm, isAnchor: e.target.checked })}
                      />
                      LOCKED CHRONOLOGICAL ANCHOR
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded bg-[#9e1b24] hover:bg-[#b8202b] py-2 font-mono text-xs font-bold text-white cursor-pointer"
                    >
                      + ADD TIMELINE EVENT
                    </button>
                  </form>

                  <div className="lg:col-span-7 space-y-2">
                    {detail.timelineEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded border border-[#222937] bg-[#0f131b] p-3.5 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="font-mono text-[10px] text-[#e3a74c]">
                            {ev.eventCode} · {ev.displayTime} {ev.isAnchor ? '· [ANCHOR]' : ''}
                          </div>
                          <div className="text-sm font-semibold text-[#e8ecf2]">{ev.title}</div>
                          <div className="text-xs text-[#8b98ae] mt-0.5">{ev.description}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(
                              `/api/admin/cases/${selectedCaseId}/timeline?eventId=${ev.id}`,
                              { method: 'DELETE' },
                            );
                            await loadCaseDetail(selectedCaseId);
                          }}
                          className="text-[#8b98ae] hover:text-[#f87171] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: CONFIDENTIAL ANSWER KEY VAULT */}
              {tab === 'solution' && (
                <form
                  onSubmit={handleSaveSolution}
                  className="rounded-lg border border-[#9e1b24]/70 bg-[#140e12] p-5 space-y-4 text-xs"
                >
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#fca5a5] font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#dc2626]" />
                    CONFIDENTIAL SOLUTION VAULT — STRICTLY ISOLATED FROM PLAYER APIS
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-[10px] text-[#fca5a5] mb-1">
                        TRUE PERPETRATOR (KILLER SUSPECT)
                      </label>
                      <select
                        value={solForm.killerSuspectId}
                        onChange={(e) => setSolForm({ ...solForm, killerSuspectId: e.target.value })}
                        className="w-full rounded border border-[#9e1b24]/70 bg-[#090b10] px-3 py-2 font-mono text-white"
                      >
                        <option value="">Select Killer Suspect...</option>
                        {detail.suspects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.suspectCode} — {s.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] text-[#fca5a5] mb-1">
                        MOTIVE SCORING KEYWORDS (COMMA SEPARATED; USE | FOR SYNONYMS)
                      </label>
                      <input
                        value={solForm.motiveKeywordsCsv}
                        onChange={(e) => setSolForm({ ...solForm, motiveKeywordsCsv: e.target.value })}
                        placeholder="fraud|falsified, clinical trial|fda, audit|expose"
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] text-[#fca5a5] mb-1">
                        METHOD SCORING KEYWORDS (COMMA SEPARATED; USE | FOR SYNONYMS)
                      </label>
                      <input
                        value={solForm.methodKeywordsCsv}
                        onChange={(e) => setSolForm({ ...solForm, methodKeywordsCsv: e.target.value })}
                        placeholder="aconitine|poison, wine|decanter, cloned|rfid"
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] text-[#fca5a5] mb-1">
                        CANONICAL MOTIVE SUMMARY
                      </label>
                      <input
                        value={solForm.motiveCanonical}
                        onChange={(e) => setSolForm({ ...solForm, motiveCanonical: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-mono text-[10px] text-[#fca5a5] mb-1">
                        CANONICAL METHOD SUMMARY
                      </label>
                      <input
                        value={solForm.methodCanonical}
                        onChange={(e) => setSolForm({ ...solForm, methodCanonical: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-mono text-[10px] text-[#fca5a5] mb-1.5">
                        REQUIRED DECISIVE EVIDENCE EXHIBITS ({solForm.requiredEvidenceIds.length} SELECTED)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.evidence.map((ev) => {
                          const active = solForm.requiredEvidenceIds.includes(ev.id);
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() =>
                                setSolForm({
                                  ...solForm,
                                  requiredEvidenceIds: active
                                    ? solForm.requiredEvidenceIds.filter((x) => x !== ev.id)
                                    : [...solForm.requiredEvidenceIds, ev.id],
                                })
                              }
                              className={`px-2.5 py-1 rounded border font-mono text-[10px] cursor-pointer ${
                                active
                                  ? 'border-[#dc2626] bg-[#9e1b24]/30 text-white'
                                  : 'border-[#2a3345] bg-[#090b10] text-[#9aa5b8]'
                              }`}
                            >
                              {ev.evidenceCode} · {ev.title.slice(0, 24)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-mono text-[10px] text-[#fca5a5] mb-1">
                        POST-SUBMISSION OFFICIAL SOLUTION NARRATIVE
                      </label>
                      <textarea
                        rows={4}
                        value={solForm.solutionNarrative}
                        onChange={(e) => setSolForm({ ...solForm, solutionNarrative: e.target.value })}
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] p-3 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded bg-[#9e1b24] hover:bg-[#b8202b] px-5 py-2.5 font-mono text-xs font-bold text-white cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> SEAL CONFIDENTIAL SOLUTION
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 6: AUTOMATED CASE VALIDATION SUITE */}
              {tab === 'validate' && (
                <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs uppercase text-[#e3a74c] font-semibold">
                        AUTOMATED PRE-PUBLISH VALIDATION ENGINE
                      </div>
                      <p className="text-xs text-[#9aa5b8]">
                        Verifies structural integrity, anti-spoiler guardrails, private storage
                        asset existence, hidden clue reachability, and server scoring rubrics.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleRunValidation}
                      className="inline-flex items-center gap-2 rounded bg-[#c88a2e] hover:bg-[#dfa03f] text-[#07080b] font-mono text-xs font-bold px-4 py-2 cursor-pointer"
                    >
                      <FlaskConical className="w-4 h-4" /> RUN VALIDATION SUITE
                    </button>
                  </div>

                  {validationReport && (
                    <div className="space-y-3">
                      <div
                        className={`rounded border p-4 font-mono text-xs flex flex-wrap items-center justify-between gap-2 ${
                          validationReport.validForPublish
                            ? 'border-[#2e7d5b] bg-[#2e7d5b]/15 text-[#86efac]'
                            : 'border-[#dc2626] bg-[#9e1b24]/20 text-[#fca5a5]'
                        }`}
                      >
                        <span className="font-bold">
                          {validationReport.validForPublish
                            ? 'READY FOR PUBLICATION — ALL MANDATORY CHECKS PASSED'
                            : `PUBLICATION BLOCKED — ${validationReport.failures} FAILURE(S)`}
                        </span>
                        <span>
                          PASS: {validationReport.passed} · WARN: {validationReport.warnings} · FAIL:{' '}
                          {validationReport.failures}
                        </span>
                      </div>

                      <div className="grid md:grid-cols-2 gap-2.5">
                        {validationReport.checks.map((chk) => (
                          <div
                            key={chk.id}
                            className={`rounded border p-3 text-xs ${
                              chk.status === 'pass'
                                ? 'border-[#203329] bg-[#0d1512]'
                                : chk.status === 'warn'
                                  ? 'border-[#c88a2e]/50 bg-[#17140d]'
                                  : 'border-[#9e1b24] bg-[#1a0e12]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                              <span className="font-semibold text-[#e8ecf2] flex items-center gap-1.5">
                                {chk.status === 'pass' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#6ee7b7]" />
                                ) : chk.status === 'warn' ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-[#e3a74c]" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-[#f87171]" />
                                )}
                                {chk.title}
                              </span>
                              <span className="text-[10px] uppercase text-[#7f8ca1]">
                                {chk.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#9aa5b8] mt-1 leading-snug">
                              {chk.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: SESSIONS, TIMER EXTENSIONS & AUDIT LOGS */}
              {tab === 'sessions' && <AdminSessionsAuditTab />}
            </>
          )}
        </main>
      </div>

      {/* Create New Case Modal */}
      {creatingOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCase}
            className="max-w-lg w-full rounded-lg border border-[#2f394e] bg-[#0f131b] p-6 space-y-4 text-xs"
          >
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#e3a74c] font-semibold">
              CREATE NEW MURDER MYSTERY CASE
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">CASE TITLE</label>
                <input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. The Glasshouse Observatory Murder"
                  className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">CASE CODE</label>
                  <input
                    value={newCaseNum}
                    onChange={(e) => setNewCaseNum(e.target.value)}
                    placeholder="CF-2026-109"
                    className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">VICTIM NAME</label>
                  <input
                    value={newVictim}
                    onChange={(e) => setNewVictim(e.target.value)}
                    placeholder="Prof. Adrian Bell"
                    className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#8b98ae] mb-1">INCIDENT LOCATION</label>
                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="North Ridge Observatory"
                  className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreatingOpen(false)}
                className="rounded border border-[#2a3345] px-4 py-2 font-mono text-xs text-[#9aa5b8] cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-[#9e1b24] hover:bg-[#b8202b] px-4 py-2 font-mono text-xs font-bold text-white cursor-pointer"
              >
                CREATE DRAFT CASE
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
