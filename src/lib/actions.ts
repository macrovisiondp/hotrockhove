import "server-only";
import { z } from "zod";
import { ForbiddenError } from "./session";

/** Uniform result for server actions used with useActionState. */
export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every submission so the client can react (toasts, resets). */
  at?: number;
};

export const idleState: ActionState = { ok: false, message: "" };

export function success(message: string): ActionState {
  return { ok: true, message, at: Date.now() };
}

export function failure(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors, at: Date.now() };
}

export function zodFailure(error: z.ZodError, message = "Please correct the highlighted fields."): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return failure(message, fieldErrors);
}

/**
 * Wrap an admin server action: converts permission errors and unexpected
 * exceptions into a safe message (details go to the server log, not the browser).
 */
export async function guarded(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ForbiddenError) return failure(err.message);
    // redirect()/notFound() throw special errors that must propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error("[action] failed:", (err as Error).message);
    return failure("Something went wrong and nothing was saved. Please try again.");
  }
}

/* -------------------------------------------------------------------------- */
/* FormData helpers                                                           */
/* -------------------------------------------------------------------------- */

export function str(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function bool(fd: FormData, name: string): boolean {
  const v = fd.get(name);
  return v === "on" || v === "true" || v === "1";
}

export function int(fd: FormData, name: string, fallback = 0): number {
  const n = Number.parseInt(str(fd, name), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function lines(fd: FormData, name: string): string[] {
  return str(fd, name)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
