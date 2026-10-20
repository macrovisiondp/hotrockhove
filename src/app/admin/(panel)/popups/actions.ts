"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, int, lines, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { invalidate } from "@/domain/content";
import { linkHref } from "@/domain/sections";
import { parseLondonLocal } from "@/lib/time";

const uuid = z.string().uuid();

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    enabled: z.boolean(),
    template: z.enum(["image_top", "image_side", "text_only"]),
    heading: z.string().trim().min(1, "Heading is required").max(160),
    body: z.string().trim().max(600),
    imageId: z.string().uuid().nullable(),
    ctaLabel: z.string().trim().max(40),
    ctaHref: linkHref,
    formKey: z.string().max(40),
    pages: z.array(z.string().regex(/^\/[a-z0-9\-/]*$/, "Pages must be paths like / or /daisy")).max(30),
    trigger: z.enum(["delay", "scroll", "exit_intent"]),
    delaySeconds: z.number().int().min(0).max(120),
    scrollPercent: z.number().int().min(5).max(100),
    frequency: z.enum(["session", "days", "once"]),
    frequencyDays: z.number().int().min(1).max(365),
    startsAt: z.date().nullable(),
    endsAt: z.date().nullable(),
    priority: z.number().int().min(0).max(100),
  })
  .refine((p) => !p.startsAt || !p.endsAt || p.endsAt > p.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((p) => !(p.ctaLabel && !p.ctaHref) && !(!p.ctaLabel && p.ctaHref), { message: "Give the button both text and a link", path: ["ctaHref"] });

export async function savePopupAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("popups.edit");
    const id = str(fd, "id");
    const formKey = str(fd, "formKey");
    if (formKey && formKey !== "newsletter" && !(await db.query.forms.findFirst({ where: eq(t.forms.key, formKey) })))
      return failure("Unknown form.", { formKey: "Choose a form" });
    const imageId = str(fd, "imageId");
    const parsed = schema.safeParse({
      name: str(fd, "name"),
      enabled: bool(fd, "enabled"),
      template: str(fd, "template"),
      heading: str(fd, "heading"),
      body: str(fd, "body"),
      imageId: uuid.safeParse(imageId).success ? imageId : null,
      ctaLabel: str(fd, "ctaLabel"),
      ctaHref: str(fd, "ctaHref"),
      formKey,
      pages: lines(fd, "pages").map((p) => (p.length > 1 ? p.replace(/\/+$/, "") : p).toLowerCase()),
      trigger: str(fd, "trigger"),
      delaySeconds: int(fd, "delaySeconds", 5),
      scrollPercent: int(fd, "scrollPercent", 50),
      frequency: str(fd, "frequency"),
      frequencyDays: int(fd, "frequencyDays", 7),
      startsAt: parseLondonLocal(str(fd, "startsAt")),
      endsAt: parseLondonLocal(str(fd, "endsAt")),
      priority: int(fd, "priority", 0),
    });
    if (!parsed.success) return zodFailure(parsed.error);

    let savedId = id;
    if (id) {
      if (!uuid.safeParse(id).success) return failure("Unknown pop-up.");
      await db.update(t.popups).set(parsed.data).where(eq(t.popups.id, id));
    } else {
      const [row] = await db.insert(t.popups).values(parsed.data).returning({ id: t.popups.id });
      savedId = row.id;
    }
    invalidate("popups");
    await audit("popup.save", { actorUserId: user.id, entityType: "popup", entityId: savedId, metadata: { enabled: parsed.data.enabled } });
    if (!id) redirect(`/admin/popups/${savedId}`);
    return success(parsed.data.enabled ? "Saved. The pop-up is live (visitors who already saw it won't see it again until the frequency allows)." : "Saved. The pop-up is switched off.");
  });
}

export async function deletePopupAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("popups.edit");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown pop-up.");
    await db.delete(t.popups).where(eq(t.popups.id, id));
    invalidate("popups");
    await audit("popup.delete", { actorUserId: user.id, entityType: "popup", entityId: id });
    redirect("/admin/popups");
  });
}
