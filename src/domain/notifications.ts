import { z } from "zod";

/**
 * Staff notification recipients. Each address chooses which emails it receives:
 * "all" (every notification, including forms added later) or specific forms
 * ("form:birthday_enquiry"). Kept free of server-only imports so the admin editor
 * and unit tests can share it.
 */

export const NOTIFY_ALL = "all";
export const MAX_RECIPIENTS = 25;

/** Notification type for one form's submissions. */
export const formNotifyType = (formKey: string) => `form:${formKey}`;

const notifyType = z.string().regex(/^(all|form:[a-z][a-z0-9_]{0,39})$/, "Unknown notification type");

export const recipientSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  /** Optional label shown in the admin, e.g. "Events team". */
  name: z.string().trim().max(80).default(""),
  types: z.array(notifyType).min(1, "Choose at least one type of email").max(60),
});
export type NotificationRecipient = z.infer<typeof recipientSchema>;

/** Older settings stored plain addresses; those received everything, so they become "all". */
const storedRecipient = z.preprocess((v) => (typeof v === "string" ? { email: v, types: [NOTIFY_ALL] } : v), recipientSchema);

export const notificationsSchema = z.object({
  recipients: z
    .array(storedRecipient)
    .max(MAX_RECIPIENTS, `Up to ${MAX_RECIPIENTS} recipients`)
    .refine((rs) => new Set(rs.map((r) => r.email)).size === rs.length, "Each address can only be listed once"),
});
export type NotificationSettings = z.infer<typeof notificationsSchema>;

/** Who gets a staff email for this form: everyone on "all" or that form, plus the form's own extra addresses. */
export function recipientsForForm(recipients: NotificationRecipient[], formKey: string, formExtras: string[] = []): string[] {
  const type = formNotifyType(formKey);
  const fromList = recipients.filter((r) => r.types.includes(NOTIFY_ALL) || r.types.includes(type)).map((r) => r.email);
  return [...new Set([...fromList, ...formExtras.map((e) => e.trim().toLowerCase())].filter(Boolean))];
}
