
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Load apps/api/.env when running from the API workspace.
try {
  process.loadEnvFile(".env");
} catch {
  // Environment variables may already be supplied by the shell.
}

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const fullName = process.env.BOOTSTRAP_ADMIN_FULL_NAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

async function main() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing.");
  }

  if (!email || !fullName || !password) {
    throw new Error(
      "Missing BOOTSTRAP_ADMIN_EMAIL, " +
      "BOOTSTRAP_ADMIN_FULL_NAME, or " +
      "BOOTSTRAP_ADMIN_PASSWORD."
    );
  }

  if (password.length < 12) {
    throw new Error(
      "Admin password must have at least 12 characters."
    );
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error(
        "A user with this email already exists. " +
        "No changes were made."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: "ADMIN",
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    console.log("Admin account created successfully.");
    console.log(admin);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Failed to create admin:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
