"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { audit, clientIp } from "@/lib/audit";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { failure, type ActionState } from "@/lib/actions";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

export async function signInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ip = (await clientIp()) ?? "unknown";
  const limit = await rateLimit(RATE_LIMITS.adminSignInPerIp, ip);
  if (!limit.allowed) {
    await audit("security.rate_limited", { entityType: "auth" });
    return failure(`Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`);
  }
  const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return failure("Enter your email address and password.");

  try {
    const res = await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
    await audit("auth.sign_in", { actorUserId: res.user.id, entityType: "user", entityId: res.user.id });
  } catch {
    // Same message for unknown email, wrong password or deactivated account.
    await audit("auth.sign_in_failed", { entityType: "auth", metadata: { emailDomain: parsed.data.email.split("@")[1] } });
    return failure("Email or password is incorrect.");
  }
  redirect("/admin");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
