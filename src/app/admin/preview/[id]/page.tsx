import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { PageContent } from "@/domain/render-page";
import { parseSections } from "@/domain/sections";
import { requirePermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";

export const metadata = { title: "Preview", robots: { index: false, follow: false } };

/** Staff-only preview of a page (including drafts and hidden sections removed). */
export default async function Preview({ params }: PageProps<"/admin/preview/[id]">) {
  await requirePermission("content.view");
  const { id } = await params;
  const page = await db.query.pages.findFirst({ where: eq(t.pages.id, id) }).catch(() => null);
  if (!page) notFound();
  const brand = await getSettingFresh("brand");
  const sections = parseSections(page.sections).sections.filter((s) => !s.hidden);
  return (
    <div className="site relative min-h-[100dvh]" style={{ ["--brand-accent" as string]: brand.accentColour }}>
      <div className="sticky top-0 z-[60] flex items-center justify-between gap-4 bg-bronze px-4 py-2 text-sm text-ink-950">
        <span>
          <strong>Preview</strong> of “{page.title}” ({page.status === "published" ? "published" : "draft, not visible to visitors"}). Header and footer are omitted.
        </span>
        <Link href={`/admin/pages/${page.id}`} className="underline underline-offset-4">
          Back to editor
        </Link>
      </div>
      <main>
        <PageContent page={{ slug: page.slug, title: page.title, sections }} />
      </main>
    </div>
  );
}
