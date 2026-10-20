import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, like } from "drizzle-orm";
import { db, t } from "@/db";
import { displayRows, parseFields, submitterEmail } from "@/domain/forms/fields";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { ConfirmButton, InlineAction } from "@/components/admin/form";
import { Badge, Card, PageHeader, formatDateTime } from "@/components/admin/ui";
import { deleteSubmissionAction, setSubmissionStatusAction } from "../actions";

export const metadata = { title: "Submission" };

export default async function SubmissionDetail({ params }: PageProps<"/admin/submissions/[id]">) {
  const user = await requirePermission("submissions.view");
  const { id } = await params;
  const row = await db.query.formSubmissions.findFirst({ where: eq(t.formSubmissions.id, id) }).catch(() => null);
  if (!row) notFound();
  // Opening a new submission marks it read.
  if (row.status === "new") await db.update(t.formSubmissions).set({ status: "read" }).where(eq(t.formSubmissions.id, id));
  const form = await db.query.forms.findFirst({ where: eq(t.forms.key, row.formKey) });
  const fields = parseFields(form?.fields);
  const rows = displayRows(fields, row.data);
  const email = submitterEmail(fields, row.data);
  const emails = await db
    .select({ template: t.emailLog.template, status: t.emailLog.status, error: t.emailLog.error, createdAt: t.emailLog.createdAt })
    .from(t.emailLog)
    .where(like(t.emailLog.idempotencyKey, `submission:${row.id}:%`));

  return (
    <>
      <PageHeader
        title={form?.name ?? row.formKey}
        description={
          <>
            <Link href="/admin/submissions" className="underline">
              ← All submissions
            </Link>{" "}
            · received {formatDateTime(row.createdAt)}
          </>
        }
        actions={
          <>
            {email && (
              <a href={`mailto:${email}`} className="admin-btn admin-btn-primary">
                Reply by email
              </a>
            )}
            <InlineAction action={setSubmissionStatusAction} hidden={{ id: row.id, status: "archived" }} label="Archive" />
            <InlineAction action={setSubmissionStatusAction} hidden={{ id: row.id, status: "spam" }} label="Mark as spam" />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <dl className="divide-y divide-[#f0ede8]">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]">
                <dt className="text-sm text-[#6b665e]">{k}</dt>
                <dd className="whitespace-pre-wrap break-words text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <div className="space-y-6">
          <Card title="Emails">
            {emails.length === 0 ? (
              <p className="text-sm text-[#6b665e]">No emails were attempted for this submission.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {emails.map((e, i) => (
                  <li key={i}>
                    {e.template.endsWith(".admin") ? "Staff notification" : "Acknowledgement"}{" "}
                    <Badge tone={e.status === "sent" ? "good" : e.status === "failed" ? "bad" : "warn"}>{e.status}</Badge>
                    {e.error && <p className="text-xs text-[#6b665e]">{e.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {can(user.role, "submissions.manage") && (
            <Card title="Delete">
              <p className="mb-3 text-sm text-[#6b665e]">Use this for erasure requests or test entries.</p>
              <ConfirmButton action={deleteSubmissionAction} hidden={{ id: row.id }} label="Delete permanently" question="Delete this submission? This can't be undone." />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
