"use server";

import { audit } from "@/lib/audit";
import { bool, guarded, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";
import { DAYS, getSettingFresh, saveSetting, validateSetting, type BusinessSettings } from "@/lib/settings";
import { invalidate } from "@/domain/content";

function changedKeys(a: Record<string, unknown>, b: Record<string, unknown>) {
  return Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

export async function saveBusinessAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const current = await getSettingFresh("business");

    const hoursConfigured = bool(fd, "hoursEnabled");
    const hours = hoursConfigured
      ? DAYS.map((day) => ({
          day,
          closed: bool(fd, `hours.${day}.closed`),
          opens: str(fd, `hours.${day}.opens`) || "12:00",
          closes: str(fd, `hours.${day}.closes`) || "22:00",
        }))
      : [];

    const next: BusinessSettings = {
      name: str(fd, "name"),
      tagline: str(fd, "tagline"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      addressLine1: str(fd, "addressLine1"),
      addressLine2: str(fd, "addressLine2"),
      town: str(fd, "town"),
      postcode: str(fd, "postcode").toUpperCase(),
      country: str(fd, "country"),
      mapUrl: str(fd, "mapUrl"),
      hours,
      hoursNote: str(fd, "hoursNote"),
      bookTableUrl: str(fd, "bookTableUrl"),
      facebookUrl: str(fd, "facebookUrl"),
      instagramUrl: str(fd, "instagramUrl"),
      tiktokUrl: str(fd, "tiktokUrl"),
      footerBlurb: str(fd, "footerBlurb"),
      confirmed: { contact: bool(fd, "confirmed.contact"), hours: bool(fd, "confirmed.hours"), socials: bool(fd, "confirmed.socials") },
    };

    const parsed = validateSetting("business", next);
    if (!parsed.success) return zodFailure(parsed.error);

    await saveSetting("business", parsed.data, user.id);
    invalidate("pages");
    const changed = changedKeys(current as Record<string, unknown>, parsed.data as Record<string, unknown>);
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "business", metadata: { changed } });
    return success(changed.length ? `Saved. Updated: ${changed.join(", ")}. The website now uses the new details.` : "No changes to save.");
  });
}

export async function saveBrandAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertPermission("settings.edit");
    const parsed = validateSetting("brand", {
      logoUrl: str(fd, "logoUrl"),
      faviconUrl: str(fd, "faviconUrl"),
      accentColour: str(fd, "accentColour").toLowerCase(),
    });
    if (!parsed.success) return zodFailure(parsed.error);
    await saveSetting("brand", parsed.data, user.id);
    invalidate("pages");
    await audit("settings.update", { actorUserId: user.id, entityType: "settings", entityId: "brand" });
    return success("Brand settings saved.");
  });
}
