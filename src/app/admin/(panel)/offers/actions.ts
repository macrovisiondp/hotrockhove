"use server";

import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, int, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { invalidate } from "@/domain/content";

const uuid = z.string().uuid();
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => v || null);
const schema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(80),
    tagline: z.string().trim().max(160),
    body: z.string().trim().max(1500),
    priceText: z.string().trim().max(40),
    promoCode: z.string().trim().toUpperCase().max(30).regex(/^[A-Z0-9-]*$/, "Letters, numbers and hyphens only"),
    stage: z.enum(["current", "upcoming"]),
    status: z.enum(["published", "draft"]),
    startsOn: date,
    endsOn: date,
    sortOrder: z.number().int(),
  })
  .refine((o) => !o.startsOn || !o.endsOn || o.endsOn >= o.startsOn, { message: "End date must be after the start date", path: ["endsOn"] });

export async function saveOfferAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.edit");
    const id = str(fd, "id");
    const parsed = schema.safeParse({
      title: str(fd, "title"),
      tagline: str(fd, "tagline"),
      body: str(fd, "body"),
      priceText: str(fd, "priceText"),
      promoCode: str(fd, "promoCode"),
      stage: str(fd, "stage") || "current",
      status: str(fd, "status") || "published",
      startsOn: str(fd, "startsOn"),
      endsOn: str(fd, "endsOn"),
      sortOrder: int(fd, "sortOrder", 0),
    });
    if (!parsed.success) return zodFailure(parsed.error);
    const imageId = str(fd, "imageId");
    const values = { ...parsed.data, imageId: uuid.safeParse(imageId).success ? imageId : null, ...(bool(fd, "markReviewed") ? { reviewNote: "" } : {}) };
    let savedId = id;
    if (id) {
      if (!uuid.safeParse(id).success) return failure("Unknown offer.");
      await db.update(t.offers).set(values).where(eq(t.offers.id, id));
    } else {
      const [last] = await db.select({ s: t.offers.sortOrder }).from(t.offers).orderBy(desc(t.offers.sortOrder)).limit(1);
      const [row] = await db.insert(t.offers).values({ ...values, sortOrder: (last?.s ?? 0) + 10 }).returning({ id: t.offers.id });
      savedId = row.id;
    }
    invalidate("offers");
    await audit("offer.save", { actorUserId: user.id, entityType: "offer", entityId: savedId, metadata: { title: parsed.data.title } });
    if (!id) redirect(`/admin/offers/${savedId}`);
    return success("Offer saved.");
  });
}

export async function deleteOfferAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.delete");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown offer.");
    await db.delete(t.offers).where(eq(t.offers.id, id));
    invalidate("offers");
    await audit("offer.delete", { actorUserId: user.id, entityType: "offer", entityId: id });
    redirect("/admin/offers");
  });
}
