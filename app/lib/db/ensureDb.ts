import { spawn } from "node:child_process";
import { prisma } from "./client";
import { seedDatabase } from "./seed";

export async function ensureDB() {
  await prisma.$connect();

  try {
    if ((await prisma.user.count()) !== 0) return;
  } catch (error) {
    // expected
  }

  await new Promise<void>(function (resolve, reject) {
    const child = spawn("npm", ["run", "db:init"], { env: process.env });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `npm run db:init exited with code ${code}: ${child.stderr.toString().trim()}`,
          ),
        );
      }
    });
  });
  await seedDatabase();
}
