import { PrismaClient } from "@prisma/client";

declare global {
  var irisPrisma: PrismaClient | undefined;
}

export const db = globalThis.irisPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalThis.irisPrisma = db;
}
