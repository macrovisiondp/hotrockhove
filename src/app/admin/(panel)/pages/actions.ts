"use server";

import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { invalidate } from "@/domain/content";
import { sectionsSchema } from "@/domain/sections";

const uuid = z.string().uuid();
const RESERVED = new Set(["admin", "api", "media", "brand", "go", "newsletter", "maintenance", "sitemap.xml", "robots.txt", "_next"]);
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens, e.g. private-dining")
  .max(60)
  .refine((s) => !RESERVED.has(s), "That address is reserved");

const metaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  seoTitle: z.string().trim().max(70, "Keep SEO titles under 70 characters"),
  seoDescription: z.string().trim().max(200, "Keep descriptions under 200 characters"),
  canonicalUrl: z.union([z.literal(""), z.string().trim().url().startsWith("https://")]),
});

async function snapshot(pageId: string, userId: string) {
  const page = await db.query.pages.findFirst({ where: eq(t.pages.id, pageId) });
  if (!page) return;
  await db.insert(t.pageRevisions).values({ pageId, snapshot: page as unknown as Record<string, unknown>, createdById: userId });
  // Keep the 20 most recent revisions per page.
  const old = await db.select({ id: t.pageRevisions.id }).from(t.pageRevisions).where(eq(t.pageRevisions.pageId, pageId)).orderBy(desc(t.pageRevisions.createdAt)).offset(20);
  for (const r of old) await db.delete(t.pageRevisions).where(eq(t.pageRevisions.id, r.id));
}

export async function savePageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.edit");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown page.");
    const page = await db.query.pages.findFirst({ where: eq(t.pages.id, id) });
    if (!page) return failure("This page no longer exists.");

    const meta = metaSchema.safeParse({
      title: str(fd, "title"),
      seoTitle: str(fd, "seoTitle"),
      seoDescription: str(fd, "seoDescription"),
      canonicalUrl: str(fd, "canonicalUrl"),
    });
    if (!meta.success) return zodFailure(meta.error);

    let sectionsRaw: unknown;
    try {
      sectionsRaw = JSON.parse(str(fd, "sections") || "[]");
    } catch {
      return failure("The page content couldn't be read. Reload and try again.");
    }
    const sections = sectionsSchema.safeParse(sectionsRaw);
    if (!sections.success) {
      const issue = sections.error.issues[0];
      const idx = typeof issue.path[0] === "number" ? issue.path[0] + 1 : "?";
      return failure(`Section ${idx}: ${issue.message} (${issue.path.slice(1).join(".") || "section"}).`, { sections: `Section ${idx}: ${issue.message}` });
    }

    let slug = page.slug;
    if (!page.system) {
      const parsedSlug = slugSchema.safeParse(str(fd, "slug"));
      if (!parsedSlug.success) return zodFailure(parsedSlug.error);
      slug = parsedSlug.data;
      if (slug !== page.slug) {
        const clash = await db.query.pages.findFirst({ where: and(eq(t.pages.slug, slug), ne(t.pages.id, id)) });
        if (clash) return failure("Another page already uses that address.", { slug: "Already in use" });
      }
    }

    const ogImageId = str(fd, "ogImageId");
    await snapshot(id, user.id);
    await db
      .update(t.pages)
      .set({
        ...meta.data,
        slug,
        sections: sections.data,
        noindex: bool(fd, "noindex"),
        ogImageId: uuid.safeParse(ogImageId).success ? ogImageId : null,
        updatedById: user.id,
        ...(bool(fd, "clearReviewNote") ? { reviewNote: "" } : {}),
      })
      .where(eq(t.pages.id, id));

    // Keep old links working when a live page moves.
    let redirectNote = "";
    if (slug !== page.slug && page.status === "published") {
      await db
        .insert(t.redirects)
        .values({ fromPath: `/${page.slug}`, toPath: `/${slug}`, statusCode: 301, note: `Page renamed by ${user.name}` })
        .onConflictDoUpdate({ target: t.redirects.fromPath, set: { toPath: `/${slug}`, statusCode: 301, enabled: true } });
      invalidate("redirects");
      redirectNote = ` A redirect from /${page.slug} was added.`;
    }
    invalidate("pages", "media");
    await audit("page.update", { actorUserId: user.id, entityType: "page", entityId: id, metadata: { slug, sections: sections.data.length } });
    return success(`Saved.${page.status === "published" ? " Changes are live." : " This page is a draft."}${redirectNote}`);
  });
}

