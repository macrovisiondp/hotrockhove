import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/db/schema";
import { auth } from "./auth";
import { can, type Permission } from "./rbac";

export type StaffUser = { id: string; name: string; email: string; role: UserRole };

const ROLES: readonly UserRole[] = ["owner", "admin", "editor", "viewer"];

export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as
    | { id: string; name: string; email: string; role?: string; active?: boolean }
    | undefined;
  if (!user || user.active === false) return null;
  if (!ROLES.includes(user.role as UserRole)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as UserRole };
});

/** Guard for admin pages: signed-in staff only. */
export async function requireStaff(): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Guard for admin pages that need a specific permission. */
export async function requirePermission(permission: Permission): Promise<StaffUser> {
  const user = await requireStaff();
  if (!can(user.role, permission)) redirect("/admin?error=forbidden");
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("You don't have permission to do that.");
  }
}

/**
 * Guard for server actions: never redirects (actions report errors to the form).
 * Throws ForbiddenError, which `action()` in src/lib/actions.ts turns into a message.
 */
export async function assertPermission(permission: Permission): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user || !can(user.role, permission)) throw new ForbiddenError();
  return user;
}
