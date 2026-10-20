import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { failure, guarded, str, success, type ActionState } from "@/lib/actions";
import { ROLE_LABELS } from "@/lib/rbac";
import { assertPermission, requireStaff } from "@/lib/session";
import { ActionForm, TextInput } from "@/components/admin/form";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "My account" };

async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  "use server";
  return guarded(async () => {
    const user = await assertPermission("dashboard.view");
    const current = str(fd, "currentPassword");
    const next = str(fd, "newPassword");
    if (next.length < 12 || next.length > 128) return failure("Use at least 12 characters.", { newPassword: "At least 12 characters" });
    if (next !== str(fd, "confirmPassword")) return failure("The new passwords don't match.", { confirmPassword: "Doesn't match" });
    if (!z.string().min(1).safeParse(current).success) return failure("Enter your current password.", { currentPassword: "Required" });
    try {
      await auth.api.changePassword({ body: { currentPassword: current, newPassword: next, revokeOtherSessions: true }, headers: await headers() });
    } catch {
      return failure("Your current password is incorrect.", { currentPassword: "Incorrect" });
    }
    await audit("auth.password_changed", { actorUserId: user.id, entityType: "user", entityId: user.id });
    return success("Password changed. Other devices have been signed out.");
  });
}

export default async function Account() {
  const user = await requireStaff();
  return (
    <>
      <PageHeader title="My account" description={`${user.name} · ${user.email} · ${ROLE_LABELS[user.role]}`} />
      <Card title="Change password">
        <ActionForm action={changePasswordAction} submitLabel="Change password" resetOnSuccess compact>
          <div className="grid max-w-md gap-3">
            <TextInput name="currentPassword" label="Current password" type="password" autoComplete="current-password" />
            <TextInput name="newPassword" label="New password" type="password" autoComplete="new-password" hint="At least 12 characters. A short phrase is easier to remember." />
            <TextInput name="confirmPassword" label="Repeat new password" type="password" autoComplete="new-password" />
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
