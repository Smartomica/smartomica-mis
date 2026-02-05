import "dotenv/config";
import { prisma } from "./client";
import type { UserRole } from "~/generated/client/client.js";

export async function seedDatabase() {
  try {
    // Create demo admin user
    const adminUser = await prisma.user.upsert({
      where: { email: "admin@smartomica.org" },
      update: {
        name: "Administrator",
        role: "ADMIN" as UserRole,
        tokensRemaining: 10000, // Admin gets more tokens
        lastLoginAt: new Date(),
      },
      create: {
        email: "admin@smartomica.org",
        name: "Administrator",
        role: "ADMIN" as UserRole,
        tokensUsed: 0,
        tokensRemaining: 10000,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      },
    });

    // Create demo regular user
    const demoUser = await prisma.user.upsert({
      where: { email: "demo@smartomica.org" },
      update: {
        name: "Demo User",
        role: "USER" as UserRole,
        tokensRemaining: 1000,
        lastLoginAt: new Date(),
      },
      create: {
        email: "demo@smartomica.org",
        name: "Demo User",
        role: "USER" as UserRole,
        tokensUsed: 150, // Some usage history
        tokensRemaining: 850,
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
        amount: 1000,
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
