import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, sessions } from "../db/schema.js";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuffer, derived);
}

const SESSION_DAYS = 30;

function createSession(userId: string) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.insert(sessions).values({ id, userId, expiresAt }).run();
  return { id, expiresAt };
}

const app = new Hono();

// Check current session
app.get("/me", async (c) => {
  // Check if admin needs password setup (before checking session)
  const admin = await db.select().from(users).where(eq(users.username, "admin")).get();
  if (admin && !admin.passwordHash) {
    return c.json({ user: null, needsPassword: true });
  }

  const sessionId = getCookie(c, "session");
  if (!sessionId) return c.json({ error: "Not authenticated" }, 401);

  const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session || new Date(session.expiresAt) < new Date()) {
    if (session) db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    deleteCookie(c, "session");
    return c.json({ error: "Session expired" }, 401);
  }

  const user = await db.select().from(users).where(eq(users.id, session.userId)).get();
  if (!user) return c.json({ error: "User not found" }, 401);

  return c.json({
    user: { id: user.id, username: user.username },
    needsPassword: false,
  });
});

// Set initial password (only works if no password set yet)
app.post("/setup", async (c) => {
  const { password } = await c.req.json() as { password: string };
  if (!password || password.length < 4) {
    return c.json({ error: "Password must be at least 4 characters" }, 400);
  }

  const user = await db.select().from(users).where(eq(users.username, "admin")).get();
  if (!user) return c.json({ error: "No admin user found" }, 500);
  if (user.passwordHash) return c.json({ error: "Password already set" }, 400);

  const passwordHash = await hashPassword(password);
  db.update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();

  // Auto-login after setup
  const session = createSession(user.id);
  setCookie(c, "session", session.id, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return c.json({ user: { id: user.id, username: user.username } });
});

// Login
app.post("/login", async (c) => {
  const { username, password } = await c.req.json() as { username: string; password: string };

  const user = await db.select().from(users).where(eq(users.username, username)).get();
  if (!user || !user.passwordHash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const session = createSession(user.id);
  setCookie(c, "session", session.id, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return c.json({ user: { id: user.id, username: user.username } });
});

// Logout
app.post("/logout", async (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    deleteCookie(c, "session");
  }
  return c.json({ ok: true });
});

export default app;
