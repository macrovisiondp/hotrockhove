import type { UserRole } from "@/db/schema";

/**
 * Permission matrix. Checked server-side in every admin page, server action and
 * route handler — hiding a link is never the only protection.
 *
 * - viewer: read-only dashboard, content and settings (no submissions or subscribers)
 * - editor: content, menu, offers, media, pop-ups, navigation; reads submissions
 * - admin:  everything an editor can do + business settings, forms, email, SEO,
 *           redirects, submissions export/delete, subscribers
 * - owner:  everything + user management and provider credentials
 */
export const PERMISSIONS = {
  "dashboard.view": ["owner", "admin", "editor", "viewer"],
  "content.view": ["owner", "admin", "editor", "viewer"],
  "content.edit": ["owner", "admin", "editor"],
  "content.publish": ["owner", "admin", "editor"],
  "content.delete": ["owner", "admin"],
  "menu.edit": ["owner", "admin", "editor"],
  "media.upload": ["owner", "admin", "editor"],
  "media.delete": ["owner", "admin"],
  "popups.edit": ["owner", "admin", "editor"],
  "nav.edit": ["owner", "admin", "editor"],
  "settings.view": ["owner", "admin", "editor", "viewer"],
  "settings.edit": ["owner", "admin"],
  "seo.edit": ["owner", "admin"],
  "redirects.edit": ["owner", "admin"],
  "forms.edit": ["owner", "admin"],
  "submissions.view": ["owner", "admin", "editor"],
  "submissions.manage": ["owner", "admin"],
  "submissions.export": ["owner", "admin"],
  "subscribers.view": ["owner", "admin"],
  "subscribers.manage": ["owner", "admin"],
  "email.configure": ["owner", "admin"],
  "secrets.edit": ["owner"],
  "users.manage": ["owner"],
  "audit.view": ["owner", "admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};
