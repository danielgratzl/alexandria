import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join, extname } from "path";

const BASE_DIR = "./data/covers";

export type ImageSubdir = "books" | "authors";

function dirFor(subdir: ImageSubdir): string {
  return join(BASE_DIR, subdir);
}

export function ensureCoversDir() {
  for (const sub of ["books", "authors"] as const) {
    const dir = dirFor(sub);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function coverPath(subdir: ImageSubdir, filename: string): string {
  return join(dirFor(subdir), filename);
}

export function deleteCoverFile(subdir: ImageSubdir, filename: string | null) {
  if (!filename) return;
  const path = coverPath(subdir, filename);
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // Best effort
  }
}

export async function downloadCover(subdir: ImageSubdir, url: string): Promise<string | null> {
  ensureCoversDir();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    let ext = ".jpg";
    if (contentType.includes("png")) ext = ".png";
    else if (contentType.includes("webp")) ext = ".webp";
    else if (contentType.includes("gif")) ext = ".gif";

    const filename = `${crypto.randomUUID()}${ext}`;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(coverPath(subdir, filename), buffer);
    return filename;
  } catch {
    return null;
  }
}

export function saveCoverBuffer(subdir: ImageSubdir, buffer: Buffer, originalName: string): string {
  ensureCoversDir();
  const ext = extname(originalName).toLowerCase() || ".jpg";
  const filename = `${crypto.randomUUID()}${ext}`;
  writeFileSync(coverPath(subdir, filename), buffer);
  return filename;
}
