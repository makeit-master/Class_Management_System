import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";

let client: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!env.databaseUrl) {
    throw new Error("Missing DATABASE_URL or DIRECT_URL in apps/api/.env");
  }
  if (!client) {
    const adapter = new PrismaPg({ connectionString: env.databaseUrl });
    client = new PrismaClient({ adapter });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
