import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { can, ROLE_LABELS, type Permission } from "@/lib/rbac";
import { AdminNav } from "@/components/admin/nav";
import { signOutAction } from "../login/actions";

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

const SECTIONS: { title: string; items: { href: string; label: string; perm: Permission }[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", perm: "dashboard.view" },
      { href: "/admin/connections", label: "Connections", perm: "settings.view" },
    ],
  },
  {
    title: "Website",
    items: [
      { href: "/admin/business", label: "Business settings", perm: "settings.view" },
      { href: "/admin/pages", label: "Pages", perm: "content.view" },
      { href: "/admin/menu", label: "Menu", perm: "content.view" },
      { href: "/admin/offers", label: "Offers", perm: "content.view" },
      { href: "/admin/reviews", label: "Reviews", perm: "content.view" },
      { href: "/admin/media", label: "Media", perm: "content.view" },
      { href: "/admin/navigation", label: "Navigation", perm: "content.view" },
      { href: "/admin/popups", label: "Pop-ups", perm: "content.view" },
    ],
  },
  {
    title: "Customers",
    items: [
      { href: "/admin/submissions", label: "Form submissions", perm: "submissions.view" },
      { href: "/admin/forms", label: "Forms", perm: "settings.view" },
      { href: "/admin/newsletter", label: "Newsletter", perm: "subscribers.view" },
      { href: "/admin/marketing", label: "Marketing", perm: "marketing.view" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/admin/email", label: "Email log", perm: "settings.view" },
      { href: "/admin/seo", label: "SEO & redirects", perm: "settings.view" },
      { href: "/admin/site", label: "Site settings", perm: "settings.view" },
      { href: "/admin/users", label: "Users", perm: "users.manage" },
      { href: "/admin/activity", label: "Activity log", perm: "audit.view" },
    ],
  },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => can(user.role, i.perm)) })).filter((s) => s.items.length);

  return (
    <div className="admin min-h-[100dvh] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-[#e6e3de] bg-[#1c1b19] text-[#e8e4dd] lg:sticky lg:top-0 lg:h-[100dvh] lg:overflow-y-auto lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/admin" className="text-sm font-semibold tracking-wide">
            Hot Rock Hove · Admin
          </Link>
          <Link href="/" target="_blank" className="text-xs text-[#b7b0a5] underline-offset-4 hover:underline">
            View site
          </Link>
        </div>
        <AdminNav sections={sections} />
        <div className="border-t border-white/10 px-5 py-4 text-xs text-[#b7b0a5]">
          <p className="truncate text-[#e8e4dd]">{user.name}</p>
          <p className="truncate">
            {user.email} · {ROLE_LABELS[user.role]}
          </p>
          <div className="mt-3 flex gap-3">
            <Link href="/admin/account" className="underline-offset-4 hover:underline">
              My account
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="underline-offset-4 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
