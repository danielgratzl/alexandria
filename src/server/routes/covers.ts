import { Hono } from "hono";
import { readFileSync, existsSync } from "fs";
import { extname } from "path";
import { coverPath, saveCoverBuffer, type ImageSubdir } from "../services/covers.js";

const app = new Hono();

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const VALID_SUBDIRS = new Set<string>(["books", "authors"]);

// Serve images: /covers/books/:filename or /covers/authors/:filename
app.get("/:subdir/:filename", (c) => {
  const subdir = c.req.param("subdir");
  const filename = c.req.param("filename");

  if (!VALID_SUBDIRS.has(subdir)) return c.notFound();
  if (filename.includes("..") || filename.includes("/")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const path = coverPath(subdir as ImageSubdir, filename);
  if (!existsSync(path)) return c.notFound();

  const ext = extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const data = readFileSync(path);

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// Upload: /covers/upload/books or /covers/upload/authors
app.post("/upload/:subdir", async (c) => {
  const subdir = c.req.param("subdir");
  if (!VALID_SUBDIRS.has(subdir)) {
    return c.json({ error: "Invalid type" }, 400);
  }

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = saveCoverBuffer(subdir as ImageSubdir, buffer, file.name);

  return c.json({ filename });
});

export default app;
