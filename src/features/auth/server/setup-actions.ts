"use server";

import { createHash, timingSafeEqual } from "crypto";
import argon2 from "argon2";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminSession } from "./session";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { consumeSetupAttempt } from "@/lib/rate-limit";

const setupSchema = z.object({
  setupToken: z.string().min(1).max(512),
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(16).max(256),
  passwordConfirmation: z.string().min(16).max(256),
}).refine((value) => value.password === value.passwordConfirmation, {
  path: ["passwordConfirmation"],
  message: "Пароли не совпадают.",
});

export type SetupState = { error?: string };

function matchesSetupToken(provided: string, expected: string) {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function setupAdminAction(_: SetupState, formData: FormData): Promise<SetupState> {
  const requestHeaders = await headers();
  const requestKey = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!consumeSetupAttempt(requestKey)) {
    return { error: "Слишком много попыток. Повторите через 15 минут." };
  }

  const parsed = setupSchema.safeParse({
    setupToken: formData.get("setupToken"),
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте заполнение полей." };
  }

  const expectedToken = process.env.ADMIN_SETUP_TOKEN;
  if (!expectedToken || expectedToken.length < 32 || !matchesSetupToken(parsed.data.setupToken, expectedToken)) {
    logEvent("admin_setup_rejected", { requestKey });
    return { error: "Неверный одноразовый код настройки." };
  }

  const existingAdmin = await db.adminUser.count();
  if (existingAdmin > 0) return { error: "Администратор уже создан. Перейдите на страницу входа." };

  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
  try {
    const admin = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(76218431)`;
      if (await tx.adminUser.count()) throw new Error("ADMIN_ALREADY_EXISTS");

      const created = await tx.adminUser.create({
        data: {
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          passwordHash,
        },
      });
      await tx.auditLog.create({
        data: { adminUserId: created.id, entityType: "admin_user", entityId: created.id, action: "initial_setup" },
      });
      return created;
    });

    await createAdminSession(admin.id);
    logEvent("admin_setup_completed", { adminUserId: admin.id });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_ALREADY_EXISTS") {
      return { error: "Администратор уже создан. Перейдите на страницу входа." };
    }
    logEvent("admin_setup_failed", { requestKey });
    return { error: "Не удалось создать администратора. Повторите попытку." };
  }

  redirect("/admin?notice=Администратор создан");
}
