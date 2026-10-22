"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";

const PREF = "hr_sound";
const EVENT = "hr-sound-change";
const SIZZLE_VOLUME = 0.35;

/** Used when storage is blocked, so muting still works for this page view. */
let memoryPref: "on" | "off" | null = null;

function readPref(): "on" | "off" {
  if (memoryPref) return memoryPref;
  try {
    return localStorage.getItem(PREF) === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

function writePref(value: "on" | "off") {
  memoryPref = value;
  try {
    localStorage.setItem(PREF, value);
  } catch {
    // Storage blocked: the in-memory value covers this page view.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function fade(audio: HTMLAudioElement, to: number, ms = 600) {
  const steps = 20;
  const step = (to - audio.volume) / steps;
  let n = 0;
  const id = setInterval(() => {
    audio.volume = Math.min(1, Math.max(0, audio.volume + step));
    if (++n >= steps) {
      audio.volume = to;
      clearInterval(id);
    }
  }, ms / steps);
}

/**
 * Homepage atmosphere: a looping sizzle and a single moo on arrival, as on the old site.
 * Browsers usually block sound until the visitor interacts, so playback starts on load
 * where allowed, otherwise on the first tap, click or key press. The button mutes it,
 * and the choice is remembered on this device.
 */
export function HomeSounds({ sizzleUrl, mooUrl }: { sizzleUrl: string; mooUrl: string }) {
  const sizzle = useRef<HTMLAudioElement | null>(null);
  const moo = useRef<HTMLAudioElement | null>(null);
  const started = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const on = useSyncExternalStore(subscribe, readPref, () => "on" as const) === "on";

  useEffect(() => {
    if (sizzleUrl) {
      const a = new Audio(sizzleUrl);
      a.loop = true;
      a.volume = 0;
      a.preload = "auto";
      sizzle.current = a;
    }
    if (mooUrl) {
      const a = new Audio(mooUrl);
      a.volume = 0;
      a.preload = "auto";
      moo.current = a;
    }

    const start = (e?: Event) => {
      // A first click on the mute button itself shouldn't start the sound.
      if (e && button.current?.contains(e.target as Node)) return;
      if (started.current || readPref() === "off") return;
      const plays: Promise<void>[] = [];
      if (sizzle.current) plays.push(sizzle.current.play().then(() => fade(sizzle.current!, SIZZLE_VOLUME, 1200)));
      if (moo.current) plays.push(moo.current.play().then(() => fade(moo.current!, 1)));
      Promise.all(plays)
        .then(() => {
          started.current = true;
          remove();
        })
        .catch(() => {
          // Autoplay blocked: wait for the first interaction.
        });
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const remove = () => events.forEach((e) => window.removeEventListener(e, start));
    events.forEach((e) => window.addEventListener(e, start, { passive: true }));

    const onVisibility = () => {
      if (!sizzle.current || !started.current || readPref() === "off") return;
      if (document.hidden) sizzle.current.pause();
      else sizzle.current.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      remove();
      document.removeEventListener("visibilitychange", onVisibility);
      sizzle.current?.pause();
      moo.current?.pause();
    };
  }, [sizzleUrl, mooUrl]);

  const toggle = () => {
    const next = !on;
    writePref(next ? "on" : "off");
    const a = sizzle.current;
    if (!a) return;
    if (next) {
      started.current = true;
      a.volume = 0;
      a.play().then(() => fade(a, SIZZLE_VOLUME)).catch(() => {});
    } else {
      a.pause();
      moo.current?.pause();
    }
  };

  return (
    <button
      ref={button}
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Mute sound" : "Turn sound on"}
      className="fixed bottom-[84px] left-3 z-[25] inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink-600 bg-ink-950/85 text-bone backdrop-blur-md transition-colors hover:text-bronze lg:bottom-6 lg:left-6"
    >
      {on ? <SpeakerHigh size={20} aria-hidden /> : <SpeakerSlash size={20} aria-hidden />}
    </button>
  );
}
