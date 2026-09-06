import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UnauthorizedError } from "@/lib/errors";

const COOKIE_NAME = "iris_admin_session";
const SESSION_HOURS = 12;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(adminUserId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await db.adminSession.create({
    data: { adminUserId, tokenHash: tokenHash(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.adminSession.findFirst({
    where: {
      tokenHash: tokenHash(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      adminUser: { isActive: true },
    },
    include: { adminUser: true },
  });

  return session?.adminUser ?? null;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.adminSession.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function requireAdminApi() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new UnauthorizedError();
  return admin;
}
