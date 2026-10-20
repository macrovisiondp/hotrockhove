"use server";

import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, str, success, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { invalidate } from "@/domain/content";
import { linkHref } from "@/domain/sections";

const uuid = z.string().uuid();
const itemSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(40, "Keep labels short (max 40)"),
  href: linkHref.refine((v) => v !== "", "Link is required"),
  visible: z.boolean(),
});

export async function saveNavItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("nav.edit");
    const id = str(fd, "id");
    const location = str(fd, "location") === "footer" ? "footer" : "header";
    const parsed = itemSchema.safeParse({ label: str(fd, "label"), href: str(fd, "href"), visible: id ? bool(fd, "visible") : true });
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return failure(i.message, { [String(i.path[0])]: i.message });
    }
    if (id) {
      if (!uuid.safeParse(id).success) return failure("Unknown item.");
      await db.update(t.navItems).set(parsed.data).where(eq(t.navItems.id, id));
    } else {
      const [last] = await db.select({ s: t.navItems.sortOrder }).from(t.navItems).where(eq(t.navItems.location, location)).orderBy(desc(t.navItems.sortOrder)).limit(1);
      await db.insert(t.navItems).values({ ...parsed.data, location, sortOrder: (last?.s ?? 0) + 10 });
    }
    invalidate("nav");
    await audit("nav.update", { actorUserId: user.id, entityType: "nav", entityId: id || undefined, metadata: { location, label: parsed.data.label } });
    return success(id ? "Saved." : "Link added.");
  });
}

export async function deleteNavItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("nav.edit");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown item.");
    await db.delete(t.navItems).where(eq(t.navItems.id, id));
    invalidate("nav");
    await audit("nav.update", { actorUserId: user.id, entityType: "nav", entityId: id, metadata: { deleted: true } });
    return success("Removed.");
  });
}

export async function moveNavItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertPermission("nav.edit");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown item.");
    const [row] = await db.select().from(t.navItems).where(eq(t.navItems.id, id));
    if (!row) return failure("Unknown item.");
    const up = str(fd, "dir") === "up";
    const [other] = await db
      .select()
      .from(t.navItems)
      .where(and(eq(t.navItems.location, row.location), up ? lt(t.navItems.sortOrder, row.sortOrder) : gt(t.navItems.sortOrder, row.sortOrder)))
      .orderBy(up ? desc(t.navItems.sortOrder) : asc(t.navItems.sortOrder))
      .limit(1);
    if (other) {
      await db.update(t.navItems).set({ sortOrder: other.sortOrder }).where(eq(t.navItems.id, row.id));
      await db.update(t.navItems).set({ sortOrder: row.sortOrder }).where(eq(t.navItems.id, other.id));
      invalidate("nav");
    }
    return success("Moved.");
  });
}
