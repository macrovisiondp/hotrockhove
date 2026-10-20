import { z } from "zod";

export const FIELD_TYPES = ["text", "email", "tel", "textarea", "select", "date", "time", "checkbox", "note"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const fieldSchema = z
  .object({
    /** Stable machine name; used as the submission key and in email templates ({{name}}). */
    name: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Lowercase letters, numbers and _ only"),
    label: z.string().trim().min(1).max(200),
    type: z.enum(FIELD_TYPES),
    required: z.boolean(),
    placeholder: z.string().trim().max(120).default(""),
    help: z.string().trim().max(300).default(""),
    options: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
    maxLength: z.number().int().min(1).max(5000).default(500),
    /** Half-width on desktop (pairs with the next half-width field). */
    half: z.boolean().default(false),
  })
  .refine((f) => f.type !== "select" || f.options.length > 0, { message: "Dropdowns need at least one option", path: ["options"] });

export type FormField = z.infer<typeof fieldSchema>;
export const fieldsSchema = z
  .array(fieldSchema)
  .max(30)
  .refine((fs) => new Set(fs.map((f) => f.name)).size === fs.length, "Field names must be unique");

/** Parse stored field definitions; invalid definitions are dropped. */
export function parseFields(raw: unknown): FormField[] {
  const r = fieldsSchema.safeParse(raw);
  return r.success ? r.data : [];
}

const MAX_TEXT = 5000;

/**
 * Build a validator for one form's submission from its field definitions.
 * Checkbox values arrive as "on"; everything else is trimmed text.
 */
export function submissionValidator(fields: FormField[]) {
  const shape: Record<string, z.ZodType<string | boolean>> = {};
  for (const f of fields) {
    if (f.type === "note") continue;
    if (f.type === "checkbox") {
      const cb = z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean());
      shape[f.name] = f.required ? cb.refine((v) => v === true, "Please tick this box to continue") : cb;
      continue;
    }
    let s = z.string().trim().max(Math.min(f.maxLength, MAX_TEXT), `Please keep this under ${f.maxLength} characters`);
    switch (f.type) {
      case "email":
        s = s.toLowerCase();
        break;
      case "tel":
        s = s.regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number");
        break;
      case "date":
        s = s.regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Choose a date");
        break;
      case "time":
        s = s.regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");
        break;
    }
    let field: z.ZodType<string> = s;
    if (f.type === "email") field = s.refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address");
    if (f.type === "select") field = s.refine((v) => v === "" || f.options.includes(v), "Choose one of the options");
    if (f.type === "date")
      field = field.refine((v) => v === "" || !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Choose a valid date");
    if (f.required) field = field.refine((v) => v.length > 0, `${f.label.replace(/[*:]\s*$/, "")} is required`);
    shape[f.name] = field;
  }
  return z.object(shape);
}

/** First email field's value, used for acknowledgements and per-email rate limits. */
export function submitterEmail(fields: FormField[], data: Record<string, string | boolean>): string | null {
  const f = fields.find((x) => x.type === "email");
  const v = f ? data[f.name] : null;
  return typeof v === "string" && v ? v : null;
}

/** Human-readable rows for notification emails and the admin detail view. */
export function displayRows(fields: FormField[], data: Record<string, string | boolean>): [string, string][] {
  const rows: [string, string][] = [];
  for (const f of fields) {
    if (f.type === "note") continue;
    const v = data[f.name];
    if (v === undefined || v === "") continue;
    rows.push([f.label, typeof v === "boolean" ? (v ? "Yes" : "No") : v]);
  }
  // Values for fields that were later removed from the form are still shown.
  for (const [k, v] of Object.entries(data)) {
    if (!fields.some((f) => f.name === k) && v !== "") rows.push([k, String(v)]);
  }
  return rows;
}
