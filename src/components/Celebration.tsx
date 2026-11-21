"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { beep, useSound, vibrate } from "@/lib/feedback";

/** What is being celebrated: a big title, the number and a line under it. */
export type Cheer = { eyebrow: string; title: string; value?: string; detail?: string; icon?: string };

const Celebrate = createContext<(cheer: Cheer) => void>(() => {});

/** Confetti, a fanfare and a card over everything (a new PR, a badge earned). */
export const useCelebrate = () => useContext(Celebrate);

const COLORS = ["#14d2bd", "#5ff5e4", "#b9c0c2", "#eef2f2", "#f5c542"];

/** Confetti bursting from the top center and falling, on a canvas over the page (about 3 s). */
function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    element.width = width * ratio;
    element.height = height * ratio;
    context.scale(ratio, ratio);

    const pieces = Array.from({ length: 140 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 7 + Math.random() * 9;
      return {
        x: width / 2,
        y: height * 0.32,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        spin: Math.random() * Math.PI,
        spinSpeed: (Math.random() - 0.5) * 0.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });

    let frame = 0;
    let id = 0;
    const draw = () => {
      frame++;
      context.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.vy += 0.28;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += p.spinSpeed;
        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.spin);
        context.globalAlpha = Math.max(0, 1 - frame / 190);
        context.fillStyle = p.color;
        context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        context.restore();
      }
      if (frame < 190) id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[70] size-full" />;
}

function CheerCard({ cheer, onClose }: { cheer: Cheer; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 4200);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/50 px-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="alertdialog"
      aria-live="assertive"
      aria-label={`${cheer.eyebrow}: ${cheer.title}`}
    >
      <motion.div
        initial={{ scale: 0.6, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-accent/60 bg-card p-6 text-center shadow-[0_0_80px_-10px_var(--accent)]"
      >
        <motion.div
          aria-hidden
          className="absolute inset-x-0 -top-24 mx-auto size-56 rounded-full bg-accent/25 blur-3xl"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        {cheer.icon && (
          <motion.p
            className="relative text-5xl"
            initial={{ rotate: -30, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
          >
            {cheer.icon}
          </motion.p>
        )}
        <p className="relative mt-2 font-display text-sm font-bold tracking-[0.3em] text-accent uppercase">{cheer.eyebrow}</p>
        <p className="relative mt-1 font-display text-3xl leading-tight font-extrabold uppercase">{cheer.title}</p>
        {cheer.value && (
          <motion.p
            className="relative mt-3 font-display text-6xl leading-none font-extrabold text-accent tabular-nums drop-shadow-[0_0_20px_var(--accent)]"
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }}
          >
            {cheer.value}
          </motion.p>
        )}
        {cheer.detail && <p className="relative mt-3 text-sm text-muted">{cheer.detail}</p>}
        <p className="relative mt-5 text-xs tracking-widest text-muted/70 uppercase">Tocá para seguir</p>
      </motion.div>
    </motion.div>
  );
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [cheer, setCheer] = useState<(Cheer & { id: number }) | null>(null);
  const sound = useSound();
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const celebrate = useCallback((next: Cheer) => {
    setCheer((current) => ({ ...next, id: (current?.id ?? 0) + 1 }));
    vibrate([60, 40, 60, 40, 180]);
    // A rising fanfare: C–E–G–C.
    if (soundRef.current) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, i === 3 ? 0.45 : 0.14), i * 120));
  }, []);
  const close = useCallback(() => setCheer(null), []);

  return (
    <Celebrate value={celebrate}>
      {children}
      <AnimatePresence>{cheer && <CheerCard key={cheer.id} cheer={cheer} onClose={close} />}</AnimatePresence>
      {cheer && <Confetti key={`c${cheer.id}`} />}
    </Celebrate>
  );
}
