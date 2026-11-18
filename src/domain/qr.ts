/**
 * QR codes for pages, menu items, offers and products (admin → QR codes).
 *
 * A QR code holds a plain link to the public site. Menu items, offers and
 * products link to the page that shows them, with an anchor so the phone
 * scrolls straight to the item. Pure functions: unit-tested.
 */

export type QrKind = "page" | "menuItem" | "offer" | "product";

export interface QrTarget {
  kind: QrKind;
  /** What the admin picks from, e.g. "Our Menu" or "Wagyu Fillet (Steaks)". */
  label: string;
  /** Site path, e.g. "/our-menus". */
  path: string;
  /** Element id on that page, without "#", e.g. "item-<id>". */
  anchor?: string;
}

/** Anchor ids used on the public site (keep in step with components/site/sections.tsx). */
export const anchorFor = {
  menuItem: (id: string) => `item-${id}`,
  offer: (id: string) => `offer-${id}`,
  product: (slug: string) => `product-${slug}`,
};

/**
 * "https://example.com" from what an admin types: adds https:// when missing,
 * drops trailing slashes and anything after the host. null if it isn't a web address.
 */
export function normaliseBase(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** The full link a QR code holds. */
export function qrUrl(base: string, target: Pick<QrTarget, "path" | "anchor">): string {
  const path = target.path === "/" || target.path === "" ? "/" : `/${target.path.replace(/^\/+/, "")}`;
  return `${base}${path}${target.anchor ? `#${target.anchor}` : ""}`;
}

/** A safe file name for the download, e.g. "qr-wagyu-fillet". */
export function qrFileName(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `qr-${slug || "hot-rock"}`;
}
