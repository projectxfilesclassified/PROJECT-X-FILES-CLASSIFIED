'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Columns2,
  Clock,
  Settings,
  Menu,
  X,
  PanelRightOpen,
  ArrowLeft,
  Save,
  CheckCircle2,
  FileText,
  Map,
  Users,
  MessageSquareQuote,
  Mic,
  FolderOpen,
  Video,
  Headphones,
  Package,
  FlaskConical,
  Cpu,
  Network,
  CalendarClock,
  BookOpen,
  Gavel,
  LayoutDashboard,
  Play,
  Lock,
} from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import {
  formatDurationHms,
  type ClientEvidence,
  type ClientSubmission,
  type ClientSuspect,
  type ClientUser,
  type DashboardPayload,
} from '@/lib/client-types';
import {
  NAV_SECTIONS,
  type AccusationDraft,
  type BoardState,
  type EvidenceAnnotation,
  type NavSectionId,
  type NotebookEntry,
  type SuspectPlayerNote,
  type TimelineState,
} from '@/lib/types';
import type { ServerTimerSnapshot } from '@/lib/engine/timer';
import CaseOverviewView from './CaseOverviewView';
import RightSuspectPanel from './RightSuspectPanel';
import EvidenceArchiveView from '@/components/viewer/EvidenceArchiveView';
import EvidenceCompareModal from '@/components/viewer/EvidenceCompareModal';
import SuspectDatabaseView from '@/components/tools/SuspectDatabaseView';
import DetectiveBoardView from '@/components/tools/DetectiveBoardView';
import TimelineReconstructionView from '@/components/tools/TimelineReconstructionView';
import InvestigatorNotebookView from '@/components/tools/InvestigatorNotebookView';
import FinalAccusationView from '@/components/tools/FinalAccusationView';

const NAV_ICONS: Record<NavSectionId, React.ComponentType<{ className?: string }>> = {
  case_overview: LayoutDashboard,
  original_case_files: FileText,
  crime_scene: Map,
  suspect_database: Users,
  witness_statements: MessageSquareQuote,
  interrogation_records: Mic,
  documents: FolderOpen,
  cctv_archive: Video,
  audio_archive: Headphones,
  physical_evidence: Package,
  forensic_reports: FlaskConical,
  digital_forensics: Cpu,
  detective_board: Network,
  timeline_reconstruction: CalendarClock,
  investigator_notebook: BookOpen,
  final_accusation: Gavel,
};

