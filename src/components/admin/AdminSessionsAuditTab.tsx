'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Clock, ShieldCheck, KeyRound, ScrollText, PlusCircle, Ban } from 'lucide-react';
import { formatDurationHms } from '@/lib/client-types';
import type { ServerTimerSnapshot } from '@/lib/engine/timer';

interface AdminSessionRow {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  badgeNumber: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  timer: ServerTimerSnapshot | null;
  viewedCount: number;
  unlockedCount: number;
  updatedAt: string;
}

interface AdminAuditRow {
  id: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  caseId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export default function AdminSessionsAuditTab() {
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; displayName: string; role: string }[]>([]);
  const [cases, setCases] = useState<{ id: string; caseNumber: string; title: string; status: string }[]>([]);
  const [entitlements, setEntitlements] = useState<
    { id: string; userEmail: string; userName: string; caseNumber: string; caseTitle: string; status: string; purchaseRef: string }[]
  >([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  // Timer Extension state
  const [extSessionId, setExtSessionId] = useState('');
  const [extMinutes, setExtMinutes] = useState(30);
  const [extReason, setExtReason] = useState('');

  // Entitlement grant state
  const [grantUserId, setGrantUserId] = useState('');
  const [grantCaseId, setGrantCaseId] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sessions', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
        setUsers(data.users ?? []);
        setCases(data.cases ?? []);
        setEntitlements(data.entitlements ?? []);
        setAuditLogs(data.auditLogs ?? []);
        if (!grantUserId && data.users?.length) setGrantUserId(data.users[0].id);
        if (!grantCaseId && data.cases?.length) setGrantCaseId(data.cases[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [grantUserId, grantCaseId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleExtendTimer(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg('');
    const res = await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'extend_timer',
        sessionId: extSessionId,
        extensionMinutes: Number(extMinutes),
        reason: extReason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(`ERROR: ${data.error}`);
      return;
    }
    setStatusMsg(`Extended timer by +${extMinutes} minutes and recorded immutable audit entry.`);
    setExtReason('');
    setExtSessionId('');
    await loadAll();
  }

  async function handleGrantEntitlement(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg('');
    const res = await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'grant_entitlement',
        userId: grantUserId,
        caseId: grantCaseId,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatusMsg(`Granted active entitlement (${data.purchaseRef}).`);
      await loadAll();
    } else {
      setStatusMsg(`ERROR: ${data.error}`);
    }
  }

  async function handleRevokeEntitlement(entitlementId: string) {
    await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke_entitlement', entitlementId }),
    });
    await loadAll();
  }

  if (loading) {
    return (
      <div className="py-16 text-center font-mono text-xs text-[#7f8ca1]">
        LOADING SESSIONS, ENTITLEMENTS &amp; AUDIT LOGS...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`rounded border px-4 py-2.5 font-mono text-xs ${
            statusMsg.startsWith('ERROR')
              ? 'border-[#dc2626] bg-[#9e1b24]/20 text-[#fca5a5]'
              : 'border-[#2e7d5b] bg-[#2e7d5b]/15 text-[#86efac]'
          }`}
        >
          {statusMsg}
        </div>
      )}

