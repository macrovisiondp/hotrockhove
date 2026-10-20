import Link from "next/link";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { parseFields, submitterEmail } from "@/domain/forms/fields";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { Badge, EmptyState, Notice, PageHeader, formatDateTime } from "@/components/admin/ui";

export const metadata = { title: "Form submissions" };

const STATUSES = ["new", "read", "archived", "spam"] as const;
const PER_PAGE = 50;

export default async function Submissions({ searchParams }: PageProps<"/admin/submissions">) {
  const user = await requirePermission("submissions.view");
  const sp = await searchParams;
  const form = typeof sp.form === "string" ? sp.form : "";
  const status = STATUSES.find((s) => s === sp.status) ?? "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: SQL[] = [];
  if (form) where.push(eq(t.formSubmissions.formKey, form));
  if (status) where.push(eq(t.formSubmissions.status, status));
  else where.push(sql`${t.formSubmissions.status} <> 'spam'`);
  // Search inside the submitted values (case-insensitive).
  if (q) where.push(sql`${t.formSubmissions.data}::text ilike ${`%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`}`);

  const [forms, [{ total }], rows] = await Promise.all([
    db.select().from(t.forms),
    db.select({ total: count() }).from(t.formSubmissions).where(and(...where)),
    db
      .select()
      .from(t.formSubmissions)
      .where(and(...where))
      .orderBy(desc(t.formSubmissions.createdAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
  ]);
  const formMap = new Map(forms.map((f) => [f.key, { name: f.name, fields: parseFields(f.fields) }]));
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(form && { form }), ...(status && { status }), ...(q && { q }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Form submissions"
        description="Messages sent through the website forms. This is personal information: don't copy it into other systems unless needed."
        actions={
          can(user.role, "submissions.export") && (
            <a href={`/admin/export/submissions${qs({})}`} download className="admin-btn admin-btn-secondary">
              Export CSV
            </a>
          )
        }
      />
      {sp.deleted === "1" && (
        <div className="mb-4">
          <Notice tone="good">Submission deleted.</Notice>
        </div>
      )}
      <Notice tone="info">
        Submissions made on the old WordPress site (about 440) are not here. They stay in WordPress until the owner decides how to archive them.
      </Notice>

      <form className="my-4 flex flex-wrap items-end gap-2" action="/admin/submissions">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[#6b665e]">Form</span>
          <select name="form" defaultValue={form} className="admin-input">
            <option value="">All forms</option>
            {forms.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[#6b665e]">Status</span>
          <select name="status" defaultValue={status} className="admin-input">
            <option value="">All except spam</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-[#6b665e]">Search</span>
          <input name="q" defaultValue={q} className="admin-input w-56" placeholder="Name, email, message…" />
        </label>
        <button type="submit" className="admin-btn admin-btn-secondary">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No submissions">Nothing matches these filters yet.</EmptyState>
      ) : (
        <div className="admin-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#ece9e4] text-left text-xs text-[#6b665e]">
                <th className="px-4 py-2 font-medium">Received</th>
                <th className="px-4 py-2 font-medium">Form</th>
                <th className="px-4 py-2 font-medium">From</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const f = formMap.get(r.formKey);
                const name = String(r.data.full_name ?? r.data.name ?? "");
                const email = f ? submitterEmail(f.fields, r.data) : null;
                return (
                  <tr key={r.id} className={`border-b border-[#f3f1ed] last:border-0 ${r.status === "new" ? "font-medium" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/admin/submissions/${r.id}`} className="hover:underline">
                        {formatDateTime(r.createdAt)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{f?.name ?? r.formKey}</td>
                    <td className="px-4 py-2.5">{[name, email].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.status === "new" ? "info" : r.status === "spam" ? "bad" : "neutral"}>{r.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {total > PER_PAGE && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={qs({ page: String(page - 1) })} className="admin-btn admin-btn-secondary">
              Previous
            </Link>
          )}
          <span className="text-[#6b665e]">
            Page {page} of {Math.ceil(total / PER_PAGE)}
          </span>
          {page * PER_PAGE < total && (
            <Link href={qs({ page: String(page + 1) })} className="admin-btn admin-btn-secondary">
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
