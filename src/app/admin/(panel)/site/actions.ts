"use server";

import { revalidateTag } from "next/cache";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { getSettingFresh, saveSetting, validateSetting } from "@/lib/settings";
import { invalidate } from "@/domain/content";

export async function saveFeaturesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const before = await getSettingFresh("features");
    const parsed = validateSetting("features", {
      maintenanceMode: bool(fd, "maintenanceMode"),
      maintenanceMessage: str(fd, "maintenanceMessage"),
      announcementEnabled: bool(fd, "announcementEnabled"),
      announcementText: str(fd, "announcementText"),
      announcementHref: str(fd, "announcementHref"),
      reviewsEnabled: bool(fd, "reviewsEnabled"),
      reviewsEmbedSrc: str(fd, "reviewsEmbedSrc"),
      vrTourEnabled: bool(fd, "vrTourEnabled"),
      vrTourUrl: str(fd, "vrTourUrl"),
      homeSoundsEnabled: bool(fd, "homeSoundsEnabled"),
      sizzleSoundUrl: str(fd, "sizzleSoundUrl"),
      mooSoundUrl: str(fd, "mooSoundUrl"),
    });
    if (!parsed.success) return zodFailure(parsed.error);
    if (parsed.data.announcementEnabled && !parsed.data.announcementText)
      return failure("Write the announcement text, or switch the bar off.", { announcementText: "Required when the bar is on" });
    await saveSetting("features", parsed.data, user.id);
    invalidate("pages");
    await audit("settings.update", {
      actorUserId: user.id,
      entityType: "settings",
      entityId: "features",
      metadata: { maintenanceMode: parsed.data.maintenanceMode, changedMaintenance: before.maintenanceMode !== parsed.data.maintenanceMode },
    });
    return success(
      parsed.data.maintenanceMode
        ? "Saved. Maintenance mode is ON: visitors see the maintenance page (signed-in staff still see the site). Takes effect within a minute."
        : "Saved.",
    );
  });
}

/**
 * Clears every public cache so the site shows the database as it is now. Admin saves
 * already do this for what they change; this covers edits made outside the admin
 * (scripts, imports).
 */
export async function refreshSiteCacheAction(): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    invalidate("pages", "nav", "menu", "offers", "media", "popups", "redirects");
    revalidateTag("settings", { expire: 0 });
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "cache", metadata: { action: "refresh" } });
    return success("Site content refreshed. Visitors see the latest content on their next page load.");
  });
}

export async function saveConsentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const current = await getSettingFresh("consent");
    // Analytics is set under Connections; keep it as stored.
    const parsed = validateSetting("consent", { ...current, bannerText: str(fd, "bannerText") });
    if (!parsed.success) return zodFailure(parsed.error);
    await saveSetting("consent", parsed.data, user.id);
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "consent", metadata: { analytics: parsed.data.analyticsProvider } });
    return success("Saved.");
  });
}
