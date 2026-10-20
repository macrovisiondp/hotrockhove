import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, InlineAction, Select, TextInput, Toggle } from "@/components/admin/form";
import { Badge, Card, PageHeader, formatDateTime } from "@/components/admin/ui";
import { createUserAction, resetPasswordAction, updateUserAction } from "./actions";

export const metadata = { title: "Users" };

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner: everything, including users and API keys" },
  { value: "admin", label: "Admin: settings, forms, email, submissions" },
  { value: "editor", label: "Editor: pages, menu, media, offers, pop-ups" },
  { value: "viewer", label: "Viewer: read-only" },
];

export default async function Users() {
  const me = await requirePermission("users.manage");
  const users = await db.select().from(t.users).orderBy(asc(t.users.name));
  return (
    <>
      <PageHeader title="Users" description="Who can sign in to this admin, and what they can do." />
      <div className="space-y-4">
        {users.map((u) => (
          <Card key={u.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium">{u.name}</span>
              <span className="text-sm text-[#6b665e]">{u.email}</span>
              <Badge tone={u.active ? "good" : "neutral"}>{u.active ? ROLE_LABELS[u.role] : "Deactivated"}</Badge>
              {u.id === me.id && <Badge tone="info">You</Badge>}
              <span className="ml-auto text-xs text-[#8a847b]">Added {formatDateTime(u.createdAt)}</span>
            </div>
            <ActionForm action={updateUserAction} compact submitLabel="Save">
              <input type="hidden" name="id" value={u.id} />
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <Select name="role" label="Role" defaultValue={u.role} options={ROLE_OPTIONS} />
                <div className="pb-2">
                  <Toggle name="active" label="Can sign in" defaultChecked={u.active} />
                </div>
              </div>
            </ActionForm>
            {u.id !== me.id && (
              <div className="mt-3">
                <InlineAction action={resetPasswordAction} hidden={{ id: u.id }} label="Reset password" />
              </div>
            )}
          </Card>
        ))}
        <Card title="Add a user">
          <ActionForm action={createUserAction} submitLabel="Create account" showCancel={false} resetOnSuccess compact>
            <div className="grid gap-3 md:grid-cols-3">
              <TextInput name="name" label="Name" required maxLength={80} />
              <TextInput name="email" label="Email" type="email" required />
              <Select name="role" label="Role" defaultValue="editor" options={ROLE_OPTIONS} />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
