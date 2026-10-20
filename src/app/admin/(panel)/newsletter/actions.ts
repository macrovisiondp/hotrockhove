"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, str, success, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { tokenHash } from "@/domain/newsletter";

const uuid = z.string().uuid();
const email = z.string().trim().toLowerCase().email().max(254);

export async function unsubscribeSubscriberAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("subscribers.manage");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Invalid request.");
    await db.update(t.newsletterSubscribers).set({ status: "unsubscribed", unsubscribedAt: new Date() }).where(eq(t.newsletterSubscribers.id, id));
    await audit("subscriber.update", { actorUserId: user.id, entityType: "subscriber", entityId: id, metadata: { status: "unsubscribed" } });
    return success("Unsubscribed.");
  });
}

export async function deleteSubscriberAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("subscribers.manage");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Invalid request.");
    await db.delete(t.newsletterSubscribers).where(eq(t.newsletterSubscribers.id, id));
    await audit("subscriber.delete", { actorUserId: user.id, entityType: "subscriber", entityId: id });
    return success("Subscriber erased.");
  });
}

/**
 * Import the WordPress newsletter list (Gravity Forms export) as "legacy, unconfirmed".
 * No email is sent. Those addresses are never mailed unless the owner later
 * approves a re-permission campaign (separate decision; see MIGRATION_PLAN §2).
 */
export async function importLegacyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("secrets.edit"); // owner only
    if (!bool(fd, "acknowledge")) return failure("Tick the box to confirm you understand how these addresses may be used.", { acknowledge: "Required" });
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return failure("Choose the CSV file exported from WordPress.");
    if (file.size > 2 * 1024 * 1024) return failure("File is too large (max 2 MB).");
    const text = await file.text();
    const found = new Set<string>();
    for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      const e = email.safeParse(m[0]);
      if (e.success) found.add(e.data);
    }
    if (found.size === 0) return failure("No email addresses were found in that file.");
    let added = 0;
    for (const addr of found) {
      const res = await db
        .insert(t.newsletterSubscribers)
        .values({
          email: addr,
          status: "legacy_unconfirmed",
          source: "import:wordpress",
          consentText: "",
          tokenHash: tokenHash(randomBytes(24).toString("base64url")),
        })
        .onConflictDoNothing({ target: t.newsletterSubscribers.email })
        .returning({ id: t.newsletterSubscribers.id });
      added += res.length;
    }
    await audit("subscriber.update", { actorUserId: user.id, entityType: "subscriber", metadata: { legacyImport: true, found: found.size, added } });
    return success(`Imported ${added} new address(es) as legacy (${found.size - added} already present). No emails were sent.`);
  });
}
