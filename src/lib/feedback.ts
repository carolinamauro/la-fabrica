"use client";

import { useSyncExternalStore } from "react";

/**
 * Sound and vibration for the gym floor: beeps through Web Audio (iOS only plays them after the
 * context is resumed on a tap) and short vibrations (Android; iOS Safari ignores them).
 */

let audio: AudioContext | null = null;

export function unlockAudio() {
  // iOS: play as media (media volume, and not muted by the silent switch) instead of as an effect.
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  audio ??= new AudioContext();
  void audio.resume();
}

/** Always sounds (the workout timer has to); callers that can be muted check `useSound` first. */
export function beep(frequency: number, seconds: number) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = frequency;
  // Full scale and held (only the tail fades): a square wave can't get louder, and it has to cut
  // through gym music.
  const now = audio.currentTime;
  gain.gain.setValueAtTime(1, now);
  gain.gain.setValueAtTime(1, now + seconds * 0.75);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + seconds);
}

/** A soft two-note chime (a set done), quieter than the timer's beeps. */
export function chime() {
  if (!audio || !soundOn()) return;
  const now = audio.currentTime;
  [660, 990].forEach((frequency, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const start = now + i * 0.09;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    osc.connect(gain).connect(audio!.destination);
    osc.start(start);
    osc.stop(start + 0.26);
  });
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not allowed (e.g. no user gesture yet): silently skip.
  }
}

// --- Sound on/off, remembered on this phone ---

const SOUND_KEY = "lf-sound";
const listeners = new Set<() => void>();

function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Private mode: the choice lasts only for this page.
  }
  listeners.forEach((listener) => listener());
}

export function useSound(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    soundOn,
    () => true,
  );
}
