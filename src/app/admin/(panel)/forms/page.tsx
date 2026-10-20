import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/session";
import { Badge, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Forms" };

export default async function FormsAdmin() {
  await requirePermission("settings.view");
  const forms = await db.select().from(t.forms).orderBy(asc(t.forms.name));
  const counts = await db.select({ key: t.formSubmissions.formKey, n: count() }).from(t.formSubmissions).groupBy(t.formSubmissions.formKey);
  const used = await db.select({ slug: t.pages.slug, sections: t.pages.sections }).from(t.pages).where(eq(t.pages.status, "published"));

  return (
    <>
      <PageHeader
        title="Forms"
        description="The forms visitors fill in. Change fields, confirmation messages, who is notified and how long submissions are kept. The newsletter sign-up is managed under Newsletter."
      />
      <ul className="space-y-3">
        {forms.map((f) => {
          const n = counts.find((c) => c.key === f.key)?.n ?? 0;
          const pages = used.filter((p) => JSON.stringify(p.sections).includes(`"formKey":"${f.key}"`)).map((p) => `/${p.slug}`);
          return (
            <li key={f.key} className="admin-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/admin/forms/${f.key}`} className="font-medium hover:underline">
                  {f.name}
                </Link>{" "}
                {f.enabled ? <Badge tone="good">On</Badge> : <Badge tone="warn">Off</Badge>}
                <p className="text-xs text-[#6b665e]">
                  {pages.length ? `On ${pages.join(", ")}` : "Not placed on any published page"} · {n} submission(s) · keeps for {f.retentionDays ? `${f.retentionDays} days` : "ever"}
                </p>
              </div>
              <Link href={`/admin/submissions?form=${f.key}`} className="admin-btn admin-btn-secondary">
                View submissions
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
