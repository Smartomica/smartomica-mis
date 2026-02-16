import "dotenv/config";
import { prisma } from "./client";
import { DATABASE_URL } from "~/env.server";
import type { UserRole } from "~/generated/client/client.js";

export const ADMIN_EMAIL = "boris.valdman@smartomica.com";
export const DEMO_EMAIL = "demo@smartomica.com";

export async function seedDatabase() {
  console.log("DB url:", DATABASE_URL);
  try {
    // Create demo admin user
    const adminUser = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        name: "Administrator",
        role: "ADMIN" as UserRole,
        tokensRemaining: 1e5, // Admin gets more tokens
        lastLoginAt: new Date(),
      },
      create: {
        email: ADMIN_EMAIL,
        name: "Administrator",
        role: "ADMIN" as UserRole,
        tokensUsed: 0,
        tokensRemaining: 1e5,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    // Create demo regular user
    const demoUser = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: {
        name: "Demo User",
        role: "USER" as UserRole,
        tokensRemaining: 1e5,
        lastLoginAt: new Date(),
      },
      create: {
        email: DEMO_EMAIL,
        name: "Demo User",
        role: "USER" as UserRole,
        tokensUsed: 150, // Some usage history
        tokensRemaining: 1e5 - 150,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    // Create initial token transaction for admin
    await prisma.tokenTransaction.upsert({
      where: {
        id: "admin-initial-grant",
      },
      update: {},
      create: {
        id: "admin-initial-grant",
        type: "INITIAL_GRANT",
        amount: 10000,
        reason: "Initial admin grant",
        userId: adminUser.id,
        createdAt: new Date(),
      },
    });

    // Create initial token transaction for demo user
    await prisma.tokenTransaction.upsert({
      where: {
        id: "demo-initial-grant",
      },
      update: {},
      create: {
        id: "demo-initial-grant",
        type: "INITIAL_GRANT",
        amount: 1e5,
        reason: "Initial user grant",
        userId: demoUser.id,
        createdAt: new Date(),
      },
    });

    console.log("Database seeded successfully");
    return { adminUser, demoUser };
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Run seed if called directly
if (import.meta.url.endsWith(process.argv[1])) {
  seedDatabase()
    .then(() => {
      console.log("Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}
