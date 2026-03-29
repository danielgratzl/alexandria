import { Hono } from "hono";
import { db } from "../db/index.js";
import { locations } from "../db/schema.js";

const app = new Hono();

app.get("/", async (c) => {
  const results = await db.select().from(locations).orderBy(locations.name);
  return c.json(results);
});

export default app;
