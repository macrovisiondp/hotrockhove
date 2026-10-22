"use server";

import { audit } from "@/lib/audit";
import { failure, guarded, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { saveSetting, validateSetting } from "@/lib/settings";
import { invalidate } from "@/domain/content";

export async function saveReviewsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("content.edit");
    let items: unknown;
    try {
      items = JSON.parse(str(fd, "items") || "[]");
    } catch {
      return failure("The review list couldn't be read. Reload the page and try again.");
    }
    const count = str(fd, "totalCount");
    const parsed = validateSetting("reviews", {
      summaryLabel: str(fd, "summaryLabel"),
      totalCount: count === "" ? 0 : Number(count),
      googleUrl: str(fd, "googleUrl"),
      items,
    });
    if (!parsed.success) return zodFailure(parsed.error, "Check the highlighted fields: every review needs a name and text.");
    await saveSetting("reviews", parsed.data, user.id);
    invalidate("pages");
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "reviews", metadata: { reviews: parsed.data.items.length } });
    return success("Reviews saved.");
  });
}
