"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, ne } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db, t } from "@/db";
import type { UserRole } from "@/db/schema";
import { audit } from "@/lib/audit";
import { bool, failure, guarded, str, success, zodFailure, type ActionState } from "@/lib/actions";
import { assertPermission } from "@/lib/session";

const roleSchema = z.enum(["owner", "admin", "editor", "viewer"]);

function tempPassword() {
  return randomBytes(12).toString("base64url");
}

async function activeOwnersExcept(userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(t.users)
    .where(and(eq(t.users.role, "owner"), eq(t.users.active, true), ne(t.users.id, userId)));
  return n;
}

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await assertPermission("users.manage");
    const parsed = z
      .object({ name: z.string().trim().min(1, "Name is required").max(80), email: z.string().trim().toLowerCase().email(), role: roleSchema })
      .safeParse({ name: str(fd, "name"), email: str(fd, "email"), role: str(fd, "role") });
    if (!parsed.success) return zodFailure(parsed.error);
    if (await db.query.users.findFirst({ where: eq(t.users.email, parsed.data.email) })) return failure("A user with that email already exists.", { email: "Already exists" });
    const password = tempPassword();
    const id = randomUUID();
    await db.insert(t.users).values({ id, ...parsed.data, emailVerified: true });
    await db.insert(t.accounts).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: await hashPassword(password) });
    await audit("user.create", { actorUserId: actor.id, entityType: "user", entityId: id, metadata: { role: parsed.data.role } });
    return success(
      `Account created for ${parsed.data.email}. Temporary password (shown once): ${password}. Share it privately and ask them to change it under My account.`,
    );
  });
}

export async function updateUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await assertPermission("users.manage");
    const id = str(fd, "id");
    const role = roleSchema.safeParse(str(fd, "role"));
    if (!role.success) return failure("Choose a role.");
    const active = bool(fd, "active");
    const target = await db.query.users.findFirst({ where: eq(t.users.id, id) });
    if (!target) return failure("Unknown user.");
    if (id === actor.id && (!active || role.data !== "owner")) return failure("You can't remove your own owner access or deactivate yourself.");
    if (target.role === "owner" && (role.data !== "owner" || !active) && (await activeOwnersExcept(id)) === 0)
      return failure("There must always be at least one active owner.");
    await db.update(t.users).set({ role: role.data as UserRole, active }).where(eq(t.users.id, id));
    // Deactivation signs the user out everywhere.
    if (!active) await db.delete(t.sessions).where(eq(t.sessions.userId, id));
    await audit("user.update", { actorUserId: actor.id, entityType: "user", entityId: id, metadata: { role: role.data, active } });
    return success(active ? "Saved." : "Saved. The user has been signed out and can't sign in.");
  });
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const actor = await assertPermission("users.manage");
    const id = str(fd, "id");
    const target = await db.query.users.findFirst({ where: eq(t.users.id, id) });
    if (!target) return failure("Unknown user.");
    const password = tempPassword();
    const hash = await hashPassword(password);
    const account = await db.query.accounts.findFirst({ where: and(eq(t.accounts.userId, id), eq(t.accounts.providerId, "credential")) });
    if (account) await db.update(t.accounts).set({ password: hash }).where(eq(t.accounts.id, account.id));
    else await db.insert(t.accounts).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: hash });
    await db.delete(t.sessions).where(eq(t.sessions.userId, id));
    await audit("user.update", { actorUserId: actor.id, entityType: "user", entityId: id, metadata: { passwordReset: true } });
    return success(`New temporary password for ${target.email} (shown once): ${password}`);
  });
}
