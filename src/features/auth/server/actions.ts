"use server";

import argon2 from "argon2";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { clearLoginAttempts, consumeLoginAttempt } from "@/lib/rate-limit";
import { createAdminSession, revokeCurrentSession } from "./session";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(256),
});

export type LoginState = { error?: string };

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Проверьте email и пароль." };

  const requestHeaders = await headers();
  const requestKey = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!consumeLoginAttempt(requestKey)) {
    return { error: "Слишком много попыток. Повторите через 15 минут." };
  }

  const user = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  const passwordValid = user?.isActive
    ? await argon2.verify(user.passwordHash, parsed.data.password)
    : false;

  if (!user || !passwordValid) {
    logEvent("admin_login_failed", { requestKey });
    return { error: "Неверный email или пароль." };
  }

  clearLoginAttempts(requestKey);
  await createAdminSession(user.id);
  await db.auditLog.create({
    data: { adminUserId: user.id, entityType: "admin_session", action: "login" },
  });
  redirect("/admin");
}

export async function logoutAction() {
  const headersList = await headers();
  await revokeCurrentSession();
  logEvent("admin_logout", { requestKey: headersList.get("x-forwarded-for") ?? "unknown" });
  redirect("/login");
}