export async function setPageStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.publish");
    const id = str(fd, "id");
    const status = str(fd, "status") === "published" ? "published" : "draft";
    if (!uuid.safeParse(id).success) return failure("Unknown page.");
    const page = await db.query.pages.findFirst({ where: eq(t.pages.id, id) });
    if (!page) return failure("Unknown page.");
    if (status === "draft" && page.slug === "") return failure("The homepage can't be unpublished. Use maintenance mode instead.");
    await db.update(t.pages).set({ status, publishedAt: status === "published" ? new Date() : page.publishedAt }).where(eq(t.pages.id, id));
    invalidate("pages");
    await audit(status === "published" ? "page.publish" : "page.unpublish", { actorUserId: user.id, entityType: "page", entityId: id, metadata: { slug: page.slug } });
    return success(status === "published" ? "Published. The page is live." : "Unpublished. The page is now a draft.");
  });
}

export async function createPageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.edit");
    const title = str(fd, "title");
    const slug = slugSchema.safeParse(str(fd, "slug") || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    if (!title) return failure("Enter a title.", { title: "Required" });
    if (!slug.success) return zodFailure(slug.error);
    if (await db.query.pages.findFirst({ where: eq(t.pages.slug, slug.data) })) return failure("A page with that address already exists.", { slug: "Already in use" });
    const [row] = await db
      .insert(t.pages)
      .values({ slug: slug.data, title, status: "draft", sections: [], updatedById: user.id })
      .returning({ id: t.pages.id });
    await audit("page.create", { actorUserId: user.id, entityType: "page", entityId: row.id, metadata: { slug: slug.data } });
    redirect(`/admin/pages/${row.id}`);
  });
}

export async function deletePageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.delete");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown page.");
    const page = await db.query.pages.findFirst({ where: eq(t.pages.id, id) });
    if (!page) return failure("Already deleted.");
    if (page.system) return failure("This page is part of the site structure and can't be deleted. Unpublish it instead.");
    await db.delete(t.pages).where(eq(t.pages.id, id));
    invalidate("pages");
    await audit("page.delete", { actorUserId: user.id, entityType: "page", entityId: id, metadata: { slug: page.slug, title: page.title } });
    redirect("/admin/pages?deleted=1");
  });
}

export async function restoreRevisionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.edit");
    const id = str(fd, "revisionId");
    if (!uuid.safeParse(id).success) return failure("Unknown revision.");
    const rev = await db.query.pageRevisions.findFirst({ where: eq(t.pageRevisions.id, id) });
    if (!rev) return failure("Unknown revision.");
    const snap = rev.snapshot as { title: string; sections: unknown; seoTitle: string; seoDescription: string };
    const sections = sectionsSchema.safeParse(snap.sections);
    if (!sections.success) return failure("That revision uses an older content format and can't be restored automatically.");
    await snapshot(rev.pageId, user.id);
    await db
      .update(t.pages)
      .set({ title: snap.title, sections: sections.data, seoTitle: snap.seoTitle, seoDescription: snap.seoDescription, updatedById: user.id })
      .where(eq(t.pages.id, rev.pageId));
    invalidate("pages");
    await audit("page.update", { actorUserId: user.id, entityType: "page", entityId: rev.pageId, metadata: { restoredRevision: id } });
    return success("Revision restored. The previous version was saved as a revision too.");
  });
}
