"use server";

import { redirect } from "next/navigation";
import { and, asc, desc, eq, gt, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, str, success, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { invalidate } from "@/domain/content";
import { parsePriceInput } from "@/domain/menu-import";
import { PRODUCT_SLUG_RE, slugify } from "@/domain/products";

const uuid = z.string().uuid();
const MAX_PHOTOS = 8;

export async function saveProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("menu.edit");
    const id = str(fd, "id");
    const name = str(fd, "name");
    const description = str(fd, "description");
    const priceText = str(fd, "priceText");
    const sku = str(fd, "sku");
    const slug = str(fd, "slug").toLowerCase() || slugify(name);
    const priceRaw = str(fd, "price");

    const errors: Record<string, string> = {};
    if (!name || name.length > 120) errors.name = "Name is required (max 120 characters).";
    if (!slug || slug.length > 80 || !PRODUCT_SLUG_RE.test(slug)) errors.slug = "Use lowercase letters, numbers and hyphens only (e.g. hr-mug).";
    if (description.length > 2000) errors.description = "Max 2000 characters.";
    if (priceText.length > 60) errors.priceText = "Max 60 characters.";
    if (sku.length > 60) errors.sku = "Max 60 characters.";
    const pricePence = priceRaw ? parsePriceInput(priceRaw) : null;
    if (priceRaw && pricePence === null) errors.price = "Enter a price like 12.99, or leave empty.";

    const imageIds = str(fd, "imageIds")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => uuid.safeParse(s).success);
    if (id && !uuid.safeParse(id).success) return failure("Unknown product.");
    // The photo picker has no inline error slot, so say it in the form message.
    if (new Set(imageIds).size > MAX_PHOTOS) return failure(`A product can have up to ${MAX_PHOTOS} photos. Remove some and save again.`);

    if (!errors.slug) {
      const clash = await db.query.products.findFirst({
        where: id ? and(eq(t.products.slug, slug), ne(t.products.id, id)) : eq(t.products.slug, slug),
        columns: { name: true },
      });
      if (clash) errors.slug = `Already used by "${clash.name}". Choose a different address.`;
    }
    if (Object.keys(errors).length) return failure("Please correct the highlighted fields.", errors);

    const values = {
      name,
      slug,
      description,
      priceText,
      pricePence,
      sku,
      imageIds: [...new Set(imageIds)],
      available: bool(fd, "available"),
      status: (str(fd, "status") === "draft" ? "draft" : "published") as "draft" | "published",
      ...(bool(fd, "markReviewed") ? { reviewNote: "" } : {}),
    };

    let savedId = id;
    if (id) {
      const before = await db.query.products.findFirst({ where: eq(t.products.id, id), columns: { id: true } });
      if (!before) return failure("This product no longer exists.");
      await db.update(t.products).set(values).where(eq(t.products.id, id));
      await audit("product.save", { actorUserId: user.id, entityType: "product", entityId: id, metadata: { name, reviewed: bool(fd, "markReviewed") } });
    } else {
      const [last] = await db.select({ s: t.products.sortOrder }).from(t.products).orderBy(desc(t.products.sortOrder)).limit(1);
      const [row] = await db
        .insert(t.products)
        .values({ ...values, sortOrder: (last?.s ?? 0) + 10 })
        .returning({ id: t.products.id });
      savedId = row.id;
      await audit("product.save", { actorUserId: user.id, entityType: "product", entityId: row.id, metadata: { name, created: true } });
    }
    invalidate("products");
    if (!id) redirect(`/admin/products/${savedId}?created=1`);
    return success("Product saved.");
  });
}

export async function deleteProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.delete");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown product.");
    const product = await db.query.products.findFirst({ where: eq(t.products.id, id) });
    if (!product) return failure("Already deleted.");
    await db.delete(t.products).where(eq(t.products.id, id));
    invalidate("products");
    await audit("product.delete", { actorUserId: user.id, entityType: "product", entityId: id, metadata: { name: product.name, slug: product.slug } });
    redirect("/admin/products?deleted=1");
  });
}

export async function moveProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertPermission("menu.edit");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown product.");
    const dir = str(fd, "dir") === "up" ? "up" : "down";
    const [row] = await db.select({ id: t.products.id, sortOrder: t.products.sortOrder }).from(t.products).where(eq(t.products.id, id)).limit(1);
    if (!row) return failure("Unknown product.");
    const [other] = await db
      .select({ id: t.products.id, sortOrder: t.products.sortOrder })
      .from(t.products)
      .where(dir === "up" ? lt(t.products.sortOrder, row.sortOrder) : gt(t.products.sortOrder, row.sortOrder))
      .orderBy(dir === "up" ? desc(t.products.sortOrder) : asc(t.products.sortOrder))
      .limit(1);
    if (other) {
      await db.update(t.products).set({ sortOrder: other.sortOrder }).where(eq(t.products.id, row.id));
      await db.update(t.products).set({ sortOrder: row.sortOrder }).where(eq(t.products.id, other.id));
      invalidate("products");
    }
    return success("Moved.");
  });
}
