import { createCookieSessionStorage, redirect } from "react-router";
import { SESSION_SECRET } from "~/env.server";
import { prisma } from "~/lib/db/client";
import { ADMIN_EMAIL, CLEVEL_EMAIL, DEMO_EMAIL } from "~/lib/db/seed";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  tokensUsed: number;
  tokensRemaining: number;
}

// Hard-coded passwords for demo accounts - replace with OAuth later
const DEMO_PASSWORDS = {
  [ADMIN_EMAIL]: "zTX6iJsgo86w4HMWRjHu@u!U", // Do not worry, it is unique
  [DEMO_EMAIL]: "demo123demo123",
  [CLEVEL_EMAIL]: "demo123demo123",
};

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function createUserSession(user: User, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", user.id);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function getUser(request: Request): Promise<User | null> {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie"),
  );
  const userId = session.get("userId");

  if (!userId || typeof userId !== "string") {
    return null;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!dbUser) {
    return null;
  }

  // Update last login time
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || "",
    role: dbUser.role.toLowerCase() as "admin" | "user",
    tokensUsed: dbUser.tokensUsed,
    tokensRemaining: dbUser.tokensRemaining,
  };
}

export async function requireUser(request: Request): Promise<User> {
  const user = await getUser(request);
  if (!user) {
    throw redirect("/login");
  }
  return user;
}

export async function logout(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie"),
  );

  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function login(
  email: string,
  password: string,
): Promise<User | null> {
  // Simple authentication for demo accounts - replace with OAuth
  const expectedPassword = DEMO_PASSWORDS[email as keyof typeof DEMO_PASSWORDS];

  if (!expectedPassword || password !== expectedPassword) {
    return null;
  }

  // Find user in database
  const dbUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!dbUser) {
    return null;
  }

  // Update last login time
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name || "",
    role: dbUser.role.toLowerCase() as "admin" | "user",
    tokensUsed: dbUser.tokensUsed,
    tokensRemaining: dbUser.tokensRemaining,
  };
}
