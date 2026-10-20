import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { can } from "@/lib/rbac";
import { getStaffUser } from "@/lib/session";
import { displayRows, parseFields } from "@/domain/forms/fields";

/** CSV export of submissions (owner/admin only, audited). Honours the list filters. */
export async function GET(req: Request) {
  const user = await getStaffUser();
  if (!user || !can(user.role, "submissions.export")) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const form = url.searchParams.get("form") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const where: SQL[] = [];
  if (form) where.push(eq(t.formSubmissions.formKey, form));
  if (["new", "read", "archived", "spam"].includes(status)) where.push(eq(t.formSubmissions.status, status as "new"));
  else where.push(sql`${t.formSubmissions.status} <> 'spam'`);

  const [forms, rows] = await Promise.all([
    db.select().from(t.forms),
    db.select().from(t.formSubmissions).where(and(...where)).orderBy(desc(t.formSubmissions.createdAt)).limit(10_000),
  ]);
  const formMap = new Map(forms.map((f) => [f.key, { name: f.name, fields: parseFields(f.fields) }]));

  // Columns: fixed metadata + every field label that appears.
  const labelled = rows.map((r) => {
    const f = formMap.get(r.formKey);
    return { r, cells: new Map(displayRows(f?.fields ?? [], r.data)), formName: f?.name ?? r.formKey };
  });
  const labels = [...new Set(labelled.flatMap((x) => [...x.cells.keys()]))];
  const csv = toCsv(
    ["Received", "Form", "Status", ...labels],
    labelled.map((x) => [x.r.createdAt, x.formName, x.r.status, ...labels.map((l) => x.cells.get(l) ?? "")]),
  );

  await audit("submission.export", { actorUserId: user.id, entityType: "submission", metadata: { form: form || "all", rows: rows.length } });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="submissions-${form || "all"}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
