import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function main() {
  const db = new PGlite();

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create or replace function auth.role() returns text
    language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
    $$;
    create or replace function auth.jwt() returns jsonb
    language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
  `);

  for (const file of [
    "20261103000100_core.sql",
    "20261103000200_invitations.sql",
    "20261103000300_genealogy.sql",
    "20261103000400_rls.sql",
    "20261103000500_rpc.sql",
  ]) {
    const sql = readFileSync(join("supabase", "migrations", file), "utf8");
    try {
      await db.exec(sql);
      console.log(`ok ${file}`);
    } catch (error) {
      console.error(`FAILED ${file}`);
      throw error;
    }
  }

  console.log("all migrations applied");
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
