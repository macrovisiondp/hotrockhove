import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { parseSections } from "@/domain/sections";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ActionForm, TextInput } from "@/components/admin/form";
import { Badge, Card, Notice, PageHeader, formatDateTime } from "@/components/admin/ui";
import { createPageAction } from "./actions";

export const metadata = { title: "Pages" };

export default async function PagesAdmin({ searchParams }: PageProps<"/admin/pages">) {
  const user = await requirePermission("content.view");
  const sp = await searchParams;
  const rows = await db.select().from(t.pages).orderBy(asc(t.pages.slug));

  return (
    <>
      <PageHeader title="Pages" description="Every page on the website. Edit content as structured sections; drafts aren't visible to visitors." />
      {sp.deleted === "1" && (
        <div className="mb-4">
          <Notice tone="good">Page deleted.</Notice>
        </div>
      )}
      <div className="admin-card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#ece9e4] text-left text-xs text-[#6b665e]">
              <th className="px-4 py-2 font-medium">Page</th>
              <th className="px-4 py-2 font-medium">Address</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-[#f3f1ed] last:border-0">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/pages/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <span className="ml-2 text-xs text-[#8a847b]">{parseSections(p.sections).sections.length} sections</span>
                  {p.reviewNote && (
                    <span className="ml-2" title={p.reviewNote}>
                      <Badge tone="warn">Review</Badge>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#6b665e]">/{p.slug}</td>
                <td className="px-4 py-2.5">{p.status === "published" ? <Badge tone="good">Published</Badge> : <Badge>Draft</Badge>}</td>
                <td className="px-4 py-2.5 text-xs text-[#6b665e]">{formatDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {can(user.role, "content.edit") && (
        <div className="mt-6">
          <Card title="New page" description="Creates a draft. Add sections, then publish when ready.">
            <ActionForm action={createPageAction} submitLabel="Create draft" showCancel={false} compact>
              <div className="grid gap-3 md:grid-cols-2">
                <TextInput name="title" label="Title" required maxLength={120} />
                <TextInput name="slug" label="Address" placeholder="private-dining" hint="Optional. Made from the title if empty." />
              </div>
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
