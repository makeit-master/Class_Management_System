import "dotenv/config";
import { hash } from "bcryptjs";
import { getPrisma, disconnectPrisma } from "../lib/prisma.js";

async function main(): Promise<void> {
  const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const fullName = process.env.BOOTSTRAP_FULL_NAME?.trim();
  const password = process.env.BOOTSTRAP_PASSWORD;
  if (!email || !fullName || !password || password.length < 12 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set BOOTSTRAP_EMAIL, BOOTSTRAP_FULL_NAME and BOOTSTRAP_PASSWORD (>=12 chars) in this process");
  }
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new Error("This email already exists; no changes made");
  const passwordHash = await hash(password, 12);
  await prisma.user.create({
    data: { fullName, email, passwordHash, role: "TEACHER", teacherProfile: { create: {} } },
  });
  console.log("Teacher account created. No password was logged.");
}
main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Bootstrap failed");
  process.exitCode = 1;
}).finally(async () => { delete process.env.BOOTSTRAP_PASSWORD; await disconnectPrisma(); });
