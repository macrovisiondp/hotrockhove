"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, lines, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { fieldsSchema, formKeyFromName, type FormField } from "@/domain/forms/fields";
import { invalidate } from "@/domain/content";

const formSchema = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  submitLabel: z.string().trim().min(1).max(40),
  successMessage: z.string().trim().min(1, "A confirmation message is required").max(1000),
  recipients: z.array(z.string().email("Each recipient must be an email address")).max(10),
  notifyAdmin: z.boolean(),
  adminSubject: z.string().trim().min(1).max(200),
  sendAcknowledgement: z.boolean(),
  ackSubject: z.string().trim().max(200),
  ackBody: z.string().trim().max(5000),
  retentionDays: z.number().int().min(30, "Keep submissions at least 30 days").max(3650).nullable(),
});

/** Starter fields for a new form; editors change them on the next screen. */
const STARTER_FIELDS: FormField[] = [
  { name: "full_name", label: "Full name", type: "text", required: true, placeholder: "", help: "", options: [], maxLength: 120, half: true },
  { name: "email", label: "Email", type: "email", required: true, placeholder: "", help: "", options: [], maxLength: 200, half: true },
  { name: "phone", label: "Phone", type: "tel", required: true, placeholder: "", help: "", options: [], maxLength: 30, half: true },
  { name: "message", label: "Message", type: "textarea", required: false, placeholder: "", help: "", options: [], maxLength: 2000, half: false },
];

export async function createFormAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("forms.edit");
    const name = str(fd, "name");
    if (!name || name.length > 80) return failure("Give the form a name (max 80 characters).", { name: "Required" });
    const key = formKeyFromName(name);
    if (!key) return failure("Use letters in the name, e.g. 'Birthday enquiry'.", { name: "Needs letters" });
    if (await db.query.forms.findFirst({ where: eq(t.forms.key, key), columns: { key: true } }))
      return failure("A form with this name already exists.", { name: "Choose another name" });
    await db.insert(t.forms).values({
      key,
      name,
      fields: STARTER_FIELDS,
      submitLabel: "Send",
      successMessage: "Thank you. We've received your enquiry and will be in touch soon.",
      adminSubject: `New ${name}: {{full_name}}`,
      retentionDays: 365,
    });
    await audit("form.create", { actorUserId: user.id, entityType: "form", entityId: key, metadata: { name } });
    redirect(`/admin/forms/${key}?created=1`);
  });
}

export async function saveFormAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("forms.edit");
    const key = str(fd, "key");
    const form = await db.query.forms.findFirst({ where: eq(t.forms.key, key) });
    if (!form) return failure("Unknown form.");

    let fieldsRaw: unknown;
    try {
      fieldsRaw = JSON.parse(str(fd, "fields") || "[]");
    } catch {
      return failure("The field list couldn't be read. Reload and try again.");
    }
    const fields = fieldsSchema.safeParse(fieldsRaw);
    if (!fields.success) {
      const i = fields.error.issues[0];
      return failure(`Field ${typeof i.path[0] === "number" ? i.path[0] + 1 : ""}: ${i.message}`, { fields: i.message });
    }

    const retention = str(fd, "retentionDays");
    const parsed = formSchema.safeParse({
      name: str(fd, "name"),
      enabled: bool(fd, "enabled"),
      submitLabel: str(fd, "submitLabel"),
      successMessage: str(fd, "successMessage"),
      recipients: lines(fd, "recipients").map((r) => r.toLowerCase()),
      notifyAdmin: bool(fd, "notifyAdmin"),
      adminSubject: str(fd, "adminSubject"),
      // Customers always get a confirmation now (empty wording = the standard message).
      sendAcknowledgement: true,
      ackSubject: str(fd, "ackSubject"),
      ackBody: str(fd, "ackBody"),
      retentionDays: retention ? Number(retention) : null,
    });
    if (!parsed.success) return zodFailure(parsed.error);

    await db.update(t.forms).set({ ...parsed.data, fields: fields.data }).where(eq(t.forms.key, key));
    invalidate("pages", "popups");
    await audit("form.update", { actorUserId: user.id, entityType: "form", entityId: key, metadata: { enabled: parsed.data.enabled, fields: fields.data.length } });
    if (!fields.data.some((f) => f.type === "email")) return success("Form saved. It has no Email field, so customers won't get a confirmation email.");
    return success(parsed.data.enabled ? "Form saved." : "Form saved and switched off: visitors see a 'not available' message.");
  });
}
