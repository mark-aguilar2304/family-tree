import { PGlite } from "@electric-sql/pglite";
async function main() {
  const db = new PGlite();
  const r = await db.query("select encode(sha256(convert_to('test','UTF8')),'hex') as h");
  console.log(r.rows);
  await db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
