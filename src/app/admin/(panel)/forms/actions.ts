"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, lines, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { fieldsSchema } from "@/domain/forms/fields";
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
    if (!fields.data.some((f) => f.type === "email") && bool(fd, "sendAcknowledgement"))
      return failure("Acknowledgement emails need an Email field in the form.", { sendAcknowledgement: "Add an Email field first" });

    const retention = str(fd, "retentionDays");
    const parsed = formSchema.safeParse({
      name: str(fd, "name"),
      enabled: bool(fd, "enabled"),
      submitLabel: str(fd, "submitLabel"),
      successMessage: str(fd, "successMessage"),
      recipients: lines(fd, "recipients").map((r) => r.toLowerCase()),
      notifyAdmin: bool(fd, "notifyAdmin"),
      adminSubject: str(fd, "adminSubject"),
      sendAcknowledgement: bool(fd, "sendAcknowledgement"),
      ackSubject: str(fd, "ackSubject"),
      ackBody: str(fd, "ackBody"),
      retentionDays: retention ? Number(retention) : null,
    });
    if (!parsed.success) return zodFailure(parsed.error);
    if (parsed.data.sendAcknowledgement && (!parsed.data.ackSubject || !parsed.data.ackBody))
      return failure("Write the acknowledgement subject and message, or switch acknowledgements off.", { ackSubject: "Required" });

    await db.update(t.forms).set({ ...parsed.data, fields: fields.data }).where(eq(t.forms.key, key));
    invalidate("pages", "popups");
    await audit("form.update", { actorUserId: user.id, entityType: "form", entityId: key, metadata: { enabled: parsed.data.enabled, fields: fields.data.length } });
    return success(parsed.data.enabled ? "Form saved." : "Form saved and switched off: visitors see a 'not available' message.");
  });
}
