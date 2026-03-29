import { Hono } from "hono";
import { lookupIsbn, searchByTitle } from "../services/openlibrary.js";

const app = new Hono();

app.get("/isbn/:isbn", async (c) => {
  const isbn = c.req.param("isbn");
  const result = await lookupIsbn(isbn);
  if (!result) return c.json({ error: "Book not found" }, 404);
  return c.json(result);
});

app.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json([]);
  const results = await searchByTitle(q);
  return c.json(results);
});

export default app;
