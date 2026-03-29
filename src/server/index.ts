import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie } from "hono/cookie";
import { logger } from "hono/logger";
import { eq } from "drizzle-orm";
import { initializeDatabase, db } from "./db/index.js";
import { sessions } from "./db/schema.js";
import authRoutes from "./routes/auth.js";
import booksRoutes from "./routes/books.js";
import authorsRoutes from "./routes/authors.js";
import lookupRoutes from "./routes/lookup.js";
import searchRoutes from "./routes/search.js";
import coversRoutes from "./routes/covers.js";
import locationsRoutes from "./routes/locations.js";
import importRoutes from "./routes/import.js";
import statsRoutes from "./routes/stats.js";
import { ensureCoversDir } from "./services/covers.js";

const app = new Hono();

app.use("*", logger());
app.use("/api/*", cors());

// Global error handler for API routes
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal server error" }, 500);
});

// Auth routes (public)
app.route("/api/auth", authRoutes);

// Auth middleware — protect all other API routes
app.use("/api/*", async (c, next) => {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return c.json({ error: "Unauthorized" }, 401);

  const session = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!session || new Date(session.expiresAt) < new Date()) {
    if (session) db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

// Protected API routes
app.route("/api/books", booksRoutes);
app.route("/api/authors", authorsRoutes);
app.route("/api/lookup", lookupRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/covers", coversRoutes);
app.route("/api/locations", locationsRoutes);
app.route("/api/import", importRoutes);
app.route("/api/stats", statsRoutes);

// In production, serve the built Vite assets
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  app.get("/*", serveStatic({ root: "./dist/client", path: "index.html" }));
}

async function start() {
  await initializeDatabase();
  ensureCoversDir();

  const port = Number(process.env.PORT || 3001);
  console.log(`Alexandria server running on http://localhost:${port}`);

  const server = serve({ fetch: app.fetch, port });
  server.timeout = 10 * 60 * 1000; // 10 minutes
}

start();
