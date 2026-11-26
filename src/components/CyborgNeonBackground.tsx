'use client';

import React, { useEffect, useRef } from 'react';

interface CircuitNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: 'cyan' | 'red' | 'amber';
  phase: number;
}

interface DataPulse {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  hue: 'cyan' | 'red' | 'amber';
}

const NEON_COLORS = {
  cyan: { rgb: '34, 211, 238', hex: '#22d3ee' },
  red: { rgb: '220, 38, 38', hex: '#dc2626' },
  amber: { rgb: '227, 167, 76', hex: '#e3a74c' },
};

/**
 * Animated, responsive cyborg neon light background:
 * - DPR-aware HTML5 Canvas neural-circuit network with traveling neon energy pulses
 * - Pointer & touch reactive cybernetic reticle + proximity node illumination
 * - Layered ambient neon glow fields and slow biometric laser scan sweep
 * - Respects `prefers-reduced-motion` and scales density smoothly across mobile/tablet/desktop
 */
export default function CyborgNeonBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const pointer = {
      x: width * 0.5,
      y: height * 0.35,
      active: false,
    };

    let nodes: CircuitNode[] = [];
    let pulses: DataPulse[] = [];
    let rafId = 0;

    function initMesh() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (!canvas || !ctx) return;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Responsive node count (lighter on phones, denser on ultrawide desktops)
      const area = width * height;
      const count = Math.max(22, Math.min(68, Math.floor(area / 28000)));
      const hues: ('cyan' | 'red' | 'amber')[] = ['cyan', 'cyan', 'red', 'amber'];

      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        radius: 1.5 + Math.random() * 1.8,
        hue: hues[i % hues.length]!,
        phase: Math.random() * Math.PI * 2,
      }));

      pulses = [];
    }

    function onPointerMove(e: PointerEvent) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    }

    function onPointerLeave() {
      pointer.active = false;
    }

    initMesh();
    window.addEventListener('resize', initMesh, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave, { passive: true });

    let frame = 0;

    function draw(now: number) {
      if (!ctx) return;
      frame++;
      const t = now * 0.001;

      ctx.clearRect(0, 0, width, height);

      // 1. Subtle perspective cybernetic horizon grid
      const gridSize = width < 640 ? 44 : 56;
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 2. Update node drift (skip motion when reduced-motion requested)
      const linkDist = width < 640 ? 135 : 185;
      const pointerDist = width < 640 ? 150 : 230;

      for (const node of nodes) {
        if (!prefersReduced) {
          node.x += node.vx;
          node.y += node.vy;
          if (node.x < -20) node.x = width + 20;
          if (node.x > width + 20) node.x = -20;
          if (node.y < -20) node.y = height + 20;
          if (node.y > height + 20) node.y = -20;
        }
      }

      // 3. Draw angular cyborg circuit links between neighboring nodes
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > linkDist) continue;

          const baseAlpha = (1 - dist / linkDist) * 0.22;
          let boost = 0;
          if (pointer.active) {
            const mx = (a.x + b.x) * 0.5;
            const my = (a.y + b.y) * 0.5;
            const pd = Math.hypot(mx - pointer.x, my - pointer.y);
            if (pd < pointerDist) {
              boost = (1 - pd / pointerDist) * 0.35;
            }
          }

          const col = NEON_COLORS[a.hue].rgb;
          ctx.strokeStyle = `rgba(${col}, ${(baseAlpha + boost).toFixed(3)})`;
          ctx.lineWidth = boost > 0.1 ? 1.35 : 0.85;

          // Orthogonal PCB-style bend for authentic cyborg circuit look
          const midX = a.x + dx * 0.55;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(midX, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          // Occasionally spawn a traveling neon light packet along active links
          if (!prefersReduced && pulses.length < 22 && frame % 12 === 0 && Math.random() < 0.03) {
            pulses.push({
              fromIdx: i,
              toIdx: j,
              progress: 0,
              speed: 0.012 + Math.random() * 0.016,
              hue: a.hue,
            });
          }
        }
      }

      // 4. Render traveling neon energy packets along circuit traces
      if (!prefersReduced) {
        const nextPulses: DataPulse[] = [];
        for (const p of pulses) {
          const a = nodes[p.fromIdx];
          const b = nodes[p.toIdx];
          if (!a || !b) continue;
          p.progress += p.speed;
          if (p.progress >= 1) continue;

          const midX = a.x + (b.x - a.x) * 0.55;
          let px: number;
          let py: number;
          if (p.progress < 0.5) {
            const k = p.progress * 2;
            px = a.x + (midX - a.x) * k;
            py = a.y;
          } else {
            const k = (p.progress - 0.5) * 2;
            px = midX + (b.x - midX) * k;
            py = a.y + (b.y - a.y) * k;
          }

          const col = NEON_COLORS[p.hue];
          ctx.save();
          ctx.shadowBlur = 12;
          ctx.shadowColor = col.hex;
          ctx.fillStyle = `rgba(${col.rgb}, 0.95)`;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          nextPulses.push(p);
        }
        pulses = nextPulses;
      }

      // 5. Render glowing circuit nodes + pointer-reactive cybernetic reticle
      for (const node of nodes) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + node.phase);
        const col = NEON_COLORS[node.hue];
        let nearBoost = 0;

        if (pointer.active) {
          const pd = Math.hypot(node.x - pointer.x, node.y - pointer.y);
          if (pd < pointerDist) {
            nearBoost = 1 - pd / pointerDist;
            // Subtle neural tether to pointer reticle
            if (pd < pointerDist * 0.72) {
              ctx.strokeStyle = `rgba(${col.rgb}, ${(nearBoost * 0.28).toFixed(3)})`;
              ctx.lineWidth = 0.9;
              ctx.beginPath();
              ctx.moveTo(node.x, node.y);
              ctx.lineTo(pointer.x, pointer.y);
              ctx.stroke();
            }
          }
        }

        ctx.save();
        ctx.shadowBlur = nearBoost > 0.15 ? 14 : 6;
        ctx.shadowColor = col.hex;
        ctx.fillStyle = `rgba(${col.rgb}, ${(0.45 + pulse * 0.35 + nearBoost * 0.2).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + nearBoost * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6. Cybernetic target reticle around active pointer
      if (pointer.active) {
        const grad = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          pointerDist * 0.85,
        );
        grad.addColorStop(0, 'rgba(34, 211, 238, 0.11)');
        grad.addColorStop(0.45, 'rgba(220, 38, 38, 0.05)');
        grad.addColorStop(1, 'rgba(7, 8, 11, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, pointerDist * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // Rotating segmented cyborg HUD ring
        ctx.save();
        ctx.translate(pointer.x, pointer.y);
        ctx.rotate(t * 0.45);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
        ctx.lineWidth = 1;
        for (let seg = 0; seg < 4; seg++) {
          ctx.beginPath();
          ctx.arc(0, 0, 22, seg * (Math.PI / 2) + 0.25, (seg + 1) * (Math.PI / 2) - 0.25);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (!prefersReduced) {
        rafId = requestAnimationFrame(draw);
      }
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', initMesh);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#05070b]"
    >
      {/* Ambient breathing neon cyborg light fields */}
      <div className="cyborg-orb cyborg-orb-cyan" />
      <div className="cyborg-orb cyborg-orb-red" />
      <div className="cyborg-orb cyborg-orb-amber" />

      {/* Responsive DPR Neural-Circuit Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full opacity-95" />

      {/* Slow biometric neon laser scan beam */}
      <div className="cyborg-scan-beam" />

      {/* Vignette to preserve crisp forensic text contrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, transparent 32%, rgba(5, 7, 11, 0.72) 100%)',
        }}
      />
    </div>
  );
}
