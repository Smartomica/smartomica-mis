import { prisma } from "./client";
import { seedDatabase } from "./seed";

export async function ensureDB() {
  await prisma.$connect();

  try {
    if ((await prisma.user.count()) !== 0) return;
  } catch (error) {
    // expected
  }

  await seedDatabase();
}
