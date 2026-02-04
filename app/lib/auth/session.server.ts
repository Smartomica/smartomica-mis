import { createCookieSessionStorage, redirect } from "react-router";
import { SESSION_SECRET } from "~/env.server";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

// Hard-coded accounts - replace with real OAuth later
const USERS: User[] = [
  {
    id: "1",
    email: "admin@smartomica.org",
    name: "Admin User",
    role: "admin",
  },
  {
    id: "2", 
    email: "user@smartomica.org",
    name: "Regular User",
    role: "user",
  },
];

// Hard-coded passwords - replace with OAuth
const PASSWORDS = {
  "admin@smartomica.org": "admin123",
  "user@smartomica.org": "user123",
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
    request.headers.get("Cookie")
  );
  const userId = session.get("userId");
  
  if (!userId || typeof userId !== "string") {
    return null;
  }
  
  return USERS.find(user => user.id === userId) || null;
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
    request.headers.get("Cookie")
  );
  
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function login(email: string, password: string): Promise<User | null> {
  // Simple authentication - replace with OAuth
  const expectedPassword = PASSWORDS[email as keyof typeof PASSWORDS];
  
  if (!expectedPassword || password !== expectedPassword) {
    return null;
  }
  
  return USERS.find(user => user.email === email) || null;
}