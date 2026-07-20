// Chooses the right Prisma workflow for the environment.
// Local dev (no Postgres DATABASE_URL): SQLite schema + `migrate deploy`.
// Production (Render/Railway sets a postgres:// DATABASE_URL): Postgres schema + `db push`.
import { execSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL || "";
const isPostgres = databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://");

const schema = isPostgres ? "prisma/schema.production.prisma" : "prisma/schema.prisma";
const syncCommand = isPostgres
  ? `npx prisma db push --schema=${schema} --skip-generate`
  : `npx prisma migrate deploy --schema=${schema}`;

console.log(`[prepare-db] Using ${schema}`);
execSync(`npx prisma generate --schema=${schema}`, { stdio: "inherit" });
execSync(syncCommand, { stdio: "inherit" });
