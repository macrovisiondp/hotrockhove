import type { MenuPrice } from "@/db/schema";

export type SnapshotItem = {
  name: string;
  description: string | null;
  description_raw: string | null;
  price_raw: string | null;
};

export type ImportedItem = {
  name: string;
  description: string;
  prices: MenuPrice[];
  sourcePriceText: string;
  reviewNote: string;
};

const SINGLE = /^£(\d{1,4})\.(\d{2})$/;

/** Known data-quality issues from the audit. Recorded as review notes; the data itself is not changed. */
const NAME_NOTES: Record<string, string> = {
  "Bradon Rost": "Name may be a misspelling of 'Bradan Rost' (Scottish hot-smoked salmon). Not changed; please confirm.",
  Scampi: "Description says 'breaded lobster tail' for scampi. Not changed; please confirm.",
};

/**
 * Convert one item from docs/data/menu-snapshot.json. Prices are never guessed:
 * anything that isn't a clean "£X.XX" keeps its exact source text, gets a null
 * amount (so the site shows the source text) and a review note.
 */
export function importMenuItem(item: SnapshotItem): ImportedItem {
  const raw = (item.price_raw ?? "").trim();
  const notes: string[] = [];
  if (NAME_NOTES[item.name]) notes.push(NAME_NOTES[item.name]);
  let description = (item.description ?? "").trim();
  let prices: MenuPrice[] = [];

  const single = raw.match(SINGLE);
  if (single) {
    prices = [{ label: null, amountPence: Number(single[1]) * 100 + Number(single[2]) }];
  } else if (item.name === "Bottled water" && /330ml\s*$/.test(description) && /^£3\.00\s*,\s*750ml\s*£4\.50$/.test(raw)) {
    // Source: "fizzy and still330ml £3.00 , 750ml £4.50" — two sizes in one string.
    description = description.replace(/330ml\s*$/, "").trim();
    prices = [
      { label: "330ml", amountPence: 300 },
      { label: "750ml", amountPence: 450 },
    ];
    notes.push("Two sizes were in one price string on the old site (330ml £3.00, 750ml £4.50). Split into two prices; please confirm.");
  } else {
    prices = [{ label: null, amountPence: null }];
    notes.push(raw ? `Price on the old site is '${raw}', which isn't a valid price. Shown exactly as written until corrected.` : "No price on the old site.");
  }

  return {
    name: item.name,
    description,
    prices,
    sourcePriceText: item.name === "Bottled water" && prices.length === 2 ? "330ml £3.00, 750ml £4.50" : raw,
    reviewNote: notes.join(" "),
  };
}

/** Parse an admin-entered price ("12.99", "£12.99", "12") into pence. */
export function parsePriceInput(input: string): number | null {
  const m = input.trim().replace(/^£\s*/, "").match(/^(\d{1,4})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}