      {/* Active Sessions & Administrative Timer Extension */}
      <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#e3a74c] flex items-center gap-2 font-semibold">
            <Clock className="w-4 h-4" />
            ACTIVE INVESTIGATION SESSIONS &amp; TIMER EXTENSIONS ({sessions.length})
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="text-xs font-mono text-[#7f8ca1] py-4">
            No player investigation sessions initiated yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-[#202736]">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-[#151a25] text-[#8b98ae] text-[10px] uppercase border-b border-[#252e3f]">
                  <th className="px-3 py-2">Investigator</th>
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Extensions</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1d2432]">
                {sessions.map((s) => (
                  <tr key={s.id} className="bg-[#0c1017]">
                    <td className="px-3 py-2">
                      <div className="text-[#e8ecf2] font-sans font-medium">{s.userName}</div>
                      <div className="text-[10px] text-[#728096]">{s.userEmail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[#e3a74c]">{s.caseNumber}</span> · {s.caseTitle}
                    </td>
                    <td className="px-3 py-2 uppercase">{s.timer?.status ?? 'N/A'}</td>
                    <td className="px-3 py-2 text-[#e8ecf2]">
                      {s.timer ? formatDurationHms(s.timer.remainingSeconds) : '--'}
                    </td>
                    <td className="px-3 py-2 text-[#6ee7b7]">
                      +{Math.round((s.timer?.totalExtensionSeconds ?? 0) / 60)}m
                    </td>
                    <td className="px-3 py-2">
                      {s.timer?.status !== 'submitted' && (
                        <button
                          type="button"
                          onClick={() => setExtSessionId(s.id)}
                          className="rounded border border-[#c88a2e]/60 bg-[#c88a2e]/15 hover:bg-[#c88a2e]/25 px-2.5 py-1 text-[10px] text-[#e3a74c] cursor-pointer"
                        >
                          EXTEND TIMER
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {extSessionId && (
          <form
            onSubmit={handleExtendTimer}
            className="rounded border border-[#c88a2e]/60 bg-[#15130f] p-4 grid md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-3">
              <label className="block font-mono text-[10px] text-[#e3a74c] mb-1">
                EXTENSION (MINUTES)
              </label>
              <input
                type="number"
                min={1}
                max={480}
                required
                value={extMinutes}
                onChange={(e) => setExtMinutes(Number(e.target.value))}
                className="w-full rounded border border-[#2c3547] bg-[#090b10] px-3 py-1.5 font-mono text-xs text-white"
              />
            </div>
            <div className="md:col-span-6">
              <label className="block font-mono text-[10px] text-[#e3a74c] mb-1">
                MANDATORY AUDIT REASON
              </label>
              <input
                type="text"
                required
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                placeholder="e.g. Accessibility accommodation / customer support ticket #492"
                className="w-full rounded border border-[#2c3547] bg-[#090b10] px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div className="md:col-span-3 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded bg-[#c88a2e] hover:bg-[#dfa03f] text-[#07080b] font-mono text-xs font-bold py-1.5 cursor-pointer"
              >
                APPLY +{extMinutes}M
              </button>
              <button
                type="button"
                onClick={() => setExtSessionId('')}
                className="rounded border border-[#2a3345] px-2.5 py-1.5 font-mono text-xs text-[#9aa5b8] cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Entitlement Management */}
      <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#e3a74c] flex items-center gap-2 font-semibold">
          <KeyRound className="w-4 h-4" />
          PURCHASE ENTITLEMENTS &amp; ACCESS CONTROL ({entitlements.length})
        </h2>

        <form onSubmit={handleGrantEntitlement} className="grid sm:grid-cols-12 gap-2.5">
          <select
            value={grantUserId}
            onChange={(e) => setGrantUserId(e.target.value)}
            className="sm:col-span-5 rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-xs text-[#e8ecf2]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email}) — {u.role}
              </option>
            ))}
          </select>
          <select
            value={grantCaseId}
            onChange={(e) => setGrantCaseId(e.target.value)}
            className="sm:col-span-5 rounded border border-[#2a3345] bg-[#090b10] px-3 py-2 font-mono text-xs text-[#e8ecf2]"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.caseNumber} — {c.title} ({c.status})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded bg-[#2e7d5b] hover:bg-[#37946c] px-3 py-2 font-mono text-xs font-semibold text-white cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" /> GRANT
          </button>
        </form>

        <div className="grid md:grid-cols-2 gap-2">
          {entitlements.map((ent) => (
            <div
              key={ent.id}
              className="rounded border border-[#202736] bg-[#121620] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
            >
              <div>
                <div className="font-semibold text-[#e8ecf2]">
                  {ent.userName} <span className="font-mono text-[10px] text-[#7f8ca1]">({ent.userEmail})</span>
                </div>
                <div className="font-mono text-[10px] text-[#e3a74c]">
                  {ent.caseNumber} · {ent.caseTitle} · {ent.purchaseRef}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded ${
                    ent.status === 'active'
                      ? 'bg-[#2e7d5b]/25 text-[#86efac]'
                      : 'bg-[#9e1b24]/25 text-[#fca5a5]'
                  }`}
                >
                  {ent.status}
                </span>
                {ent.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => handleRevokeEntitlement(ent.id)}
                    className="text-[#7f8ca1] hover:text-[#f87171] cursor-pointer"
                    title="Revoke Entitlement"
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Immutable Audit Log Viewer */}
      <div className="rounded-lg border border-[#232b3a] bg-[#0f131b] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-[#e3a74c] flex items-center gap-2 font-semibold">
            <ScrollText className="w-4 h-4" />
            SECURITY &amp; GOVERNANCE AUDIT LOG (LAST {auditLogs.length} EVENTS)
          </h2>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#6ee7b7]">
            <ShieldCheck className="w-3.5 h-3.5" /> APPEND-ONLY
          </span>
        </div>

        <div className="max-h-80 overflow-y-auto rounded border border-[#202736] divide-y divide-[#1a202d] font-mono text-[11px]">
          {auditLogs.map((log) => (
            <div key={log.id} className="px-3.5 py-2 bg-[#0b0e14] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[#6d7a90]">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#19202e] text-[#e3a74c] font-semibold">
                  {log.action}
                </span>
                <span className="text-[#9aa5b8]">
                  [{log.actorRole}] → {log.targetType}:{log.targetId.slice(0, 14)}
                </span>
              </div>
              {Object.keys(log.details ?? {}).length > 0 && (
                <div className="text-[10px] text-[#728096] truncate max-w-md">
                  {JSON.stringify(log.details)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
