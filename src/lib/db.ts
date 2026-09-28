import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

function createDb() {
  let url = process.env.DATABASE_URL ?? "file:./dev.db";
  // Resolve relative file: URLs to absolute paths so they work regardless of CWD
  if (url.startsWith("file:./") || url.startsWith("file:dev.db")) {
    const relative = url.replace("file:", "");
    const absolute = path.resolve(process.cwd(), relative);
    url = `file:${absolute}`;
  }
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
