'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
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
  Cpu,
  ShieldCheck,
  Network,
  CalendarClock,
  Gavel,
  Eye,
  ChevronDown,
  Radio,
} from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { formatDurationHms, type ClientUser } from '@/lib/client-types';
import type { PublicCaseShowcase } from '@/lib/seo/catalog';
import { COMMERCIAL_FAQS } from '@/lib/seo/schema';
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
  publicCases,
}: {
  initialUser: ClientUser | null;
  publicCases: PublicCaseShowcase[];
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

  // =========================================================================
  // PUBLIC COMMERCIAL LANDING PAGE + CYBORG NEON TERMINAL ACCESS (SEO-OPTIMIZED)
  // =========================================================================
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Commercial Sticky Navigation */}
        <header className="sticky top-0 z-30 border-b border-[#223047]/80 bg-[#060910]/85 backdrop-blur-md px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="hover:opacity-95 transition">
            <BrandLogo
              variant="wordmark"
              size="md"
              subtitle="NEURAL FORENSIC INVESTIGATION PLATFORM"
            />
          </Link>

          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-6 font-mono text-xs tracking-wider text-[#9aa5b8]"
          >
            <a href="#cases" className="hover:text-[#22d3ee] transition">
              CLASSIFIED CASES
            </a>
            <a href="#forensic-engine" className="hover:text-[#22d3ee] transition">
              FORENSIC ENGINE
            </a>
            <a href="#how-it-works" className="hover:text-[#22d3ee] transition">
              HOW IT WORKS
            </a>
            <a href="#faq" className="hover:text-[#22d3ee] transition">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded border border-[#22d3ee]/40 bg-[#0b1520]/80 text-[#67e8f9]">
              <Radio className="w-3 h-3 animate-pulse text-[#22d3ee]" />
              SYSTEM ONLINE
            </span>
            <a
              href="#terminal-access"
              className="rounded bg-[#9e1b24] hover:bg-[#b8202b] px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-white shadow-md shadow-[#9e1b24]/30 transition"
            >
              SIGN IN
            </a>
          </div>
        </header>

        <main className="flex-1">
          {/* HERO + LIVE TERMINAL ACCESS */}
          <section
            id="terminal-access"
            className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-14 lg:pt-14 lg:pb-18"
          >
            <div className="grid lg:grid-cols-12 gap-8 items-stretch">
              {/* Left Commercial Hero Pitch */}
              <div className="lg:col-span-7 cyborg-panel cyborg-panel-glow rounded-xl p-7 sm:p-9 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#22d3ee] via-[#dc2626] to-[#e3a74c]" />

                <div>
                  <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] text-[#67e8f9] uppercase mb-4 neon-text-cyan">
                    <span className="w-2 h-2 rounded-full bg-[#dc2626] animate-pulse" />
                    INTERACTIVE MURDER MYSTERY INTELLIGENCE TERMINAL
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.12]">
                    Crack Classified Murder Mysteries Inside a Live{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22d3ee] via-[#e8ecf2] to-[#e3a74c]">
                      Forensic Terminal.
                    </span>
                  </h1>

                  <p className="mt-5 text-sm sm:text-base leading-relaxed text-[#b2bdd0] max-w-2xl">
                    Ditch paper folders. Step directly into a next-generation criminal investigation
                    console loaded with authentic autopsy PDFs, night-vision CCTV archives, 911
                    audio wiretaps, digital forensics ledgers, encrypted chats, and an interactive
                    detective board—all racing against a tamper-proof 4-hour server clock.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <a
                      href="#cases"
                      className="inline-flex items-center gap-2 rounded bg-[#9e1b24] hover:bg-[#b8202b] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-white shadow-lg shadow-[#9e1b24]/30 transition"
                    >
                      EXPLORE CLASSIFIED CASES <ChevronRight className="w-4 h-4" />
                    </a>
                    <a
                      href="#forensic-engine"
                      className="inline-flex items-center gap-2 rounded border border-[#22d3ee]/45 bg-[#0b1622]/80 hover:border-[#22d3ee] px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#67e8f9] transition"
                    >
                      INSPECT FORENSIC TOOLS
                    </a>
                  </div>

                  {/* High-Density Capability Metrics */}
                  <div className="mt-8 grid sm:grid-cols-2 gap-3">
                    {[
                      [
                        '16-Section Command Shell',
                        'Crime Scene, Forensics, CCTV, Audio, Suspect DB, Board & Timeline',
                      ],
                      [
                        'Universal 8-Format Viewer',
                        'PDFs, Zoomable Plates, WAV Audio, CCTV Video, Sheets & Comms',
                      ],
                      [
                        'Server-Authoritative 4-Hour Clock',
                        'Begins only when you start; auto-saves across refresh or device',
                      ],
                      [
                        'Confidential Server-Side Scoring',
                        'Zero-spoiler answer vault grading killer, motive, method & proof',
                      ],
                    ].map(([head, sub]) => (
                      <div
                        key={head}
                        className="rounded-lg border border-[#243248]/80 bg-[#0b1019]/85 p-3.5"
                      >
                        <div className="font-mono text-xs text-[#e3a74c] font-semibold">{head}</div>
                        <div className="text-xs text-[#919eb4] mt-1 leading-snug">{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-[#222f43] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-wider text-[#72829b]">
                  <span>1–6 INVESTIGATORS · BROWSER NATIVE</span>
                  <span>PRIVATE SIGNED ASSET DELIVERY</span>
                  <span>INSTANT CASE ACCESS</span>
                </div>
              </div>

              {/* Right Investigator Terminal Access Card */}
              <div className="lg:col-span-5 cyborg-panel rounded-xl p-7 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#dc2626] via-[#e3a74c] to-[#22d3ee]" />
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-mono text-sm tracking-[0.16em] uppercase text-[#e8ecf2] font-semibold">
                      {authMode === 'login' ? 'Investigator Sign-In' : 'Issue Investigator Badge'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode(authMode === 'login' ? 'register' : 'login');
                        setAuthError('');
                      }}
                      className="font-mono text-[11px] text-[#22d3ee] hover:text-[#67e8f9] underline underline-offset-4 cursor-pointer"
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
                          className="w-full rounded border border-[#2a384f] bg-[#070a10]/90 px-3 py-2 text-sm text-[#e8ecf2] focus:border-[#22d3ee] focus:outline-none"
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
                        className="w-full rounded border border-[#2a384f] bg-[#070a10]/90 px-3 py-2 text-sm text-[#e8ecf2] font-mono focus:border-[#22d3ee] focus:outline-none"
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
                        className="w-full rounded border border-[#2a384f] bg-[#070a10]/90 px-3 py-2 text-sm text-[#e8ecf2] font-mono focus:border-[#22d3ee] focus:outline-none"
                      />
                    </div>

                    {authError && (
                      <div className="rounded border border-[#dc2626] bg-[#9e1b24]/20 px-3 py-2 text-xs text-[#fca5a5]">
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full rounded bg-[#9e1b24] hover:bg-[#b8202b] disabled:opacity-50 px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-lg shadow-[#9e1b24]/25 transition cursor-pointer"
                    >
                      {authLoading
                        ? 'AUTHENTICATING...'
                        : authMode === 'login'
                          ? 'ACCESS CASE TERMINAL'
                          : 'ISSUE INVESTIGATOR BADGE'}
                    </button>
                  </form>
                </div>

                <div className="mt-7 pt-5 border-t border-[#222f43]">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1] mb-2.5 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#22d3ee]" />
                    INSTANT DEMO ACCESS
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => quickLogin('detective@casefiles.local', 'DetectivePassword123!')}
                      className="w-full text-left rounded-lg border border-[#26354d] bg-[#0d131e]/90 hover:border-[#22d3ee] px-3.5 py-2.5 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-[#e8ecf2]">
                          Det. Alex Morgan (Investigator)
                        </span>
                        <span className="font-mono text-[10px] text-[#67e8f9]">INV-4409</span>
                      </div>
                      <div className="text-[11px] text-[#8392a8] mt-0.5">
                        Launch Ashford Estate Homicide immediately; test Meridian Express unlock.
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => quickLogin('admin@casefiles.local', 'AdminPassword123!')}
                      className="w-full text-left rounded-lg border border-[#26354d] bg-[#0d131e]/90 hover:border-[#dc2626] px-3.5 py-2.5 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-[#e8ecf2]">
                          Dir. Claire Mercer (Admin CMS)
                        </span>
                        <span className="font-mono text-[10px] text-[#f87171]">ADM-0001</span>
                      </div>
                      <div className="text-[11px] text-[#8392a8] mt-0.5">
                        Create cases, bulk-upload private files, run validator &amp; extend timers.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* DYNAMIC PUBLISHED CASE CATALOG STOREFRONT (SEO PRODUCT LIST) */}
          <section
            id="cases"
            aria-labelledby="cases-heading"
            className="max-w-7xl mx-auto px-5 sm:px-8 py-12 border-t border-[#1d2738]/80"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#22d3ee]">
                  PURCHASABLE CLASSIFIED DOSSIERS
                </div>
                <h2
                  id="cases-heading"
                  className="text-2xl sm:text-3xl font-semibold text-white mt-1"
                >
                  Active Murder Mystery Case Files
                </h2>
                <p className="text-sm text-[#9aa5b8] mt-1.5 max-w-2xl">
                  Every case is independently authored with its own suspects, forensic reports,
                  CCTV archives, hidden vaults, and server-verified solution—loaded live from our
                  central database.
                </p>
              </div>
              <div className="font-mono text-xs text-[#e3a74c]">
                {publicCases.length} PUBLISHED CASE FILE{publicCases.length === 1 ? '' : 'S'} READY
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {publicCases.map((c) => (
                <article
                  key={c.id}
                  className="cyborg-panel rounded-xl overflow-hidden flex flex-col justify-between hover:border-[#22d3ee]/60 transition"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-[#9e1b24]/25 border border-[#dc2626]/60 text-[#fca5a5] font-semibold">
                          {c.caseNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#67e8f9] uppercase">
                          {c.difficulty}
                        </span>
                      </div>
                      <div className="font-mono text-base font-bold text-[#e3a74c]">
                        ${(c.priceCents / 100).toFixed(2)}{' '}
                        <span className="text-[10px] font-normal text-[#7f8ca1]">{c.currency}</span>
                      </div>
                    </div>

                    <div className="font-mono text-[10px] tracking-[0.16em] text-[#72829b] uppercase">
                      {c.classification}
                    </div>
                    <h3 className="text-xl font-semibold text-white mt-1">
                      <Link
                        href={`/case-files/${c.slug}`}
                        className="hover:text-[#67e8f9] transition"
                      >
                        {c.title}
                      </Link>
                    </h3>
                    {c.subtitle && <p className="text-xs text-[#e3a74c] mt-0.5">{c.subtitle}</p>}
                    <p className="text-sm text-[#a6b2c6] mt-3 leading-relaxed">{c.summary}</p>

                    <div className="mt-5 grid grid-cols-3 gap-2.5 font-mono">
                      <div className="rounded border border-[#223047] bg-[#090d15]/90 px-3 py-2">
                        <div className="text-[10px] text-[#72829b] flex items-center gap-1">
                          <FileSearch className="w-3 h-3 text-[#22d3ee]" /> EXHIBITS
                        </div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                          {c.evidenceCount}
                        </div>
                      </div>
                      <div className="rounded border border-[#223047] bg-[#090d15]/90 px-3 py-2">
                        <div className="text-[10px] text-[#72829b] flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#e3a74c]" /> PROFILES
                        </div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                          {c.suspectCount}
                        </div>
                      </div>
                      <div className="rounded border border-[#223047] bg-[#090d15]/90 px-3 py-2">
                        <div className="text-[10px] text-[#72829b] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#dc2626]" /> WINDOW
                        </div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                          {Math.round(c.defaultDurationSeconds / 3600)}H
                        </div>
                      </div>
                    </div>

                    {c.metadata?.tags?.length ? (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {c.metadata.tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#0e1522] border border-[#233148] text-[#8fa1bd]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-[#202d42] bg-[#070b12]/90 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={`/case-files/${c.slug}`}
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-[#67e8f9] hover:text-white transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> INSPECT PUBLIC DOSSIER
                    </Link>

                    <a
                      href="#terminal-access"
                      className="inline-flex items-center gap-1.5 rounded bg-[#9e1b24] hover:bg-[#b8202b] px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-white transition"
                    >
                      UNLOCK IN TERMINAL <ChevronRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* FORENSIC ENGINE CAPABILITIES (HIGH-INTENT COMMERCIAL SEO) */}
          <section
            id="forensic-engine"
            aria-labelledby="engine-heading"
            className="max-w-7xl mx-auto px-5 sm:px-8 py-12 border-t border-[#1d2738]/80"
          >
            <div className="mb-8">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e3a74c]">
                REUSABLE INVESTIGATION ARCHITECTURE
              </div>
              <h2
                id="engine-heading"
                className="text-2xl sm:text-3xl font-semibold text-white mt-1"
              >
                Built Like a Real Homicide Intelligence Terminal
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: Cpu,
                  accent: 'text-[#22d3ee]',
                  title: 'Universal 8-Format Evidence Viewer',
                  desc: 'Examine native PDFs, zoomable crime-scene blueprints with clickable hotspots, waveform audio wiretaps, night-vision CCTV reels, searchable transcripts, sortable spreadsheets, encrypted chats, and forensic metadata.',
                },
                {
                  icon: Network,
                  accent: 'text-[#dc2626]',
                  title: 'Interactive Detective Connection Board',
                  desc: 'Drag suspects and exhibits onto a zoomable forensic grid, pin hypothesis notes, and link leads with color-coded contradiction, motive, and timeline strings auto-saved to the cloud.',
                },
                {
                  icon: CalendarClock,
                  accent: 'text-[#e3a74c]',
                  title: 'Timeline Reconstruction & Alibi Audit',
                  desc: 'Sequence critical movements between verified chronological anchors, cross-check suspect alibi windows, and feed your verified chronology straight into your final arrest warrant.',
                },
                {
                  icon: Users,
                  accent: 'text-[#67e8f9]',
                  title: 'Live Suspect Intelligence Rail',
                  desc: 'Cross-reference suspect profiles, relationship graphs, recorded contradictions, suspicion indices, and private field notes while inspecting any exhibit—without ever spoiling the solution.',
                },
                {
                  icon: ShieldCheck,
                  accent: 'text-[#6ee7b7]',
                  title: 'Private Signed Asset Vault',
                  desc: 'Every evidence exhibit, crime scene plate, and audio file is stored in private object storage and delivered exclusively via expiring, user-bound cryptographic signatures.',
                },
                {
                  icon: Gavel,
                  accent: 'text-[#f87171]',
                  title: 'Server-Authoritative Scoring Engine',
                  desc: 'Submit your Final Accusation naming perpetrator, motive, execution method, timeline, and supporting exhibits to receive an immediate forensic grade, detective rank, and declassified debrief.',
                },
              ].map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="cyborg-panel rounded-xl p-5 space-y-2.5 hover:border-[#22d3ee]/50 transition"
                  >
                    <Icon className={`w-5 h-5 ${feat.accent}`} />
                    <h3 className="font-mono text-sm font-semibold text-white">{feat.title}</h3>
                    <p className="text-xs text-[#9aa5b8] leading-relaxed">{feat.desc}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* HOW IT WORKS — 4-STEP MISSION FLOW */}
          <section
            id="how-it-works"
            aria-labelledby="how-heading"
            className="max-w-7xl mx-auto px-5 sm:px-8 py-12 border-t border-[#1d2738]/80"
          >
            <div className="mb-8">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#22d3ee]">
                OPERATIONAL PROTOCOL
              </div>
              <h2 id="how-heading" className="text-2xl sm:text-3xl font-semibold text-white mt-1">
                How Every Investigation Works
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['01', 'Unlock Classified Case', 'Create your investigator badge and unlock any published murder mystery dossier with instant browser access.'],
                ['02', 'Initiate 4-Hour Clock', 'Your server-authoritative clock stays on standby until you click Start—continuing cleanly across reloads.'],
                ['03', 'Investigate & Decrypt', 'Cross-examine CCTV, audio, digital forensics, and suspect alibis to unlock encrypted vaults and map the crime.'],
                ['04', 'File Final Accusation', 'Submit killer, motive, method, timeline, and decisive exhibits to earn your official Forensic Evaluation Report.'],
              ].map(([step, title, body]) => (
                <div key={step} className="cyborg-panel rounded-xl p-5 space-y-2">
                  <div className="font-mono text-2xl font-bold text-[#22d3ee] neon-text-cyan">
                    {step}
                  </div>
                  <h3 className="font-mono text-xs uppercase tracking-wider font-semibold text-white">
                    {title}
                  </h3>
                  <p className="text-xs text-[#9aa5b8] leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* STRUCTURED COMMERCIAL FAQ (MATCHES JSON-LD FAQPage 1:1) */}
          <section
            id="faq"
            aria-labelledby="faq-heading"
            className="max-w-4xl mx-auto px-5 sm:px-8 py-12 border-t border-[#1d2738]/80"
          >
            <div className="text-center mb-8">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e3a74c]">
                INTELLIGENCE BRIEFING FAQ
              </div>
              <h2 id="faq-heading" className="text-2xl sm:text-3xl font-semibold text-white mt-1">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {COMMERCIAL_FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group cyborg-panel rounded-xl px-5 py-4 open:border-[#22d3ee]/60 transition"
                >
                  <summary className="list-none flex items-center justify-between gap-4 cursor-pointer font-medium text-sm text-white">
                    <span>{faq.question}</span>
                    <ChevronDown className="w-4 h-4 text-[#22d3ee] shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[#a6b2c6] leading-relaxed border-t border-[#1f2c40] pt-3">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </main>

        {/* Commercial Semantic Footer */}
        <footer className="border-t border-[#1d2738] bg-[#060910]/90 backdrop-blur px-6 py-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <BrandLogo variant="wordmark" size="sm" />
              <p className="font-mono text-[10px] tracking-[0.15em] text-[#6a7992] uppercase">
                PROJECT X FILES // CLASSIFIED — SIGNED PRIVATE EVIDENCE DELIVERY · POSTGRESQL DYNAMIC ENGINE
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-[#8d9cb4]">
              {publicCases.map((c) => (
                <Link
                  key={c.id}
                  href={`/case-files/${c.slug}`}
                  className="hover:text-[#22d3ee] transition"
                >
                  {c.caseNumber}: {c.title}
                </Link>
              ))}
              <a href="/sitemap.xml" className="hover:text-[#e3a74c] transition">
                SITEMAP
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED INVESTIGATOR CASE DIRECTORY
  // =========================================================================
  return (
    <div className="min-h-screen text-[#e8ecf2]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#223047] bg-[#070a12]/88 backdrop-blur-md px-5 py-2.5 flex items-center justify-between gap-4">
        <BrandLogo
          variant="wordmark"
          size="sm"
          subtitle="ACTIVE CASE ARCHIVE // MULTI-CASE ENGINE"
        />

        <div className="flex items-center gap-3">
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded border border-[#c88a2e]/60 bg-[#c88a2e]/15 hover:bg-[#c88a2e]/25 px-3 py-1.5 font-mono text-xs text-[#e3a74c] transition"
            >
              <Settings className="w-3.5 h-3.5" />
              ADMINISTRATOR CMS
            </Link>
          )}

          <div className="hidden sm:flex items-center gap-2.5 rounded border border-[#243248] bg-[#0e1420]/90 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse" />
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
            className="inline-flex items-center gap-1.5 rounded border border-[#2a384f] hover:border-[#dc2626] bg-[#0e1420]/90 px-3 py-1.5 font-mono text-xs text-[#9aa5b8] hover:text-white transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            SIGN OUT
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#223047]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#22d3ee] mb-1">
              CENTRAL CASE DIRECTORY
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
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
          <div className="py-20 text-center font-mono text-xs text-[#67e8f9] tracking-widest">
            SYNCHRONIZING ENCRYPTED CASE ARCHIVE...
          </div>
        ) : (
          <div className="mt-7 grid md:grid-cols-2 gap-6">
            {cases.map((c) => (
              <div
                key={c.id}
                className="cyborg-panel rounded-xl hover:border-[#22d3ee]/60 transition flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#9e1b24]/25 border border-[#dc2626]/60 text-[#fca5a5]">
                        {c.caseNumber}
                      </span>
                      <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-[#22d3ee]/10 border border-[#22d3ee]/40 text-[#67e8f9]">
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
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-[#e3a74c]">
                        <Lock className="w-3 h-3" /> ${(c.priceCents / 100).toFixed(2)} {c.currency}
                      </span>
                    )}
                  </div>

                  <div className="font-mono text-[10px] tracking-[0.16em] text-[#72829b] uppercase">
                    {c.classification}
                  </div>
                  <h2 className="text-xl font-semibold text-white mt-1">{c.title}</h2>
                  <p className="text-xs text-[#e3a74c] mt-0.5">{c.subtitle}</p>
                  <p className="text-sm text-[#a6b2c6] mt-3 leading-relaxed">{c.summary}</p>

                  <div className="mt-5 grid grid-cols-3 gap-2.5">
                    <div className="rounded border border-[#223047] bg-[#090d15]/90 px-3 py-2">
                      <div className="font-mono text-[10px] text-[#72829b] flex items-center gap-1">
                        <FileSearch className="w-3 h-3 text-[#22d3ee]" /> EXHIBITS
                      </div>
                      <div className="font-mono text-sm font-semibold mt-0.5">{c.evidenceCount}</div>
                    </div>
                    <div className="rounded border border-[#223047] bg-[#090d15]/90 px-3 py-2">
                      <div className="font-mono text-[10px] text-[#72829b] flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#e3a74c]" /> PROFILES
                      </div>
                      <div className="font-mono text-sm font-semibold mt-0.5">{c.suspectCount}</div>
                    </div>
                    <div className="rounded border border-[#223047] bg-[#090d15]/90 px-3 py-2">
                      <div className="font-mono text-[10px] text-[#72829b] flex items-center gap-1">
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

                <div className="border-t border-[#202d42] bg-[#070b12]/90 px-6 py-4 flex items-center justify-between gap-3">
                  <div className="font-mono text-[11px] text-[#7f8ca1]">
                    STATUS:{' '}
                    <span
                      className={
                        c.sessionStatus === 'active'
                          ? 'text-[#67e8f9]'
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
