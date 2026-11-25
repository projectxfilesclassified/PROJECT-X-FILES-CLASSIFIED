'use client';

import React, { useRef, useState } from 'react';
import {
  Plus,
  Link2,
  Trash2,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  StickyNote,
  FileSearch,
  Users,
  X,
} from 'lucide-react';
import type { ClientEvidence, ClientSuspect } from '@/lib/client-types';
import type { BoardEdge, BoardNode, BoardState } from '@/lib/types';

const EDGE_COLORS: Record<BoardEdge['color'], { stroke: string; label: string }> = {
  red: { stroke: '#dc2626', label: 'Contradiction' },
  amber: { stroke: '#e3a74c', label: 'Motive / Link' },
  cyan: { stroke: '#38bdf8', label: 'Timeline' },
  slate: { stroke: '#94a3b8', label: 'Association' },
};

const NODE_BORDERS: Record<BoardNode['color'], string> = {
  red: 'border-[#dc2626] bg-[#1a1014]',
  amber: 'border-[#c88a2e] bg-[#19150f]',
  cyan: 'border-[#3b82a6] bg-[#0f1720]',
  emerald: 'border-[#2e7d5b] bg-[#0f1915]',
  slate: 'border-[#384359] bg-[#141822]',
};

export default function DetectiveBoardView({
  boardState,
  allEvidence,
  suspects,
  onChangeBoard,
  onOpenEvidence,
  onOpenSuspect,
}: {
  boardState: BoardState;
  allEvidence: ClientEvidence[];
  suspects: ClientSuspect[];
  onChangeBoard: (next: BoardState) => void;
  onOpenEvidence: (id: string) => void;
  onOpenSuspect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [edgeColor, setEdgeColor] = useState<BoardEdge['color']>('red');
  const [edgeLabel, setEdgeLabel] = useState('LINKS TO');
  const [dockTab, setDockTab] = useState<'evidence' | 'suspects'>('evidence');

  const zoom = boardState.zoom || 1;

  function addNode(node: Omit<BoardNode, 'id' | 'x' | 'y'>) {
    // Prevent duplicate ref nodes
    if (node.refId && boardState.nodes.some((n) => n.refId === node.refId)) {
      return;
    }
    const count = boardState.nodes.length;
    const col = count % 4;
    const row = Math.floor(count / 4);
    const created: BoardNode = {
      ...node,
      id: `bn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      x: 48 + col * 240,
      y: 44 + row * 150,
    };
    onChangeBoard({ ...boardState, nodes: [...boardState.nodes, created] });
  }

  function addStickyNote() {
    addNode({
      type: 'note',
      title: 'INVESTIGATOR HYPOTHESIS',
      content: 'Click to type deduction, alibi overlap, or open question...',
      color: 'amber',
    });
  }

  function removeNode(nodeId: string) {
    onChangeBoard({
      ...boardState,
      nodes: boardState.nodes.filter((n) => n.id !== nodeId),
      edges: boardState.edges.filter((e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId),
    });
    if (connectFromId === nodeId) setConnectFromId(null);
  }

  function removeEdge(edgeId: string) {
    onChangeBoard({
      ...boardState,
      edges: boardState.edges.filter((e) => e.id !== edgeId),
    });
  }

  function handleNodeClickForConnect(targetId: string) {
    if (!connectFromId) return;
    if (connectFromId === targetId) {
      setConnectFromId(null);
      return;
    }
    const edge: BoardEdge = {
      id: `be-${Date.now().toString(36)}`,
      fromNodeId: connectFromId,
      toNodeId: targetId,
      label: edgeLabel.trim() || EDGE_COLORS[edgeColor].label,
      color: edgeColor,
    };
    onChangeBoard({ ...boardState, edges: [...boardState.edges, edge] });
    setConnectFromId(null);
  }

  function handlePointerDownNode(e: React.PointerEvent, node: BoardNode) {
    if (connectFromId) {
      e.stopPropagation();
      handleNodeClickForConnect(node.id);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('button, textarea, input')) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = (e.clientX - rect.left + (canvasRef.current?.scrollLeft ?? 0)) / zoom;
    const pointerY = (e.clientY - rect.top + (canvasRef.current?.scrollTop ?? 0)) / zoom;
    setDragging({
      nodeId: node.id,
      offsetX: pointerX - node.x,
      offsetY: pointerY - node.y,
    });
  }

  function handlePointerMoveCanvas(e: React.PointerEvent) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pointerX = (e.clientX - rect.left + canvasRef.current.scrollLeft) / zoom;
    const pointerY = (e.clientY - rect.top + canvasRef.current.scrollTop) / zoom;

    const nx = Math.max(12, Math.round(pointerX - dragging.offsetX));
    const ny = Math.max(12, Math.round(pointerY - dragging.offsetY));

    onChangeBoard({
      ...boardState,
      nodes: boardState.nodes.map((n) => (n.id === dragging.nodeId ? { ...n, x: nx, y: ny } : n)),
    });
  }

  function handleDropFromDock(e: React.DragEvent) {
    e.preventDefault();
    const payload = e.dataTransfer.getData('application/x-casefiles-card');
    if (!payload || !canvasRef.current) return;
    try {
      const parsed = JSON.parse(payload) as { kind: 'evidence' | 'suspect'; id: string };
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(16, Math.round((e.clientX - rect.left + canvasRef.current.scrollLeft) / zoom - 95));
      const y = Math.max(16, Math.round((e.clientY - rect.top + canvasRef.current.scrollTop) / zoom - 45));

      if (parsed.kind === 'evidence') {
        const ev = allEvidence.find((item) => item.id === parsed.id);
        if (!ev) return;
        const created: BoardNode = {
          id: `bn-${Date.now().toString(36)}`,
          type: 'evidence',
          refId: ev.id,
          code: ev.evidenceCode,
          title: ev.title,
          subtitle: ev.viewerType.toUpperCase(),
          x,
          y,
          color: ev.isHiddenClue ? 'emerald' : 'slate',
        };
        onChangeBoard({
          ...boardState,
          nodes: boardState.nodes.some((n) => n.refId === ev.id)
            ? boardState.nodes
            : [...boardState.nodes, created],
        });
      } else {
        const sus = suspects.find((item) => item.id === parsed.id);
        if (!sus) return;
        const created: BoardNode = {
          id: `bn-${Date.now().toString(36)}`,
          type: 'suspect',
          refId: sus.id,
          code: sus.suspectCode,
          title: sus.fullName,
          subtitle: sus.occupation,
          x,
          y,
          color: 'red',
        };
        onChangeBoard({
          ...boardState,
          nodes: boardState.nodes.some((n) => n.refId === sus.id)
            ? boardState.nodes
            : [...boardState.nodes, created],
        });
      }
    } catch {
      // ignore invalid drag payload
    }
  }

  function autoArrange() {
    const arranged = boardState.nodes.map((n, idx) => ({
      ...n,
      x: 42 + (idx % 4) * 245,
      y: 42 + Math.floor(idx / 4) * 160,
    }));
    onChangeBoard({ ...boardState, nodes: arranged });
  }

  return (
    <div className="space-y-3">
      {/* Board Toolbar */}
      <div className="rounded-lg border border-[#222937] bg-[#10141c] p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#c88a2e]">
            INTERACTIVE EVIDENCE CONNECTION BOARD
          </div>
          <div className="text-xs text-[#9aa5b8]">
            Drag exhibits or suspects onto the board, arrange freely, and connect leads with forensic strings.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addStickyNote}
            className="inline-flex items-center gap-1.5 rounded border border-[#c88a2e]/60 bg-[#c88a2e]/15 hover:bg-[#c88a2e]/25 px-3 py-1.5 font-mono text-[11px] text-[#e3a74c] cursor-pointer"
          >
            <StickyNote className="w-3.5 h-3.5" /> + HYPOTHESIS NOTE
          </button>

          <div className="flex items-center gap-1 rounded border border-[#283143] bg-[#0a0d13] px-2 py-1">
            <span className="font-mono text-[10px] text-[#7f8ca1]">STRING:</span>
            {(['red', 'amber', 'cyan', 'slate'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEdgeColor(c)}
                className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                  edgeColor === c ? 'border-white scale-110' : 'border-transparent opacity-60'
                }`}
                style={{ backgroundColor: EDGE_COLORS[c].stroke }}
                title={EDGE_COLORS[c].label}
              />
            ))}
            <input
              type="text"
              value={edgeLabel}
              onChange={(e) => setEdgeLabel(e.target.value)}
              className="ml-1 w-24 bg-transparent font-mono text-[10px] text-[#e8ecf2] border-b border-[#2e384b] focus:border-[#c88a2e] focus:outline-none"
              placeholder="Edge label"
            />
          </div>

          <button
            type="button"
            onClick={autoArrange}
            className="rounded border border-[#2a3345] bg-[#151a24] hover:border-[#c88a2e] p-1.5 text-[#cbd5e1] cursor-pointer"
            title="Auto-Arrange Grid"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeBoard({ ...boardState, zoom: Math.max(0.6, +(zoom - 0.1).toFixed(2)) })}
            className="rounded border border-[#2a3345] bg-[#151a24] p-1.5 text-[#cbd5e1] cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-[#9aa5b8] w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => onChangeBoard({ ...boardState, zoom: Math.min(1.4, +(zoom + 0.1).toFixed(2)) })}
            className="rounded border border-[#2a3345] bg-[#151a24] p-1.5 text-[#cbd5e1] cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {connectFromId && (
        <div className="rounded border border-[#dc2626] bg-[#9e1b24]/20 px-4 py-2 font-mono text-xs text-[#fca5a5] flex items-center justify-between">
          <span>
            LINK MODE ACTIVE — Click any destination card on the board to attach a “{edgeLabel}” string.
          </span>
          <button
            type="button"
            onClick={() => setConnectFromId(null)}
            className="underline text-white cursor-pointer"
          >
            CANCEL
          </button>
        </div>
      )}

      <div className="grid xl:grid-cols-12 gap-3">
        {/* Left Drag-and-Drop Asset Dock */}
        <div className="xl:col-span-3 rounded-lg border border-[#222937] bg-[#0e1118] flex flex-col max-h-[600px]">
          <div className="grid grid-cols-2 border-b border-[#222937] font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setDockTab('evidence')}
              className={`py-2.5 flex items-center justify-center gap-1.5 cursor-pointer ${
                dockTab === 'evidence'
                  ? 'bg-[#161c28] text-[#e3a74c] border-b-2 border-[#c88a2e]'
                  : 'text-[#7f8ca1]'
              }`}
            >
              <FileSearch className="w-3.5 h-3.5" /> EXHIBITS ({allEvidence.length})
            </button>
            <button
              type="button"
              onClick={() => setDockTab('suspects')}
              className={`py-2.5 flex items-center justify-center gap-1.5 cursor-pointer ${
                dockTab === 'suspects'
                  ? 'bg-[#161c28] text-[#e3a74c] border-b-2 border-[#c88a2e]'
                  : 'text-[#7f8ca1]'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> SUBJECTS ({suspects.length})
            </button>
          </div>

          <div className="p-2.5 space-y-1.5 overflow-y-auto flex-1">
            {dockTab === 'evidence'
              ? allEvidence.map((ev) => {
                  const onBoard = boardState.nodes.some((n) => n.refId === ev.id);
                  return (
                    <div
                      key={ev.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData(
                          'application/x-casefiles-card',
                          JSON.stringify({ kind: 'evidence', id: ev.id }),
                        )
                      }
                      className="rounded border border-[#222937] bg-[#131822] hover:border-[#c88a2e]/70 p-2 text-xs flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] text-[#e3a74c] font-semibold">
                          {ev.evidenceCode}
                        </div>
                        <div className="text-[11px] text-[#dce2ec] truncate">{ev.title}</div>
                      </div>
                      <button
                        type="button"
                        disabled={onBoard}
                        onClick={() =>
                          addNode({
                            type: 'evidence',
                            refId: ev.id,
                            code: ev.evidenceCode,
                            title: ev.title,
                            subtitle: ev.viewerType.toUpperCase(),
                            color: ev.isHiddenClue ? 'emerald' : 'slate',
                          })
                        }
                        className="shrink-0 rounded border border-[#2e384b] px-1.5 py-1 font-mono text-[10px] text-[#cbd5e1] disabled:opacity-40 hover:border-[#c88a2e] cursor-pointer"
                      >
                        {onBoard ? 'PINNED' : <Plus className="w-3 h-3" />}
                      </button>
                    </div>
                  );
                })
              : suspects.map((sus) => {
                  const onBoard = boardState.nodes.some((n) => n.refId === sus.id);
                  return (
                    <div
                      key={sus.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData(
                          'application/x-casefiles-card',
                          JSON.stringify({ kind: 'suspect', id: sus.id }),
                        )
                      }
                      className="rounded border border-[#222937] bg-[#131822] hover:border-[#9e1b24] p-2 text-xs flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] text-[#f87171] font-semibold">
                          {sus.suspectCode}
                        </div>
                        <div className="text-[11px] text-[#dce2ec] truncate">{sus.fullName}</div>
                      </div>
                      <button
                        type="button"
                        disabled={onBoard}
                        onClick={() =>
                          addNode({
                            type: 'suspect',
                            refId: sus.id,
                            code: sus.suspectCode,
                            title: sus.fullName,
                            subtitle: sus.occupation,
                            color: 'red',
                          })
                        }
                        className="shrink-0 rounded border border-[#2e384b] px-1.5 py-1 font-mono text-[10px] text-[#cbd5e1] disabled:opacity-40 hover:border-[#c88a2e] cursor-pointer"
                      >
                        {onBoard ? 'PINNED' : <Plus className="w-3 h-3" />}
                      </button>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Interactive Forensic Canvas */}
        <div
          ref={canvasRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFromDock}
          onPointerMove={handlePointerMoveCanvas}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
          className="xl:col-span-9 rounded-lg border border-[#262f40] bg-[#080a0e] forensic-grid relative h-[600px] overflow-auto select-none"
        >
          <div
            className="relative"
            style={{
              width: 1400,
              height: 920,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* SVG Forensic Strings Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {boardState.edges.map((edge) => {
                const a = boardState.nodes.find((n) => n.id === edge.fromNodeId);
                const b = boardState.nodes.find((n) => n.id === edge.toNodeId);
                if (!a || !b) return null;
                const ax = a.x + 106;
                const ay = a.y + 44;
                const bx = b.x + 106;
                const by = b.y + 44;
                const mx = (ax + bx) / 2;
                const my = (ay + by) / 2;
                const stroke = EDGE_COLORS[edge.color]?.stroke ?? '#dc2626';
                return (
                  <g key={edge.id}>
                    <line
                      x1={ax}
                      y1={ay}
                      x2={bx}
                      y2={by}
                      stroke={stroke}
                      strokeWidth="2.2"
                      strokeDasharray={edge.color === 'cyan' ? '6 4' : undefined}
                      opacity={0.85}
                    />
                    <circle cx={ax} cy={ay} r="4" fill={stroke} />
                    <circle cx={bx} cy={by} r="4" fill={stroke} />
                    <rect
                      x={mx - 48}
                      y={my - 10}
                      width="96"
                      height="18"
                      rx="3"
                      fill="#0b0e14"
                      stroke={stroke}
                      strokeWidth="1"
                    />
                    <text
                      x={mx}
                      y={my + 3}
                      textAnchor="middle"
                      fill="#e8ecf2"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {edge.label.slice(0, 14)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Clickable Edge Delete Pills */}
            {boardState.edges.map((edge) => {
              const a = boardState.nodes.find((n) => n.id === edge.fromNodeId);
              const b = boardState.nodes.find((n) => n.id === edge.toNodeId);
              if (!a || !b) return null;
              const mx = (a.x + b.x) / 2 + 106;
              const my = (a.y + b.y) / 2 + 44;
              return (
                <button
                  key={`del-${edge.id}`}
                  type="button"
                  onClick={() => removeEdge(edge.id)}
                  style={{ left: mx + 44, top: my - 10 }}
                  className="absolute w-4 h-4 rounded-full bg-[#1a1f2b] border border-[#3a455d] hover:bg-[#dc2626] text-[#cbd5e1] hover:text-white flex items-center justify-center cursor-pointer z-10"
                  title="Remove connection"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              );
            })}

            {boardState.nodes.length === 0 && (
              <div className="absolute top-28 left-1/2 -translate-x-1/2 max-w-md text-center rounded-lg border border-dashed border-[#2f394e] bg-[#0e1219]/90 p-6">
                <div className="font-mono text-xs text-[#e3a74c] uppercase tracking-wider">
                  DETECTIVE BOARD READY
                </div>
                <p className="text-xs text-[#8d99ad] mt-2 leading-relaxed">
                  Drag exhibits or suspect cards from the left dock onto this tactical grid, or
                  click <strong className="text-white">+</strong> to pin items and draw forensic
                  connections.
                </p>
              </div>
            )}

            {/* Draggable Board Cards */}
            {boardState.nodes.map((node) => {
              const isConnectingSource = connectFromId === node.id;
              return (
                <div
                  key={node.id}
                  onPointerDown={(e) => handlePointerDownNode(e, node)}
                  style={{ left: node.x, top: node.y, width: 212 }}
                  className={`absolute rounded-md border p-3 shadow-xl transition-shadow cursor-move ${
                    NODE_BORDERS[node.color]
                  } ${isConnectingSource ? 'ring-2 ring-[#dc2626]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <span className="font-mono text-[10px] font-bold uppercase text-[#e3a74c]">
                      {node.code || node.type}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setConnectFromId(connectFromId === node.id ? null : node.id)
                        }
                        className={`p-1 rounded border cursor-pointer ${
                          isConnectingSource
                            ? 'border-[#dc2626] bg-[#dc2626] text-white'
                            : 'border-[#2f394d] bg-[#0c0f15] text-[#9aa5b8] hover:text-[#e3a74c]'
                        }`}
                        title="Connect String"
                      >
                        <Link2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNode(node.id)}
                        className="p-1 rounded border border-[#2f394d] bg-[#0c0f15] text-[#9aa5b8] hover:text-[#f87171] cursor-pointer"
                        title="Remove from Board"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {node.type === 'note' ? (
                    <textarea
                      rows={3}
                      value={node.content ?? ''}
                      onChange={(e) =>
                        onChangeBoard({
                          ...boardState,
                          nodes: boardState.nodes.map((n) =>
                            n.id === node.id ? { ...n, content: e.target.value } : n,
                          ),
                        })
                      }
                      className="w-full bg-[#090b10]/80 border border-[#2c3547] rounded p-1.5 text-[11px] text-[#fef3c7] focus:border-[#c88a2e] focus:outline-none resize-none"
                    />
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-[#e8ecf2] leading-snug line-clamp-2">
                        {node.title}
                      </div>
                      {node.subtitle && (
                        <div className="font-mono text-[10px] text-[#8894a8] truncate mt-1">
                          {node.subtitle}
                        </div>
                      )}
                      {node.refId && (
                        <button
                          type="button"
                          onClick={() =>
                            node.type === 'evidence'
                              ? onOpenEvidence(node.refId!)
                              : onOpenSuspect(node.refId!)
                          }
                          className="mt-2 font-mono text-[10px] text-[#c88a2e] hover:underline cursor-pointer"
                        >
                          INSPECT FILE →
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
