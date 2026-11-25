'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, AlertTriangle, Video } from 'lucide-react';
import type { CctvReelPayload } from '@/lib/db/asset-generators';
import type { CctvReelEvent } from '@/lib/types';

function addSecondsToClock(startClock: string, offsetSec: number): string {
  const parts = startClock.split(':').map(Number);
  const total = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0) + Math.floor(offsetSec);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CctvCanvasPlayer({
  assetUrl,
  mimeType,
  fallbackMarkers,
}: {
  assetUrl: string;
  mimeType: string;
  fallbackMarkers?: CctvReelEvent[];
}) {
  const isNativeVideo = mimeType.startsWith('video/');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [reel, setReel] = useState<CctvReelPayload | null>(null);
  const [loadError, setLoadError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [irEnhance, setIrEnhance] = useState(false);

  // Load signed telemetry reel JSON for procedural forensic CCTV feeds
  useEffect(() => {
    if (isNativeVideo) return;
    let cancelled = false;
    setLoadError('');
    fetch(assetUrl, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Unable to stream signed CCTV telemetry.');
        return res.json();
      })
      .then((data: CctvReelPayload) => {
        if (!cancelled) {
          setReel(data);
          setCurrentSec(0);
          setPlaying(false);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Stream failed.');
      });
    return () => {
      cancelled = true;
    };
  }, [assetUrl, isNativeVideo]);

  // Animation loop for forensic CCTV telemetry canvas
  useEffect(() => {
    if (isNativeVideo || !reel || !playing) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = ((now - lastTs) / 1000) * speed;
      lastTs = now;
      setCurrentSec((prev) => {
        const next = prev + dt;
        if (next >= reel.durationSeconds) {
          setPlaying(false);
          return reel.durationSeconds;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isNativeVideo, reel, playing, speed]);

  // Draw current CCTV frame
  useEffect(() => {
    if (isNativeVideo || !reel || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background IR / low-light camera feed
    ctx.fillStyle = irEnhance ? '#061510' : reel.lightingMode === 'ir_night' ? '#090d11' : '#0b0e14';
    ctx.fillRect(0, 0, w, h);

    // Architectural perspective corridor lines
    ctx.strokeStyle = irEnhance ? 'rgba(74, 222, 128, 0.28)' : 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(110, 80, w - 220, h - 160);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(110, 80);
    ctx.moveTo(w, 0);
    ctx.lineTo(w - 110, 80);
    ctx.moveTo(0, h);
    ctx.lineTo(110, h - 80);
    ctx.moveTo(w, h);
    ctx.lineTo(w - 110, h - 80);
    ctx.stroke();

    // Door / Gate reference outline
    ctx.strokeStyle = 'rgba(200, 138, 46, 0.45)';
    ctx.strokeRect(w * 0.74, h * 0.34, 88, 145);
    ctx.fillStyle = 'rgba(200, 138, 46, 0.75)';
    ctx.font = '10px monospace';
    ctx.fillText(reel.corridorLabel, w * 0.64, h * 0.31);

    // Subtle procedural sensor grain & scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }

    // Active motion tracks at currentSec
    let motionDetected = false;
    for (const track of reel.tracks) {
      if (currentSec < track.startSec || currentSec > track.endSec) continue;
      motionDetected = true;
      const progress = Math.max(
        0,
        Math.min(1, (currentSec - track.startSec) / Math.max(0.1, track.endSec - track.startSec)),
      );
      const cx = (track.fromX + (track.toX - track.fromX) * progress) * w;
      const cy = (track.fromY + (track.toY - track.fromY) * progress) * h;

      if (track.kind === 'person') {
        // Gloved/hooded IR silhouette
        ctx.fillStyle = irEnhance ? 'rgba(134, 239, 172, 0.85)' : 'rgba(215, 226, 240, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy - 36, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - 14, cy - 24, 28, 44);
        ctx.fillRect(cx - 12, cy + 20, 9, 26);
        ctx.fillRect(cx + 3, cy + 20, 9, 26);
        // Satchel outline
        ctx.fillStyle = '#c88a2e';
        ctx.fillRect(cx + 12, cy - 6, 14, 16);
      } else if (track.kind === 'vehicle') {
        ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
        ctx.fillRect(cx - 46, cy - 16, 92, 30);
        ctx.fillStyle = '#111827';
        ctx.fillRect(cx - 28, cy - 12, 46, 12);
        // Taillights / headlights hint
        ctx.fillStyle = currentSec >= 20 && currentSec <= 33 ? '#374151' : '#ef4444';
        ctx.fillRect(cx - 46, cy - 10, 5, 16);
      } else if (track.kind === 'door_flash') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.85)';
        ctx.beginPath();
        ctx.arc(cx, cy, 10 + Math.sin(currentSec * 14) * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (track.alertBox) {
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - 34, cy - 54, 72, 106);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(cx - 34, cy - 70, 175, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(track.label, cx - 30, cy - 58);
      }
    }

    // Camera OSD HUD
    ctx.fillStyle = 'rgba(7, 8, 11, 0.72)';
    ctx.fillRect(14, 14, 340, 44);
    ctx.fillRect(w - 230, 14, 216, 44);

    ctx.fillStyle = '#e8ecf2';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(reel.cameraId, 24, 32);
    ctx.fillStyle = '#9aa5b8';
    ctx.font = '10px monospace';
    ctx.fillText(reel.location, 24, 49);

    const liveClock = addSecondsToClock(reel.startClock, currentSec);
    ctx.fillStyle = motionDetected ? '#f87171' : '#6ee7b7';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${reel.recordedDate} ${liveClock}`, w - 218, 32);
    ctx.fillStyle = motionDetected ? '#dc2626' : '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(
      motionDetected ? '● MOTION ALERT DETECTED' : `● REC ${reel.fps}FPS  ${speed.toFixed(2)}X`,
      w - 218,
      49,
    );
  }, [isNativeVideo, reel, currentSec, speed, irEnhance]);

  if (isNativeVideo) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-[#242c3b] bg-black overflow-hidden relative">
          <video
            ref={videoRef}
            src={assetUrl}
            controls
            className="w-full max-h-[420px] bg-black"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-[#7f8ca1]">SPEED:</span>
          {[0.25, 0.5, 1, 1.5, 2].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setSpeed(r);
                if (videoRef.current) videoRef.current.playbackRate = r;
              }}
              className={`px-2 py-1 rounded border cursor-pointer ${
                speed === r
                  ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                  : 'border-[#262f40] bg-[#12161f] text-[#9aa5b8]'
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded border border-[#9e1b24] bg-[#9e1b24]/10 p-6 font-mono text-xs text-[#fca5a5]">
        {loadError}
      </div>
    );
  }

  if (!reel) {
    return (
      <div className="rounded border border-[#242c3b] bg-[#0b0e14] p-12 text-center font-mono text-xs text-[#7f8ca1]">
        BUFFERING SIGNED CCTV ARCHIVE STREAM...
      </div>
    );
  }

  const markers = reel.markers?.length ? reel.markers : fallbackMarkers ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded border border-[#273042] bg-[#05070a] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={760}
          height={400}
          className="w-full h-auto block"
        />
      </div>

      {/* Forensic Scrubber & Transport Controls */}
      <div className="rounded border border-[#242c3b] bg-[#10141c] p-3.5 space-y-3">
        <div className="relative">
          <input
            type="range"
            min={0}
            max={reel.durationSeconds}
            step={0.1}
            value={currentSec}
            onChange={(e) => setCurrentSec(parseFloat(e.target.value))}
            className="w-full accent-[#9e1b24] cursor-pointer"
          />
          <div className="flex justify-between font-mono text-[10px] text-[#7f8ca1] mt-0.5">
            <span>{reel.startClock} UTC</span>
            <span className="text-[#e3a74c]">
              +{currentSec.toFixed(1)}s / {reel.durationSeconds}s
            </span>
            <span>{addSecondsToClock(reel.startClock, reel.durationSeconds)} UTC</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded bg-[#9e1b24] hover:bg-[#b5222c] px-3 py-1.5 font-mono text-xs text-white cursor-pointer"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {playing ? 'PAUSE' : 'PLAY'}
            </button>
            <button
              type="button"
              onClick={() => setCurrentSec((s) => Math.max(0, s - 1))}
              className="rounded border border-[#2a3345] bg-[#151a24] px-2.5 py-1.5 font-mono text-xs text-[#cbd5e1] hover:border-[#c88a2e] cursor-pointer"
              title="Step Back 1s"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentSec((s) => Math.min(reel.durationSeconds, s + 1))}
              className="rounded border border-[#2a3345] bg-[#151a24] px-2.5 py-1.5 font-mono text-xs text-[#cbd5e1] hover:border-[#c88a2e] cursor-pointer"
              title="Step Forward 1s"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setCurrentSec(0);
              }}
              className="rounded border border-[#2a3345] bg-[#151a24] px-2.5 py-1.5 font-mono text-xs text-[#cbd5e1] hover:border-[#c88a2e] cursor-pointer"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {[0.25, 0.5, 1, 2].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSpeed(r)}
                className={`px-2 py-1 rounded border cursor-pointer ${
                  speed === r
                    ? 'border-[#c88a2e] bg-[#c88a2e]/20 text-[#e3a74c]'
                    : 'border-[#262f40] bg-[#151a24] text-[#9aa5b8]'
                }`}
              >
                {r}x
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIrEnhance((v) => !v)}
              className={`ml-1 px-2.5 py-1 rounded border cursor-pointer ${
                irEnhance
                  ? 'border-[#2e7d5b] bg-[#2e7d5b]/25 text-[#86efac]'
                  : 'border-[#262f40] bg-[#151a24] text-[#9aa5b8]'
              }`}
            >
              IR BOOST
            </button>
          </div>
        </div>
      </div>

      {/* Forensic Incident Markers */}
      {markers.length > 0 && (
        <div className="rounded border border-[#222937] bg-[#0e1218] p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8ca1] mb-2 flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-[#c88a2e]" />
            FORENSIC EVENT MARKERS (CLICK TO JUMP)
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {markers.map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setCurrentSec(m.second);
                  setPlaying(true);
                }}
                className={`text-left rounded border px-3 py-2 transition cursor-pointer ${
                  m.severity === 'critical'
                    ? 'border-[#9e1b24]/60 bg-[#9e1b24]/10 hover:bg-[#9e1b24]/20'
                    : m.severity === 'alert'
                      ? 'border-[#c88a2e]/50 bg-[#c88a2e]/10 hover:bg-[#c88a2e]/20'
                      : 'border-[#242c3b] bg-[#141821] hover:border-[#3b4760]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="font-semibold text-[#e8ecf2] flex items-center gap-1">
                    {m.severity === 'critical' && (
                      <AlertTriangle className="w-3 h-3 text-[#f87171]" />
                    )}
                    {m.label}
                  </span>
                  <span className="text-[#c88a2e]">+{m.second}s</span>
                </div>
                <p className="text-[11px] text-[#9aa5b8] mt-1 leading-snug">{m.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
