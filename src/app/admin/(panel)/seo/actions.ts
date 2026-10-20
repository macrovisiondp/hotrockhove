"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, int, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { saveSetting, validateSetting } from "@/lib/settings";
import { invalidate } from "@/domain/content";

const uuid = z.string().uuid();

export async function saveSeoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("seo.edit");
    const parsed = validateSetting("seo", {
      siteTitle: str(fd, "siteTitle"),
      titleTemplate: str(fd, "titleTemplate"),
      defaultDescription: str(fd, "defaultDescription"),
      defaultOgImage: str(fd, "defaultOgImage"),
      allowIndexing: bool(fd, "allowIndexing"),
    });
    if (!parsed.success) return zodFailure(parsed.error);
    await saveSetting("seo", parsed.data, user.id);
    invalidate("pages");
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "seo", metadata: { allowIndexing: parsed.data.allowIndexing } });
    return success(parsed.data.allowIndexing ? "Saved. Search engines may now index the site." : "Saved. Indexing is off.");
  });
}

const redirectSchema = z
  .object({
    fromPath: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^\/[^\s?#]*$/, "Start with / (no domain, no ?query)")
      .max(300)
      .transform((p) => (p.length > 1 ? p.replace(/\/+$/, "") : p))
      .refine((p) => p !== "/" && !p.startsWith("/admin") && !p.startsWith("/api") && !p.startsWith("/_next"), "That path can't be redirected"),
    toPath: z.string().trim().max(500),
    statusCode: z.union([z.literal(301), z.literal(302), z.literal(410)]),
    prefix: z.boolean(),
    enabled: z.boolean(),
    note: z.string().trim().max(200),
  })
  .refine((r) => r.statusCode === 410 || r.toPath === "book" || /^\/(?!\/)\S*$/.test(r.toPath) || /^https:\/\/\S+$/.test(r.toPath), {
    message: "Destination must be a path like /our-menus, an https:// address, or book",
    path: ["toPath"],
  })
  .refine((r) => r.statusCode === 410 || r.toPath.replace(/\/+$/, "") !== r.fromPath, { message: "A redirect can't point to itself", path: ["toPath"] });

export async function saveRedirectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("redirects.edit");
    const id = str(fd, "id");
    const parsed = redirectSchema.safeParse({
      fromPath: str(fd, "fromPath"),
      toPath: str(fd, "toPath"),
      statusCode: int(fd, "statusCode", 301),
      prefix: bool(fd, "prefix"),
      enabled: id ? bool(fd, "enabled") : true,
      note: str(fd, "note"),
    });
    if (!parsed.success) return zodFailure(parsed.error);
    const data = { ...parsed.data, toPath: parsed.data.statusCode === 410 ? "" : parsed.data.toPath };
    // A live page at the old address would be shadowed by the redirect.
    const page = await db.query.pages.findFirst({ where: eq(t.pages.slug, data.fromPath.slice(1)) });
    if (page?.status === "published") return failure(`/${page.slug} is a published page. Unpublish or rename it first.`, { fromPath: "Page exists" });
    try {
      if (id) {
        if (!uuid.safeParse(id).success) return failure("Unknown redirect.");
        await db.update(t.redirects).set(data).where(eq(t.redirects.id, id));
      } else {
        await db.insert(t.redirects).values(data);
      }
    } catch {
      return failure("A redirect for that address already exists.", { fromPath: "Already redirected" });
    }
    invalidate("redirects");
    await audit(id ? "redirect.update" : "redirect.create", { actorUserId: user.id, entityType: "redirect", entityId: id || undefined, metadata: { from: data.fromPath, to: data.toPath, code: data.statusCode } });
    return success("Saved. It takes effect within a minute.");
  });
}

export async function deleteRedirectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("redirects.edit");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown redirect.");
    await db.delete(t.redirects).where(eq(t.redirects.id, id));
    invalidate("redirects");
    await audit("redirect.delete", { actorUserId: user.id, entityType: "redirect", entityId: id });
    return success("Redirect removed.");
  });
}
