import Link from "next/link";
import { count, desc, eq, like } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/session";
import { Badge, PageHeader, formatDateTime } from "@/components/admin/ui";

export const metadata = { title: "Activity log" };
const PER_PAGE = 100;

export default async function Activity({ searchParams }: PageProps<"/admin/activity">) {
  await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const security = sp.type === "security";
  const where = security ? like(t.auditLogs.action, "security.%") : undefined;
  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(t.auditLogs).where(where),
    db
      .select({ id: t.auditLogs.id, action: t.auditLogs.action, entityType: t.auditLogs.entityType, entityId: t.auditLogs.entityId, metadata: t.auditLogs.metadata, createdAt: t.auditLogs.createdAt, who: t.users.name })
      .from(t.auditLogs)
      .leftJoin(t.users, eq(t.users.id, t.auditLogs.actorUserId))
      .where(where)
      .orderBy(desc(t.auditLogs.createdAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
  ]);
  return (
    <>
      <PageHeader
        title="Activity log"
        description="Administrative changes and security events. Passwords, API keys and submission contents are never recorded."
        actions={
          <Link href={security ? "/admin/activity" : "/admin/activity?type=security"} className="admin-btn admin-btn-secondary">
            {security ? "All activity" : "Security events only"}
          </Link>
        }
      />
      <div className="admin-card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[#ece9e4] text-left text-xs text-[#6b665e]">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Who</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#f3f1ed] align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-xs">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2">{r.who ?? <span className="text-[#8a847b]">Visitor / system</span>}</td>
                <td className="px-4 py-2">
                  {r.action.startsWith("security.") ? <Badge tone="warn">{r.action}</Badge> : r.action}
                </td>
                <td className="px-4 py-2 text-xs text-[#6b665e]">
                  {r.entityType}
                  {Object.keys(r.metadata).length > 0 && <code className="ml-2 break-all">{JSON.stringify(r.metadata).slice(0, 240)}</code>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm">
        {page > 1 && (
          <Link href={`?${security ? "type=security&" : ""}page=${page - 1}`} className="admin-btn admin-btn-secondary">
            Newer
          </Link>
        )}
        {page * PER_PAGE < total && (
          <Link href={`?${security ? "type=security&" : ""}page=${page + 1}`} className="admin-btn admin-btn-secondary">
            Older
          </Link>
        )}
      </div>
    </>
  );
}
