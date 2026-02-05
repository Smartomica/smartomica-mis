import "dotenv/config";
import { PrismaClient } from "~/generated/client/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Create PostgreSQL pool and adapter for Prisma v7
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

// Singleton pattern for Prisma client
let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ adapter });
} else {
  // In development, use a global variable so the client doesn't restart on every reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      adapter,
      log: ["query", "error", "warn"],
    });
  }
  prisma = global.__prisma;
}

export { prisma };

// Export types for use in the app
export type {
  User,
  Document,
  ProcessingJob,
  TokenTransaction,
  UserRole,
  DocumentStatus,
  ProcessingMode,
  JobType,
  JobStatus,
  TokenTransactionType,
} from "~/generated/client/client.js";
