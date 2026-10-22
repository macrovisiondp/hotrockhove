import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getSettingFresh } from "@/lib/settings";
import { ActionForm, TextInput } from "@/components/admin/form";
import { ReviewsEditor } from "@/components/admin/reviews-editor";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { saveReviewsAction } from "./actions";

export const metadata = { title: "Reviews" };

export default async function ReviewsAdmin() {
  const user = await requirePermission("content.view");
  const reviews = await getSettingFresh("reviews");
  const canEdit = can(user.role, "content.edit");

  return (
    <>
      <PageHeader
        title="Google reviews"
        description="Reviews shown in the Reviews section (homepage) and the rating under the homepage heading. Copy them from your Google Business Profile."
      />
      <ActionForm action={saveReviewsAction} disabled={!canEdit}>
        <Card title="Summary" description="Shown next to the reviews and under the homepage heading. Update the count from Google from time to time.">
          <Notice>Only show genuine reviews from Google, copied word for word. Don&apos;t edit their wording.</Notice>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
            <TextInput name="summaryLabel" label="Rating label" defaultValue={reviews.summaryLabel} maxLength={30} placeholder="Excellent" />
            <TextInput name="totalCount" label="Number of Google reviews" defaultValue={String(reviews.totalCount || "")} inputMode="numeric" placeholder="125" />
            <TextInput name="googleUrl" label="Link to your reviews on Google" defaultValue={reviews.googleUrl} placeholder="https://www.google.com/maps/…" />
          </div>
        </Card>
        <Card title="Reviews" description="Shown in this order. Hide a review to keep it here without showing it.">
          <ReviewsEditor initial={reviews.items} />
        </Card>
      </ActionForm>
    </>
  );
}
