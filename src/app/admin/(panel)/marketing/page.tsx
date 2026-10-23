import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, t } from "@/db";
import { channelProblem, emailAudience, smsAudience } from "@/domain/marketing";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { Badge, Card, EmptyState, PageHeader, formatDateTime } from "@/components/admin/ui";
import { createCampaignAction } from "./actions";

export const metadata = { title: "Marketing" };

const STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  sending: { label: "Sending", tone: "info" },
  sent: { label: "Sent", tone: "good" },
  cancelled: { label: "Stopped", tone: "warn" },
} as const;

export default async function Marketing() {
  const user = await requirePermission("marketing.view");
  const [emails, newsletterOnly, phones, emailProblem, smsProblem, campaigns] = await Promise.all([
    emailAudience({ newsletter: true, contacts: true }),
    emailAudience({ newsletter: true, contacts: false }),
    smsAudience(),
    channelProblem("email"),
    channelProblem("sms"),
    db.select().from(t.marketingCampaigns).orderBy(desc(t.marketingCampaigns.createdAt)).limit(50),
  ]);
  const canSend = can(user.role, "marketing.send");

  return (
    <>
      <PageHeader
        title="Marketing"
        description="Send offers and news by email or text message to people who agreed to hear from you."
        actions={
          <Link href="/admin/marketing/contacts" className="admin-btn admin-btn-secondary">
            Contacts
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="admin-card p-4">
          <p className="text-xs text-[#6b665e]">Can receive emails</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{emails.length}</p>
          <p className="text-xs text-[#8a847b]">
            {newsletterOnly.length} newsletter subscriber(s) + uploaded contacts, without duplicates
          </p>
        </div>
        <div className="admin-card p-4">
          <p className="text-xs text-[#6b665e]">Can receive texts</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{phones.length}</p>
          <p className="text-xs text-[#8a847b]">Contacts with a mobile number</p>
        </div>
        <div className="admin-card p-4 text-sm">
          <p className="flex items-center justify-between gap-2 py-0.5">
            Email {emailProblem ? <Badge tone="neutral">Not connected</Badge> : <Badge tone="good">Connected</Badge>}
          </p>
          <p className="flex items-center justify-between gap-2 py-0.5">
            Text messages {smsProblem ? <Badge tone="neutral">Not connected</Badge> : <Badge tone="good">Connected</Badge>}
          </p>
          {(emailProblem || smsProblem) && (
            <Link href="/admin/connections" className="mt-2 inline-block text-xs underline">
              Set up in Connections
            </Link>
          )}
        </div>
      </div>

      {canSend && (
        <div className="mb-6 flex flex-wrap gap-3">
          <form action={createCampaignAction}>
            <input type="hidden" name="channel" value="email" />
            <button type="submit" className="admin-btn admin-btn-primary">
              New email
            </button>
          </form>
          <form action={createCampaignAction}>
            <input type="hidden" name="channel" value="sms" />
            <button type="submit" className="admin-btn admin-btn-primary">
              New text message
            </button>
          </form>
        </div>
      )}

      <Card title="Campaigns">
        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet">Create an email or a text message to get started.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[#ece9e4] text-left text-xs text-[#6b665e]">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Sent</th>
                  <th className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-[#f3f1ed] last:border-0">
                    <td className="py-2.5 pr-4">
                      <Link href={`/admin/marketing/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{c.channel === "email" ? "Email" : "Text"}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {c.status === "draft" ? "—" : `${c.sent} of ${c.total}${c.failed ? ` (${c.failed} failed)` : ""}`}
                    </td>
                    <td className="py-2.5 text-xs text-[#6b665e]">{formatDateTime(c.startedAt ?? c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
