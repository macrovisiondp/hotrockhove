"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { failure, guarded, str, success, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";

const uuid = z.string().uuid();
const status = z.enum(["new", "read", "archived", "spam"]);

export async function setSubmissionStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("submissions.view");
    const id = str(fd, "id");
    const s = status.safeParse(str(fd, "status"));
    if (!uuid.safeParse(id).success || !s.success) return failure("Invalid request.");
    await db.update(t.formSubmissions).set({ status: s.data }).where(eq(t.formSubmissions.id, id));
    await audit("submission.status", { actorUserId: user.id, entityType: "submission", entityId: id, metadata: { status: s.data } });
    return success(`Marked as ${s.data}.`);
  });
}

export async function deleteSubmissionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("submissions.manage");
    const id = str(fd, "id");
    if (!uuid.safeParse(id).success) return failure("Invalid request.");
    const row = await db.query.formSubmissions.findFirst({ where: eq(t.formSubmissions.id, id), columns: { formKey: true } });
    if (!row) return failure("Already deleted.");
    await db.delete(t.formSubmissions).where(eq(t.formSubmissions.id, id));
    await audit("submission.delete", { actorUserId: user.id, entityType: "submission", entityId: id, metadata: { form: row.formKey } });
    redirect("/admin/submissions?deleted=1");
  });
}
