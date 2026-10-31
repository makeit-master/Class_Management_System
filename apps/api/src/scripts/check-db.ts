import { getPrisma, disconnectPrisma } from "../lib/prisma.js";

async function main() {
  const prisma = getPrisma();
  const result = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;
  if (result[0]?.result !== 1) throw new Error("Unexpected database response");
  console.log("Database connection OK");
}
main()
  .catch((error) => { console.error("Database check failed:", error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => { await disconnectPrisma(); });
