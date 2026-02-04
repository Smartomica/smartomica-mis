import "dotenv/config";
import { PrismaClient } from "../../../generated/client/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

console.log("Testing Prisma v7 connection...");

// Test connection parameters
console.log("DATABASE_URL:", process.env.DATABASE_URL);

try {
  // Create PostgreSQL pool
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log("Pool created successfully");

  // Test raw pool connection
  const client = await pool.connect();
  const result = await client.query('SELECT NOW()');
  console.log("Direct pool connection successful:", result.rows[0]);
  client.release();

  // Create adapter
  const adapter = new PrismaPg(pool);
  console.log("Adapter created successfully");

  // Create Prisma client
  const prisma = new PrismaClient({ adapter });
  console.log("Prisma client created successfully");

  // Test Prisma query
  const count = await prisma.user.count();
  console.log("User count:", count);

  // Close connections
  await pool.end();
  console.log("Test completed successfully");

} catch (error) {
  console.error("Connection test failed:", error);
}