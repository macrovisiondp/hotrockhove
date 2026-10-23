"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BatchResult } from "@/domain/marketing";

type Send = (id: string) => Promise<BatchResult | { error: string }>;

/**
 * Sends a campaign in batches while this page is open, showing progress. Closing
 * the page pauses sending; opening it again resumes where it stopped (nobody is
 * sent the message twice).
 */
export function CampaignRunner({ id, initial, send }: { id: string; initial: BatchResult; send: Send }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const tick = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const r = await send(id).catch(() => ({ error: "Connection lost. Press Resume to continue." }));
    busy.current = false;
    if ("error" in r && !("status" in r)) {
      setError(r.error);
      setRunning(false);
      return;
    }
    const res = r as BatchResult;
    setP(res);
    if (res.error) {
      setError(res.error);
      setRunning(false);
    } else if (res.status !== "sending") {
      setRunning(false);
      router.refresh();
    }
  }, [id, send, router]);

  useEffect(() => {
    if (!running) return;
    let stop = false;
    (async () => {
      while (!stop) {
        await tick();
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
    return () => {
      stop = true;
    };
  }, [running, tick]);

  const done = p.total - p.pending;
  const pct = p.total ? Math.round((done / p.total) * 100) : 100;
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="h-3 w-full overflow-hidden rounded-full bg-[#ece9e4]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Sending progress">
        <div className="h-full bg-[#1c1b19] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm">
        <strong>{p.sent}</strong> sent{p.failed ? <>, <strong>{p.failed}</strong> failed</> : null} of {p.total}
        {running && p.status === "sending" && <span className="text-[#6b665e]"> · Sending… keep this page open</span>}
      </p>
      {error && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}
      {p.status === "sending" && (
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => {
            setError(null);
            setRunning(!running);
          }}
        >
          {running ? "Pause" : "Resume"}
        </button>
      )}
    </div>
  );
}
