import { asc } from "drizzle-orm";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react/dist/ssr";
import { db, t } from "@/db";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, ConfirmButton, InlineAction, TextInput, Toggle } from "@/components/admin/form";
import { Card, PageHeader } from "@/components/admin/ui";
import { deleteNavItemAction, moveNavItemAction, saveNavItemAction } from "./actions";

export const metadata = { title: "Navigation" };

export default async function Navigation() {
  const user = await requirePermission("content.view");
  const canEdit = can(user.role, "nav.edit");
  const items = await db.select().from(t.navItems).orderBy(asc(t.navItems.sortOrder));

  const section = (location: "header" | "footer", title: string, description: string) => {
    const list = items.filter((i) => i.location === location);
    const visible = list.filter((i) => i.visible && i.href !== "book");
    const half = Math.ceil(visible.length / 2);
    return (
      <Card title={title} description={description}>
        {location === "header" && (
          <p className="mb-4 rounded-md bg-[#f3f1ed] px-3 py-2 text-xs text-[#4a463f]">
            Desktop layout: <strong>{visible.slice(0, half).map((i) => i.label).join(" · ") || "—"}</strong> &nbsp;[logo]&nbsp;{" "}
            <strong>{visible.slice(half).map((i) => i.label).join(" · ") || "—"}</strong>
            {list.some((i) => i.href === "book" && i.visible) && " + Book Table button"}. Keep it to about 6 links so it fits on one line.
          </p>
        )}
        <ul className="space-y-3">
          {list.map((i, idx) => (
            <li key={i.id} className="rounded-md border border-[#ece9e4] p-3">
              <ActionForm action={saveNavItemAction} disabled={!canEdit} compact submitLabel="Save">
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="location" value={location} />
                <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
                  <TextInput name="label" label="Label" defaultValue={i.label} maxLength={40} />
                  <TextInput name="href" label="Link" defaultValue={i.href} hint={i.href === "book" ? "“book” uses the Book Table setting" : undefined} />
                  <div className="pt-7">
                    <Toggle name="visible" label="Visible" defaultChecked={i.visible} />
                  </div>
                </div>
              </ActionForm>
              {canEdit && (
                <div className="mt-2 flex items-center gap-1">
                  <InlineAction action={moveNavItemAction} hidden={{ id: i.id, dir: "up" }} label={<ArrowUp size={14} />} title="Move earlier" className={`admin-btn admin-btn-secondary min-h-[28px] px-2 ${idx === 0 ? "invisible" : ""}`} />
                  <InlineAction action={moveNavItemAction} hidden={{ id: i.id, dir: "down" }} label={<ArrowDown size={14} />} title="Move later" className={`admin-btn admin-btn-secondary min-h-[28px] px-2 ${idx === list.length - 1 ? "invisible" : ""}`} />
                  <span className="ml-auto">
                    <ConfirmButton action={deleteNavItemAction} hidden={{ id: i.id }} label="Remove" question="Remove this link?" confirmLabel="Remove" className="admin-btn admin-btn-danger min-h-[28px]" />
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="mt-4 rounded-md bg-[#f3f1ed] p-3">
            <ActionForm action={saveNavItemAction} compact submitLabel="Add link" resetOnSuccess showCancel={false}>
              <input type="hidden" name="location" value={location} />
              <div className="grid gap-3 md:grid-cols-[1fr_1.5fr]">
                <TextInput name="label" label="New link label" maxLength={40} />
                <TextInput name="href" label="Link" placeholder="/wagyu, https://…, or book" />
              </div>
            </ActionForm>
          </div>
        )}
      </Card>
    );
  };

  return (
    <>
      <PageHeader title="Navigation" description="Links in the header and footer. Pages must be published for their links to work." />
      <div className="space-y-6">
        {section("header", "Header", "Split evenly either side of the centred logo on desktop; shown in the full-screen menu on phones.")}
        {section("footer", "Footer", "The “Explore” column in the footer.")}
      </div>
    </>
  );
}
