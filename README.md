# Alexandria

A personal book library management app. Catalog your books with details like title, author, ISBN, format, reading status, and location. Includes cover images, full-text search, library statistics, and OpenLibrary integration for metadata lookup.

## Tech Stack

- **Frontend:** React, TypeScript, TailwindCSS, React Router, React Query
- **Backend:** Hono, SQLite, Drizzle ORM
- **Build:** Vite

## Running Locally

Prerequisites: Node.js 22+

```sh
npm install
npm run dev
```

This starts both the client (http://localhost:3000) and server (http://localhost:3001) concurrently.

### Other Commands

| Command | Description |
|---|---|
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run db:generate` | Generate migration files |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:push` | Push schema changes directly |

## Docker

```sh
docker compose up
```
