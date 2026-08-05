import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;

if (!email || !password) {
  console.log("Initial administrator is not configured; skipping bootstrap.");
  process.exit(0);
}

if (password.length < 16) {
  console.error("INITIAL_ADMIN_PASSWORD must contain at least 16 characters.");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const existing = await db.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log("Initial administrator already exists; skipping bootstrap.");
  } else {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await db.adminUser.create({
      data: { email, passwordHash, displayName: "Администратор ИРИС" },
    });
    console.log("Initial administrator created.");
  }
} finally {
  await db.$disconnect();
}