export default function InvestigationDashboard({
  caseId,
  user,
}: {
  caseId: string;
  user: ClientUser;
}) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [requiresPurchase, setRequiresPurchase] = useState(false);

  const [activeNav, setActiveNav] = useState<NavSectionId>('case_overview');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);

  // Responsive panels & modals
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');

  // Server-authoritative timer display state (anchored to serverNow offset!)
  const serverClockOffsetRef = useRef<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(14400);
  const [startingClock, setStartingClock] = useState(false);

  // Auto-save indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<DashboardPayload | null>(null);

  useEffect(() => {
    latestPayloadRef.current = data;
  }, [data]);

  const syncServerClock = useCallback((timer: ServerTimerSnapshot) => {
    const serverMs = new Date(timer.serverNow).getTime();
    serverClockOffsetRef.current = serverMs - Date.now();
    setRemainingSeconds(timer.remainingSeconds);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setRequiresPurchase(false);
    try {
      const res = await fetch(`/api/cases/${caseId}/dashboard`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) {
        setLoadError(body.error || 'Unable to load case file.');
        if (body.requiresEntitlement) setRequiresPurchase(true);
        return;
      }
      setData(body as DashboardPayload);
      syncServerClock(body.timer);
      if (body.evidence?.length >= 2) {
        setCompareLeftId((prev) => prev || body.evidence[0].id);
        setCompareRightId((prev) => prev || body.evidence[1].id);
      }
    } catch {
      setLoadError('Network error connecting to intelligence server.');
    } finally {
      setLoading(false);
    }
  }, [caseId, syncServerClock]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // Live 1-second tick derived strictly from server deadline & offset (tamper-proof)
  useEffect(() => {
    if (!data?.timer) return;
    if (data.timer.status !== 'active' || !data.timer.deadlineAt) {
      setRemainingSeconds(data.timer.remainingSeconds);
      return;
    }

    const deadlineMs = new Date(data.timer.deadlineAt).getTime();
    const tick = () => {
      const estimatedServerNow = Date.now() + serverClockOffsetRef.current;
      const secs = Math.max(0, Math.floor((deadlineMs - estimatedServerNow) / 1000));
      setRemainingSeconds(secs);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data?.timer]);

  // Ctrl+K Global Search shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Debounced auto-save to PostgreSQL
  const scheduleWorkspaceSave = useCallback(() => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const snap = latestPayloadRef.current;
      if (!snap) return;
      try {
        const res = await fetch(`/api/cases/${caseId}/workspace`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardState: snap.workspace.boardState,
            timelineState: snap.workspace.timelineState,
            notebookEntries: snap.workspace.notebookEntries,
            suspectNotes: snap.workspace.suspectNotes,
            evidenceAnnotations: snap.workspace.evidenceAnnotations,
            accusationDraft: snap.workspace.accusationDraft,
            viewedEvidenceIds: snap.session.viewedEvidenceIds,
            bookmarkedEvidenceIds: snap.session.bookmarkedEvidenceIds,
          }),
        });
        if (res.ok) setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 600);
  }, [caseId]);

  const handleStartInvestigation = useCallback(async () => {
    setStartingClock(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/session/start`, { method: 'POST' });
      const body = await res.json();
      if (res.ok && body.timer) {
        syncServerClock(body.timer);
        setData((prev) => (prev ? { ...prev, timer: body.timer } : prev));
      }
    } finally {
      setStartingClock(false);
    }
  }, [caseId, syncServerClock]);

  const markEvidenceViewed = useCallback(
    (evidenceId: string) => {
      setData((prev) => {
        if (!prev) return prev;
        if (prev.session.viewedEvidenceIds.includes(evidenceId)) return prev;
        return {
          ...prev,
          session: {
            ...prev.session,
            viewedEvidenceIds: [...prev.session.viewedEvidenceIds, evidenceId],
          },
        };
      });
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const openEvidenceById = useCallback(
    (evidenceId: string) => {
      const ev = data?.evidence.find((e) => e.id === evidenceId);
      if (!ev) return;
      setSelectedEvidenceId(ev.id);
      setActiveNav(ev.section);
      markEvidenceViewed(ev.id);
      setSearchOpen(false);
    },
    [data?.evidence, markEvidenceViewed],
  );

  const openEvidenceByCode = useCallback(
    (code: string) => {
      const ev = data?.evidence.find(
        (e) => e.evidenceCode.toLowerCase() === code.toLowerCase(),
      );
      if (ev) openEvidenceById(ev.id);
    },
    [data?.evidence, openEvidenceById],
  );

  const openSuspectById = useCallback((suspectId: string) => {
    setSelectedSuspectId(suspectId);
    setActiveNav('suspect_database');
    setSearchOpen(false);
  }, []);

  const openSuspectByCode = useCallback(
    (code: string) => {
      const sus = data?.suspects.find(
        (s) => s.suspectCode.toLowerCase() === code.toLowerCase(),
      );
      if (sus) openSuspectById(sus.id);
    },
    [data?.suspects, openSuspectById],
  );

  const toggleBookmark = useCallback(
    (evidenceId: string) => {
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.session.bookmarkedEvidenceIds.includes(evidenceId);
        return {
          ...prev,
          session: {
            ...prev.session,
            bookmarkedEvidenceIds: exists
              ? prev.session.bookmarkedEvidenceIds.filter((id) => id !== evidenceId)
              : [...prev.session.bookmarkedEvidenceIds, evidenceId],
          },
        };
      });
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const updateAnnotation = useCallback(
    (evidenceId: string, annotation: EvidenceAnnotation) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          workspace: {
            ...prev.workspace,
            evidenceAnnotations: {
              ...prev.workspace.evidenceAnnotations,
              [evidenceId]: annotation,
            },
          },
        };
      });
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const updateSuspectNote = useCallback(
    (suspectId: string, note: SuspectPlayerNote) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          workspace: {
            ...prev.workspace,
            suspectNotes: {
              ...prev.workspace.suspectNotes,
              [suspectId]: note,
            },
          },
        };
      });
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const updateBoard = useCallback(
    (boardState: BoardState) => {
      setData((prev) =>
        prev ? { ...prev, workspace: { ...prev.workspace, boardState } } : prev,
      );
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const updateTimeline = useCallback(
    (timelineState: TimelineState) => {
      setData((prev) =>
        prev ? { ...prev, workspace: { ...prev.workspace, timelineState } } : prev,
      );
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const updateNotebook = useCallback(
    (notebookEntries: NotebookEntry[]) => {
      setData((prev) =>
        prev ? { ...prev, workspace: { ...prev.workspace, notebookEntries } } : prev,
      );
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const updateAccusationDraft = useCallback(
    (accusationDraft: AccusationDraft) => {
      setData((prev) =>
        prev ? { ...prev, workspace: { ...prev.workspace, accusationDraft } } : prev,
      );
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const pinEvidenceToBoard = useCallback(
    (ev: ClientEvidence) => {
      setData((prev) => {
        if (!prev) return prev;
        if (prev.workspace.boardState.nodes.some((n) => n.refId === ev.id)) return prev;
        const count = prev.workspace.boardState.nodes.length;
        const node = {
          id: `bn-${Date.now().toString(36)}`,
          type: 'evidence' as const,
          refId: ev.id,
          code: ev.evidenceCode,
          title: ev.title,
          subtitle: ev.viewerType.toUpperCase(),
          x: 42 + (count % 4) * 240,
          y: 42 + Math.floor(count / 4) * 150,
          color: ev.isHiddenClue ? ('emerald' as const) : ('slate' as const),
        };
        return {
          ...prev,
          workspace: {
            ...prev.workspace,
            boardState: {
              ...prev.workspace.boardState,
              nodes: [...prev.workspace.boardState.nodes, node],
            },
          },
        };
      });
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const pinSuspectToBoard = useCallback(
    (sus: ClientSuspect) => {
      setData((prev) => {
        if (!prev) return prev;
        if (prev.workspace.boardState.nodes.some((n) => n.refId === sus.id)) return prev;
        const count = prev.workspace.boardState.nodes.length;
        const node = {
          id: `bn-${Date.now().toString(36)}`,
          type: 'suspect' as const,
          refId: sus.id,
          code: sus.suspectCode,
          title: sus.fullName,
          subtitle: sus.occupation,
          x: 42 + (count % 4) * 240,
          y: 42 + Math.floor(count / 4) * 150,
          color: 'red' as const,
        };
        return {
          ...prev,
          workspace: {
            ...prev.workspace,
            boardState: {
              ...prev.workspace.boardState,
              nodes: [...prev.workspace.boardState.nodes, node],
            },
          },
        };
      });
      scheduleWorkspaceSave();
    },
    [scheduleWorkspaceSave],
  );

  const handleUnlockEvidence = useCallback(
    async (evidenceId: string, passcode?: string) => {
      const res = await fetch(`/api/cases/${caseId}/evidence/${evidenceId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const body = await res.json();
      if (!res.ok) {
        return { ok: false, error: body.error || 'Decryption failed.' };
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          session: {
            ...prev.session,
            unlockedEvidenceIds: Array.from(
              new Set([...prev.session.unlockedEvidenceIds, evidenceId]),
            ),
          },
          evidence: prev.evidence.map((e) => (e.id === evidenceId ? body.evidence : e)),
        };
      });
      return { ok: true };
    },
    [caseId],
  );

  const handleSubmissionComplete = useCallback(
    (submission: ClientSubmission, updatedTimer: ServerTimerSnapshot) => {
      syncServerClock(updatedTimer);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          timer: updatedTimer,
          submissions: [submission, ...prev.submissions],
        };
      });
    },
    [syncServerClock],
  );

  // Global search results across evidence, suspects, and notebook
  const searchResults = useMemo(() => {
    if (!data || !globalQuery.trim()) return { evidence: [], suspects: [], notes: [] };
    const q = globalQuery.toLowerCase();
    return {
      evidence: data.evidence.filter((e) => {
        const hay = `${e.evidenceCode} ${e.title} ${e.summary} ${e.tags.join(' ')} ${JSON.stringify(
          e.structuredContent ?? {},
        )}`.toLowerCase();
        return hay.includes(q);
      }),
      suspects: data.suspects.filter((s) =>
        `${s.suspectCode} ${s.fullName} ${s.occupation} ${s.alibiSummary} ${s.motiveSummary}`
          .toLowerCase()
          .includes(q),
      ),
      notes: data.workspace.notebookEntries.filter((n) =>
        `${n.title} ${n.content}`.toLowerCase().includes(q),
      ),
    };
  }, [data, globalQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080b] flex items-center justify-center font-mono text-xs tracking-[0.22em] text-[#9aa5b8]">
        LOADING ENCRYPTED CASE DOSSIER...
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-[#07080b] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-[#9e1b24] bg-[#110e12] p-6 text-center space-y-4">
          <Lock className="w-8 h-8 text-[#dc2626] mx-auto" />
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#fca5a5]">
            {requiresPurchase ? 'ENTITLEMENT REQUIRED' : 'CASE ACCESS BLOCKED'}
          </div>
          <p className="text-sm text-[#cbd5e1]">{loadError || 'Unable to access this case.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded bg-[#9e1b24] hover:bg-[#b5222c] px-4 py-2 font-mono text-xs text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> RETURN TO CASE DIRECTORY
          </Link>
        </div>
      </div>
    );
  }

  // Group 16 navigation sections for left sidebar
  const navGroups = Array.from(new Set(NAV_SECTIONS.map((n) => n.group)));
  const activeNavMeta = NAV_SECTIONS.find((n) => n.id === activeNav);

  const timerUrgent = data.timer.status === 'active' && remainingSeconds <= 600;
  const timerWarn = data.timer.status === 'active' && remainingSeconds <= 1800 && !timerUrgent;

  return (
    <div className="h-screen flex flex-col bg-[#07080b] text-[#e8ecf2] overflow-hidden">
      {/* 1. PERSISTENT TOP NAVIGATION BAR */}
      <header className="h-14 shrink-0 border-b border-[#212836] bg-[#0b0e14] px-3 sm:px-4 flex items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="lg:hidden rounded border border-[#283143] bg-[#131722] p-1.5 text-[#cbd5e1] cursor-pointer"
            aria-label="Toggle Navigation Sidebar"
          >
            {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-90 transition shrink-0"
            title="Return to PROJECT X FILES — CLASSIFIED Case Directory"
          >
            <span className="sm:hidden">
              <BrandLogo variant="mark" size="sm" />
            </span>
            <span className="hidden sm:inline-flex">
              <BrandLogo variant="wordmark" size="sm" />
            </span>
          </Link>

          <span className="hidden md:inline text-[#323c50]">/</span>

          <div className="min-w-0 hidden md:block">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#9e1b24]/20 border border-[#9e1b24]/60 text-[#fca5a5]">
                {data.case.caseNumber}
              </span>
              <span className="text-xs font-semibold text-[#e8ecf2] truncate max-w-[230px] xl:max-w-[340px]">
                {data.case.title}
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right Utilities + Persistent 4-Hour Server Timer */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 rounded border border-[#273042] bg-[#121620] hover:border-[#c88a2e] px-2.5 py-1.5 font-mono text-[11px] text-[#9aa5b8] hover:text-white cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#c88a2e]" />
            <span className="hidden sm:inline">SEARCH ARCHIVE</span>
            <kbd className="hidden xl:inline text-[9px] px-1 py-0.5 rounded bg-[#090b10] border border-[#2a3345]">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-[#273042] bg-[#121620] hover:border-[#3b82a6] px-2.5 py-1.5 font-mono text-[11px] text-[#cbd5e1] cursor-pointer"
            title="Compare Two Exhibits Side-by-Side"
          >
            <Columns2 className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className="hidden xl:inline">COMPARE</span>
          </button>

          {/* Auto-Save Status Pill */}
          <div className="hidden md:flex items-center gap-1 font-mono text-[10px] text-[#728096] px-2">
            {saveStatus === 'saving' ? (
              <>
                <Save className="w-3 h-3 text-[#c88a2e] animate-pulse" />
                <span>SYNCING</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-[#2e7d5b]" />
                <span>SAVED</span>
              </>
            )}
          </div>

          {/* 5. PERSISTENT FOUR-HOUR SERVER-AUTHORITATIVE TIMER */}
          <div
            className={`flex items-center gap-2 rounded border px-2.5 py-1 font-mono ${
              timerUrgent
                ? 'border-[#dc2626] bg-[#9e1b24]/30 text-[#fca5a5] animate-pulse'
                : timerWarn
                  ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#fef3c7]'
                  : data.timer.status === 'active'
                    ? 'border-[#2f3b52] bg-[#131824] text-[#e8ecf2]'
                    : data.timer.status === 'submitted'
                      ? 'border-[#2e7d5b] bg-[#2e7d5b]/15 text-[#86efac]'
                      : 'border-[#c88a2e]/60 bg-[#19150f] text-[#e3a74c]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <div className="leading-none">
              <div className="text-[8px] uppercase tracking-wider opacity-80">
                {data.timer.status === 'not_started'
                  ? 'STANDBY'
                  : data.timer.status === 'submitted'
                    ? 'CLOSED'
                    : data.timer.status === 'expired'
                      ? 'EXPIRED'
                      : 'TIME LEFT'}
              </div>
              <div className="text-xs font-bold tracking-wider">
                {formatDurationHms(remainingSeconds)}
              </div>
            </div>
            {data.timer.status === 'not_started' && (
              <button
                type="button"
                disabled={startingClock}
                onClick={handleStartInvestigation}
                className="ml-1 rounded bg-[#9e1b24] hover:bg-[#b8202b] px-2 py-1 text-[10px] font-bold text-white inline-flex items-center gap-1 cursor-pointer"
                title="Explicitly Start Server Investigation Timer"
              >
                <Play className="w-2.5 h-2.5 fill-current" /> START
              </button>
            )}
          </div>

          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center gap-1 rounded border border-[#c88a2e]/50 bg-[#c88a2e]/10 hover:bg-[#c88a2e]/20 px-2.5 py-1.5 font-mono text-[10px] text-[#e3a74c]"
              title="Open Administrator CMS"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">CMS</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setRightPanelOpen((v) => !v)}
            className={`rounded border p-1.5 cursor-pointer ${
              rightPanelOpen
                ? 'border-[#c88a2e]/60 bg-[#c88a2e]/15 text-[#e3a74c]'
                : 'border-[#273042] bg-[#121620] text-[#9aa5b8]'
            }`}
            title="Toggle Suspect Intelligence Panel"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN 3-COLUMN WORKBENCH BODY */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* 2. LEFT INVESTIGATION NAVIGATION SIDEBAR */}
        <aside
          className={`${
            mobileNavOpen ? 'fixed inset-y-14 left-0 z-40 block w-64' : 'hidden'
          } lg:static lg:block lg:w-60 shrink-0 border-r border-[#212836] bg-[#0b0e14] overflow-y-auto`}
        >
          <nav className="p-2.5 space-y-4">
            {navGroups.map((groupName) => (
              <div key={groupName}>
                <div className="px-2.5 mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[#5c687e] font-semibold">
                  {groupName}
                </div>
                <div className="space-y-0.5">
                  {NAV_SECTIONS.filter((item) => item.group === groupName).map((item) => {
                    const Icon = NAV_ICONS[item.id];
                    const isActive = activeNav === item.id;
                    const sectionEvidence = item.evidenceSection
                      ? data.evidence.filter((e) => e.section === item.evidenceSection)
                      : null;
                    const count =
                      item.id === 'suspect_database'
                        ? data.suspects.length
                        : item.id === 'detective_board'
                          ? data.workspace.boardState.nodes.length
                          : item.id === 'investigator_notebook'
                            ? data.workspace.notebookEntries.length
                            : item.id === 'timeline_reconstruction'
                              ? data.timelineEvents.length
                              : sectionEvidence?.length ?? null;
                    const hasLocked = sectionEvidence?.some((e) => e.accessRules?.locked);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveNav(item.id);
                          setMobileNavOpen(false);
                          if (sectionEvidence?.length) {
                            const currentInSec = sectionEvidence.find(
                              (e) => e.id === selectedEvidenceId,
                            );
                            const nextEv = currentInSec ?? sectionEvidence[0]!;
                            setSelectedEvidenceId(nextEv.id);
                            markEvidenceViewed(nextEv.id);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-2 rounded px-2.5 py-2 text-xs transition cursor-pointer ${
                          isActive
                            ? item.id === 'final_accusation'
                              ? 'bg-[#9e1b24]/25 text-white border border-[#9e1b24]/70 font-semibold'
                              : 'bg-[#171d2a] text-[#e8ecf2] border-l-2 border-[#c88a2e] font-semibold'
                            : 'text-[#9aa5b8] hover:bg-[#121620] hover:text-[#e8ecf2]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive
                                ? item.id === 'final_accusation'
                                  ? 'text-[#f87171]'
                                  : 'text-[#e3a74c]'
                                : 'text-[#6a778e]'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </span>

                        <span className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                          {hasLocked && <Lock className="w-2.5 h-2.5 text-[#f87171]" />}
                          {count !== null && (
                            <span
                              className={`px-1.5 py-0.2 rounded ${
                                isActive
                                  ? 'bg-[#252e42] text-[#e3a74c]'
                                  : 'bg-[#141822] text-[#6d7a90]'
                              }`}
                            >
                              {count}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* 3. CENTRAL EVIDENCE & INVESTIGATION WORKSPACE */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5 bg-[#080a0e]">
          {activeNav === 'case_overview' && (
            <CaseOverviewView
              data={data}
              remainingSeconds={remainingSeconds}
              starting={startingClock}
              onStartInvestigation={handleStartInvestigation}
              onNavigate={(sec) => {
                setActiveNav(sec);
                const navObj = NAV_SECTIONS.find((n) => n.id === sec);
                if (navObj?.evidenceSection) {
                  const first = data.evidence.find((e) => e.section === navObj.evidenceSection);
                  if (first) {
                    setSelectedEvidenceId(first.id);
                    markEvidenceViewed(first.id);
                  }
                }
              }}
            />
          )}

          {activeNavMeta?.evidenceSection && (
            <EvidenceArchiveView
              sectionTitle={activeNavMeta.label}
              sectionFilter={activeNavMeta.evidenceSection}
              allEvidence={data.evidence}
              evidenceRelations={data.evidenceRelations}
              suspects={data.suspects}
              selectedEvidenceId={selectedEvidenceId}
              viewedIds={data.session.viewedEvidenceIds}
              bookmarkedIds={data.session.bookmarkedEvidenceIds}
              annotations={data.workspace.evidenceAnnotations}
              onSelectEvidence={(id) => {
                setSelectedEvidenceId(id);
                markEvidenceViewed(id);
              }}
              onToggleBookmark={toggleBookmark}
              onUpdateAnnotation={updateAnnotation}
              onPinToBoard={pinEvidenceToBoard}
              onAddToCompare={(id) => {
                setCompareLeftId(id);
                if (compareRightId === id) {
                  const alt = data.evidence.find((e) => e.id !== id);
                  if (alt) setCompareRightId(alt.id);
                }
                setCompareOpen(true);
              }}
              onSelectSuspectById={openSuspectById}
              onUnlockEvidence={handleUnlockEvidence}
            />
          )}

          {activeNav === 'suspect_database' && (
            <SuspectDatabaseView
              suspects={data.suspects}
              relationships={data.suspectRelationships}
              allEvidence={data.evidence}
              selectedSuspectId={selectedSuspectId}
              suspectNotes={data.workspace.suspectNotes}
              onSelectSuspect={setSelectedSuspectId}
              onUpdateSuspectNote={updateSuspectNote}
              onOpenEvidenceByCode={openEvidenceByCode}
              onPinSuspectToBoard={pinSuspectToBoard}
            />
          )}

          {activeNav === 'detective_board' && (
            <DetectiveBoardView
              boardState={data.workspace.boardState}
              allEvidence={data.evidence}
              suspects={data.suspects}
              onChangeBoard={updateBoard}
              onOpenEvidence={openEvidenceById}
              onOpenSuspect={openSuspectById}
            />
          )}

          {activeNav === 'timeline_reconstruction' && (
            <TimelineReconstructionView
              events={data.timelineEvents}
              timelineState={data.workspace.timelineState}
              allEvidence={data.evidence}
              suspects={data.suspects}
              onChangeTimeline={updateTimeline}
              onOpenEvidence={openEvidenceById}
            />
          )}

          {activeNav === 'investigator_notebook' && (
            <InvestigatorNotebookView
              entries={data.workspace.notebookEntries}
              allEvidence={data.evidence}
              suspects={data.suspects}
              onChangeEntries={updateNotebook}
              onOpenEvidenceByCode={openEvidenceByCode}
              onOpenSuspectByCode={openSuspectByCode}
            />
          )}

          {activeNav === 'final_accusation' && (
            <FinalAccusationView
              caseId={caseId}
              suspects={data.suspects}
              allEvidence={data.evidence}
              timelineEvents={data.timelineEvents}
              orderedTimelineIds={data.workspace.timelineState.orderedEventIds}
              bookmarkedIds={data.session.bookmarkedEvidenceIds}
              scoringWeights={data.case.scoringWeights}
              maxAttempts={data.case.maxAccusationAttempts}
              timer={data.timer}
              draft={data.workspace.accusationDraft}
              submissions={data.submissions}
              onUpdateDraft={updateAccusationDraft}
              onStartInvestigation={handleStartInvestigation}
              onSubmissionComplete={handleSubmissionComplete}
            />
          )}
        </main>

        {/* 4. RIGHT SUSPECT INTELLIGENCE PANEL */}
        {rightPanelOpen && (
          <div className="fixed inset-y-14 right-0 z-30 w-80 xl:static xl:w-76 shrink-0">
            <RightSuspectPanel
              suspects={data.suspects}
              allEvidence={data.evidence}
              suspectNotes={data.workspace.suspectNotes}
              onUpdateSuspectNote={updateSuspectNote}
              onOpenFullProfile={openSuspectById}
              onOpenEvidence={openEvidenceById}
              onCloseMobile={() => setRightPanelOpen(false)}
            />
          </div>
        )}
      </div>

      {/* GLOBAL ARCHIVE SEARCH MODAL (Ctrl+K) */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-lg border border-[#2f394e] bg-[#0e1118] overflow-hidden shadow-2xl"
          >
            <div className="border-b border-[#222937] px-4 py-3 flex items-center gap-3">
              <Search className="w-4 h-4 text-[#c88a2e]" />
              <input
                type="text"
                autoFocus
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Search across evidence codes, transcripts, RFID logs, suspects, and notes..."
                className="flex-1 bg-transparent text-sm text-[#e8ecf2] focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-[#7f8ca1] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-3 space-y-4">
              {!globalQuery.trim() ? (
                <div className="py-8 text-center font-mono text-xs text-[#6d7a90]">
                  Type any suspect name, evidence code (e.g. EV-006), compound, timestamp, or tag.
                </div>
              ) : (
                <>
                  {searchResults.evidence.length > 0 && (
                    <div>
                      <div className="font-mono text-[10px] text-[#c88a2e] uppercase px-2 mb-1.5">
                        EVIDENCE EXHIBITS ({searchResults.evidence.length})
                      </div>
                      <div className="space-y-1">
                        {searchResults.evidence.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => openEvidenceById(ev.id)}
                            className="w-full text-left rounded border border-[#1f2634] bg-[#131722] hover:border-[#c88a2e] px-3 py-2 cursor-pointer"
                          >
                            <div className="font-mono text-[10px] text-[#e3a74c]">
                              {ev.evidenceCode} · {ev.section.replace(/_/g, ' ').toUpperCase()}
                            </div>
                            <div className="text-xs font-semibold text-[#e8ecf2]">{ev.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.suspects.length > 0 && (
                    <div>
                      <div className="font-mono text-[10px] text-[#f87171] uppercase px-2 mb-1.5">
                        SUSPECTS &amp; WITNESSES ({searchResults.suspects.length})
                      </div>
                      <div className="space-y-1">
                        {searchResults.suspects.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => openSuspectById(s.id)}
                            className="w-full text-left rounded border border-[#1f2634] bg-[#131722] hover:border-[#9e1b24] px-3 py-2 cursor-pointer"
                          >
                            <div className="font-mono text-[10px] text-[#f87171]">
                              {s.suspectCode} · {s.occupation}
                            </div>
                            <div className="text-xs font-semibold text-[#e8ecf2]">{s.fullName}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.evidence.length === 0 &&
                    searchResults.suspects.length === 0 &&
                    searchResults.notes.length === 0 && (
                      <div className="py-8 text-center font-mono text-xs text-[#7f8ca1]">
                        No matches found for “{globalQuery}”.
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIDE-BY-SIDE EVIDENCE COMPARISON MODAL */}
      <EvidenceCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        allEvidence={data.evidence}
        evidenceRelations={data.evidenceRelations}
        suspects={data.suspects}
        leftId={compareLeftId}
        rightId={compareRightId}
        onChangeLeftId={setCompareLeftId}
        onChangeRightId={setCompareRightId}
        bookmarkedIds={data.session.bookmarkedEvidenceIds}
        annotations={data.workspace.evidenceAnnotations}
        onToggleBookmark={toggleBookmark}
        onUpdateAnnotation={updateAnnotation}
        onPinToBoard={pinEvidenceToBoard}
        onUnlockEvidence={handleUnlockEvidence}
      />
    </div>
  );
}
