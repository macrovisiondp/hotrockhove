"use server";

import { redirect } from "next/navigation";
import { and, asc, count, eq, gt, lt, desc } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import type { MenuPrice } from "@/db/schema";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, str, success, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { invalidate } from "@/domain/content";
import { parsePriceInput } from "@/domain/menu-import";

const uuid = z.string().uuid();

/* ------------------------------- categories ------------------------------- */

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("menu.edit");
    const id = str(fd, "id");
    const name = str(fd, "name");
    const note = str(fd, "note");
    const status = str(fd, "status") === "draft" ? "draft" : "published";
    if (!name || name.length > 80) return failure("Category name is required (max 80 characters).", { name: "Required" });
    if (note.length > 300) return failure("Note is too long.", { note: "Max 300 characters" });

    if (id) {
      if (!uuid.safeParse(id).success) return failure("Unknown category.");
      await db.update(t.menuCategories).set({ name, note, status }).where(eq(t.menuCategories.id, id));
    } else {
      const [last] = await db.select({ s: t.menuCategories.sortOrder }).from(t.menuCategories).orderBy(desc(t.menuCategories.sortOrder)).limit(1);
      await db.insert(t.menuCategories).values({ name, note, status, sortOrder: (last?.s ?? 0) + 10 });
    }
    invalidate("menu");
    await audit("menu.category_save", { actorUserId: user.id, entityType: "menu_category", entityId: id || undefined, metadata: { name } });
    return success(id ? "Category saved." : `Category "${name}" added.`);
  });
}

export async function deleteCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.delete");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown category.");
    const [{ n }] = await db.select({ n: count() }).from(t.menuItems).where(eq(t.menuItems.categoryId, id));
    if (n > 0) return failure(`This category still has ${n} item(s). Move or delete them first.`);
    await db.delete(t.menuCategories).where(eq(t.menuCategories.id, id));
    invalidate("menu");
    await audit("menu.category_delete", { actorUserId: user.id, entityType: "menu_category", entityId: id });
    return success("Category deleted.");
  });
}

/** Swap sort order with the neighbouring row. */
async function swap(table: typeof t.menuCategories | typeof t.menuItems, id: string, dir: "up" | "down", scope?: { categoryId: string }) {
  const row = await db.select({ id: table.id, sortOrder: table.sortOrder }).from(table).where(eq(table.id, id)).limit(1);
  if (!row[0]) return;
  const cond = dir === "up" ? lt(table.sortOrder, row[0].sortOrder) : gt(table.sortOrder, row[0].sortOrder);
  const scoped = scope && "categoryId" in table ? and(cond, eq((table as typeof t.menuItems).categoryId, scope.categoryId)) : cond;
  const [other] = await db
    .select({ id: table.id, sortOrder: table.sortOrder })
    .from(table)
    .where(scoped)
    .orderBy(dir === "up" ? desc(table.sortOrder) : asc(table.sortOrder))
    .limit(1);
  if (!other) return;
  await db.update(table).set({ sortOrder: other.sortOrder }).where(eq(table.id, row[0].id));
  await db.update(table).set({ sortOrder: row[0].sortOrder }).where(eq(table.id, other.id));
}

export async function moveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertPermission("menu.edit");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown category.");
    await swap(t.menuCategories, id, str(fd, "dir") === "up" ? "up" : "down");
    invalidate("menu");
    return success("Moved.");
  });
}

/* ---------------------------------- items --------------------------------- */

export async function saveItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("menu.edit");
    const id = str(fd, "id");
    const categoryId = str(fd, "categoryId");
    const name = str(fd, "name");
    const description = str(fd, "description");
    const errors: Record<string, string> = {};
    if (!name || name.length > 120) errors.name = "Name is required (max 120 characters).";
    if (description.length > 1000) errors.description = "Max 1000 characters.";
    if (!uuid.safeParse(categoryId).success) errors.categoryId = "Choose a category.";

    // Up to three price rows: optional label + price.
    const prices: MenuPrice[] = [];
    for (let i = 0; i < 3; i++) {
      const raw = str(fd, `price.${i}.amount`);
      const label = str(fd, `price.${i}.label`);
      if (!raw && !label) continue;
      const pence = parsePriceInput(raw);
      if (pence === null) {
        errors[`price.${i}.amount`] = "Enter a price like 12.99";
        continue;
      }
      prices.push({ label: label || null, amountPence: pence });
    }
    const keepSourcePrice = bool(fd, "keepSourcePrice");
    if (prices.length === 0 && !keepSourcePrice) errors["price.0.amount"] = "Enter a price.";
    if (prices.length > 1 && prices.some((p) => !p.label)) errors["price.0.label"] = "Label each size when there's more than one price (e.g. 330ml).";
    if (Object.keys(errors).length) return failure("Please correct the highlighted fields.", errors);

    const imageId = str(fd, "imageId");
    const values = {
      categoryId,
      name,
      description,
      prices: prices.length ? prices : [{ label: null, amountPence: null }],
      featured: bool(fd, "featured"),
      available: bool(fd, "available"),
      status: (str(fd, "status") === "draft" ? "draft" : "published") as "draft" | "published",
      imageId: uuid.safeParse(imageId).success ? imageId : null,
      ...(bool(fd, "markReviewed") ? { reviewNote: "" } : {}),
    };

    let savedId = id;
    if (id) {
      if (!uuid.safeParse(id).success) return failure("Unknown item.");
      const before = await db.query.menuItems.findFirst({ where: eq(t.menuItems.id, id) });
      if (!before) return failure("This item no longer exists.");
      await db.update(t.menuItems).set(values).where(eq(t.menuItems.id, id));
      await audit("menu.item_save", {
        actorUserId: user.id,
        entityType: "menu_item",
        entityId: id,
        metadata: { name, priceChanged: JSON.stringify(before.prices) !== JSON.stringify(values.prices), reviewed: bool(fd, "markReviewed") },
      });
    } else {
      const [last] = await db
        .select({ s: t.menuItems.sortOrder })
        .from(t.menuItems)
        .where(eq(t.menuItems.categoryId, categoryId))
        .orderBy(desc(t.menuItems.sortOrder))
        .limit(1);
      const [row] = await db
        .insert(t.menuItems)
        .values({ ...values, sortOrder: (last?.s ?? 0) + 10 })
        .returning({ id: t.menuItems.id });
      savedId = row.id;
      await audit("menu.item_save", { actorUserId: user.id, entityType: "menu_item", entityId: row.id, metadata: { name, created: true } });
    }
    invalidate("menu");
    if (!id) redirect(`/admin/menu/items/${savedId}?created=1`);
    return success("Item saved. The menu page is updated.");
  });
}

export async function deleteItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.delete");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown item.");
    const item = await db.query.menuItems.findFirst({ where: eq(t.menuItems.id, id) });
    if (!item) return failure("Already deleted.");
    await db.delete(t.menuItems).where(eq(t.menuItems.id, id));
    invalidate("menu");
    await audit("menu.item_delete", { actorUserId: user.id, entityType: "menu_item", entityId: id, metadata: { name: item.name, prices: item.prices } });
    redirect("/admin/menu?deleted=1");
  });
}

export async function moveItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertPermission("menu.edit");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Unknown item.");
    const item = await db.query.menuItems.findFirst({ where: eq(t.menuItems.id, id), columns: { categoryId: true } });
    if (!item) return failure("Unknown item.");
    await swap(t.menuItems, id, str(fd, "dir") === "up" ? "up" : "down", { categoryId: item.categoryId });
    invalidate("menu");
    return success("Moved.");
  });
}
