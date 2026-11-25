'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Lock,
  Unlock,
  Clock,
  FileSearch,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  CheckCircle2,
  KeyRound,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import { formatDurationHms, type ClientUser } from '@/lib/client-types';
import type { CaseDifficulty, CaseMetadata, CaseStatus } from '@/lib/types';

interface CaseCatalogItem {
  id: string;
  slug: string;
  caseNumber: string;
  title: string;
  subtitle: string;
  classification: string;
  status: CaseStatus;
  difficulty: CaseDifficulty;
  priceCents: number;
  currency: string;
  summary: string;
  incidentLocation: string;
  incidentDate: string;
  victimName: string;
  defaultDurationSeconds: number;
  metadata: CaseMetadata;
  suspectCount: number;
  evidenceCount: number;
  entitled: boolean;
  purchaseRef: string | null;
  sessionStatus: 'not_started' | 'active' | 'expired' | 'submitted';
  remainingSeconds: number;
}

export default function CaseLibraryClient({
  initialUser,
}: {
  initialUser: ClientUser | null;
}) {
  const [user, setUser] = useState<ClientUser | null>(initialUser);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('detective@casefiles.local');
  const [password, setPassword] = useState('DetectivePassword123!');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [cases, setCases] = useState<CaseCatalogItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const loadCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const res = await fetch('/api/cases', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases ?? []);
      }
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadCases();
    }
  }, [user, loadCases]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        authMode === 'login' ? { email, password } : { email, password, displayName };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      setUser(data.user);
    } catch {
      setAuthError('Network error while authenticating.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function quickLogin(presetEmail: string, presetPassword: string) {
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: presetEmail, password: presetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Sign-in failed.');
        return;
      }
      setUser(data.user);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setCases([]);
  }

  async function handlePurchaseCase(caseId: string) {
    setPurchasingId(caseId);
    setNotice('');
    try {
      const res = await fetch(`/api/cases/${caseId}/purchase`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setNotice(`Entitlement granted — Purchase Reference ${data.purchaseRef}`);
        await loadCases();
      }
    } finally {
      setPurchasingId(null);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#07080b] forensic-grid flex flex-col justify-between">
        <header className="border-b border-[#222937] bg-[#0c0f15]/90 backdrop-blur px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#9e1b24]/20 border border-[#9e1b24] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-[#dc2626]" />
            </div>
            <div>
              <div className="font-mono text-xs tracking-[0.26em] text-[#e8ecf2] font-semibold">
                THE CASE FILES
              </div>
              <div className="font-mono text-[10px] tracking-[0.18em] text-[#667389] uppercase">
                FORENSIC INTELLIGENCE TERMINAL // v2.4
              </div>
            </div>
          </div>
          <span className="font-mono text-[11px] px-2.5 py-1 rounded border border-[#2a3345] bg-[#11151f] text-[#c88a2e]">
            RESTRICTED ACCESS
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-5xl grid lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Intelligence Dossier Briefing */}
            <div className="lg:col-span-7 rounded-lg border border-[#232a38] bg-[#0f1218]/95 p-8 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#9e1b24] via-[#c88a2e] to-transparent" />
              <div>
                <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-[#c88a2e] uppercase mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#dc2626] animate-pulse" />
                  REUSABLE CRIMINAL INVESTIGATION ENGINE
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#e8ecf2] leading-tight">
                  One Forensic Intelligence Engine.
                  <span className="block text-[#9aa5b8] mt-1">Unlimited Configurable Cases.</span>
                </h1>
                <p className="mt-5 text-sm leading-relaxed text-[#9aa5b8] max-w-xl">
                  Examine signed forensic documents, CCTV security archives, audio intercepts,
                  digital communications, and suspect dossiers inside a unified command terminal.
                  Every case runs on a server-authoritative 4-hour clock with real-time database
                  persistence and confidential server-side scoring.
                </p>

                <div className="mt-8 grid sm:grid-cols-2 gap-3">
                  {[
                    ['16-Section Command Shell', 'Overview, Crime Scene, Forensics, CCTV, Audio, Board, Timeline'],
                    ['Universal 8-Format Viewer', 'PDF, Images, Audio, Video, Transcripts, Sheets, Comms, Metadata'],
                    ['Server-Authoritative Timer', 'Explicit 4-hour start, tamper-proof deadlines & admin extensions'],
                    ['Full Administrator CMS', 'Create, duplicate, bulk-upload, validate & publish unlimited cases'],
                  ].map(([head, sub]) => (
                    <div
                      key={head}
                      className="rounded border border-[#222937] bg-[#141821] p-3.5"
                    >
                      <div className="font-mono text-xs text-[#e3a74c] font-medium">{head}</div>
                      <div className="text-xs text-[#8b97aa] mt-1 leading-snug">{sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[#222937] flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#667389]">
                <span>STORAGE: PRIVATE SIGNED DELIVERY</span>
                <span>DB: POSTGRESQL DYNAMIC SCHEMA</span>
                <span>RBAC + AUDIT LOGS ACTIVE</span>
              </div>
            </div>

            {/* Right Terminal Authentication Card */}
            <div className="lg:col-span-5 rounded-lg border border-[#2a3242] bg-[#10141c] p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-mono text-sm tracking-[0.16em] uppercase text-[#e8ecf2] font-semibold">
                    {authMode === 'login' ? 'Investigator Sign-In' : 'Register Credentials'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'login' ? 'register' : 'login');
                      setAuthError('');
                    }}
                    className="font-mono text-[11px] text-[#c88a2e] hover:text-[#e3a74c] underline underline-offset-4"
                  >
                    {authMode === 'login' ? 'New Badge?' : 'Have Credentials?'}
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {authMode === 'register' && (
                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wider text-[#9aa5b8] mb-1.5">
                        Investigator Name
                      </label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Det. Jordan Vance"
                        className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-sm text-[#e8ecf2] focus:border-[#c88a2e] focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#9aa5b8] mb-1.5">
                      Email Identifier
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-sm text-[#e8ecf2] font-mono focus:border-[#c88a2e] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider text-[#9aa5b8] mb-1.5">
                      Access Passphrase
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 text-sm text-[#e8ecf2] font-mono focus:border-[#c88a2e] focus:outline-none"
                    />
                  </div>

                  {authError && (
                    <div className="rounded border border-[#9e1b24] bg-[#9e1b24]/15 px-3 py-2 text-xs text-[#fca5a5]">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded bg-[#9e1b24] hover:bg-[#b8202b] disabled:opacity-50 px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white transition cursor-pointer"
                  >
                    {authLoading
                      ? 'AUTHENTICATING...'
                      : authMode === 'login'
                        ? 'ACCESS CASE TERMINAL'
                        : 'ISSUE INVESTIGATOR BADGE'}
                  </button>
                </form>
              </div>

              <div className="mt-7 pt-5 border-t border-[#222937]">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#667389] mb-2.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#c88a2e]" />
                  DEMO EVALUATION CREDENTIALS
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => quickLogin('detective@casefiles.local', 'DetectivePassword123!')}
                    className="w-full text-left rounded border border-[#263042] bg-[#141923] hover:border-[#c88a2e] px-3.5 py-2.5 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#e8ecf2]">
                        Det. Alex Morgan (Investigator)
                      </span>
                      <span className="font-mono text-[10px] text-[#c88a2e]">INV-4409</span>
                    </div>
                    <div className="text-[11px] text-[#7f8ca1] mt-0.5">
                      Owns Ashford Estate case; Meridian Express gated for entitlement testing.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => quickLogin('admin@casefiles.local', 'AdminPassword123!')}
                    className="w-full text-left rounded border border-[#263042] bg-[#141923] hover:border-[#9e1b24] px-3.5 py-2.5 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#e8ecf2]">
                        Dir. Claire Mercer (Admin CMS)
                      </span>
                      <span className="font-mono text-[10px] text-[#f87171]">ADM-0001</span>
                    </div>
                    <div className="text-[11px] text-[#7f8ca1] mt-0.5">
                      Full access to Case Creator, Bulk Uploader, Validation Runner &amp; Timer Extensions.
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t border-[#1b212d] px-6 py-3 text-center font-mono text-[10px] tracking-[0.15em] text-[#556175]">
          THE CASE FILES INTELLIGENCE PLATFORM — ALL EVIDENCE ASSETS PROTECTED BY SIGNED PRIVATE DELIVERY
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080b] text-[#e8ecf2]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#222937] bg-[#0b0e14]/95 backdrop-blur px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#9e1b24]/20 border border-[#9e1b24] flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-[#dc2626]" />
          </div>
          <div>
            <div className="font-mono text-xs tracking-[0.24em] font-semibold text-[#e8ecf2]">
              THE CASE FILES
            </div>
            <div className="font-mono text-[10px] tracking-[0.14em] text-[#728096]">
              ACTIVE CASE ARCHIVE // MULTI-CASE ENGINE
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded border border-[#c88a2e]/60 bg-[#c88a2e]/10 hover:bg-[#c88a2e]/20 px-3 py-1.5 font-mono text-xs text-[#e3a74c] transition"
            >
              <Settings className="w-3.5 h-3.5" />
              ADMINISTRATOR CMS
            </Link>
          )}

          <div className="hidden sm:flex items-center gap-2.5 rounded border border-[#242c3b] bg-[#12161f] px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2e7d5b]" />
            <div className="leading-tight">
              <div className="text-xs font-medium text-[#e8ecf2]">{user.displayName}</div>
              <div className="font-mono text-[10px] text-[#7f8ca1]">
                {user.badgeNumber} · {user.role.toUpperCase()}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded border border-[#2a3345] hover:border-[#9e1b24] bg-[#12161f] px-3 py-1.5 font-mono text-xs text-[#9aa5b8] hover:text-white transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            SIGN OUT
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#222937]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#c88a2e] mb-1">
              CENTRAL CASE DIRECTORY
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Assigned &amp; Purchasable Investigations
            </h1>
            <p className="text-sm text-[#9aa5b8] mt-1">
              Every dossier below is dynamically loaded from PostgreSQL into the same modular
              forensic dashboard.
            </p>
          </div>
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded bg-[#9e1b24] hover:bg-[#b5222c] px-4 py-2 font-mono text-xs uppercase tracking-wider text-white font-semibold transition"
            >
              <FolderKanban className="w-4 h-4" />
              CREATE OR MANAGE CASES
            </Link>
          )}
        </div>

        {notice && (
          <div className="mt-5 rounded border border-[#2e7d5b] bg-[#2e7d5b]/15 px-4 py-3 text-xs font-mono text-[#86efac] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {notice}
          </div>
        )}

        {loadingCases ? (
          <div className="py-20 text-center font-mono text-xs text-[#7f8ca1] tracking-widest">
            SYNCHRONIZING ENCRYPTED CASE ARCHIVE...
          </div>
        ) : (
          <div className="mt-7 grid md:grid-cols-2 gap-6">
            {cases.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-[#242c3b] bg-[#0f131a] hover:border-[#364259] transition flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#9e1b24]/20 border border-[#9e1b24]/60 text-[#fca5a5]">
                        {c.caseNumber}
                      </span>
                      <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-[#181e29] border border-[#2a3345] text-[#c88a2e]">
                        {c.difficulty}
                      </span>
                      {c.status !== 'published' && (
                        <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-amber-950/60 border border-amber-600/50 text-amber-300">
                          {c.status}
                        </span>
                      )}
                    </div>

                    {c.entitled ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-[#6ee7b7]">
                        <Unlock className="w-3 h-3" /> ENTITLED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-[#c88a2e]">
                        <Lock className="w-3 h-3" /> ${(c.priceCents / 100).toFixed(2)} {c.currency}
                      </span>
                    )}
                  </div>

                  <div className="font-mono text-[10px] tracking-[0.16em] text-[#728096] uppercase">
                    {c.classification}
                  </div>
                  <h2 className="text-xl font-semibold text-[#e8ecf2] mt-1">{c.title}</h2>
                  <p className="text-xs text-[#c88a2e] mt-0.5">{c.subtitle}</p>
                  <p className="text-sm text-[#9aa5b8] mt-3 leading-relaxed">{c.summary}</p>

                  <div className="mt-5 grid grid-cols-3 gap-2.5">
                    <div className="rounded border border-[#202736] bg-[#141923] px-3 py-2">
                      <div className="font-mono text-[10px] text-[#667389] flex items-center gap-1">
                        <FileSearch className="w-3 h-3 text-[#c88a2e]" /> EXHIBITS
                      </div>
                      <div className="font-mono text-sm font-semibold mt-0.5">{c.evidenceCount}</div>
                    </div>
                    <div className="rounded border border-[#202736] bg-[#141923] px-3 py-2">
                      <div className="font-mono text-[10px] text-[#667389] flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#c88a2e]" /> PROFILES
                      </div>
                      <div className="font-mono text-sm font-semibold mt-0.5">{c.suspectCount}</div>
                    </div>
                    <div className="rounded border border-[#202736] bg-[#141923] px-3 py-2">
                      <div className="font-mono text-[10px] text-[#667389] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#dc2626]" /> CLOCK
                      </div>
                      <div className="font-mono text-sm font-semibold mt-0.5">
                        {c.sessionStatus === 'active'
                          ? formatDurationHms(c.remainingSeconds)
                          : c.sessionStatus === 'submitted'
                            ? 'CLOSED'
                            : formatDurationHms(c.defaultDurationSeconds)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#202736] bg-[#0b0e14] px-6 py-4 flex items-center justify-between gap-3">
                  <div className="font-mono text-[11px] text-[#7f8ca1]">
                    STATUS:{' '}
                    <span
                      className={
                        c.sessionStatus === 'active'
                          ? 'text-[#e3a74c]'
                          : c.sessionStatus === 'submitted'
                            ? 'text-[#6ee7b7]'
                            : 'text-[#9aa5b8]'
                      }
                    >
                      {c.sessionStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {c.entitled ? (
                    <Link
                      href={`/cases/${c.id}`}
                      className="inline-flex items-center gap-1.5 rounded bg-[#9e1b24] hover:bg-[#b8212c] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-white transition"
                    >
                      {c.sessionStatus === 'active'
                        ? 'RESUME INVESTIGATION'
                        : c.sessionStatus === 'submitted'
                          ? 'REVIEW CASE REPORT'
                          : 'OPEN CASE FILE'}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={purchasingId === c.id}
                      onClick={() => handlePurchaseCase(c.id)}
                      className="inline-flex items-center gap-1.5 rounded border border-[#c88a2e] bg-[#c88a2e]/15 hover:bg-[#c88a2e]/25 px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#e3a74c] transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {purchasingId === c.id
                        ? 'GRANTING ENTITLEMENT...'
                        : `UNLOCK DOSSIER ($${(c.priceCents / 100).toFixed(2)})`}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
