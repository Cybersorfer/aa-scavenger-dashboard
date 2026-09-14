/**
 * Apply supabase-scav.sql using FleetMind DB credentials (tries several hosts).
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const envPath = path.join("C:/Users/cyber/Projects/fleetmind/.env.local");
const sqlPath = path.join(__dirname, "..", "docs", "supabase-scav.sql");

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const pass = encodeURIComponent(env.SUPABASE_DB_PASSWORD);
const ref = env.SUPABASE_PROJECT_REF;
const sql = fs.readFileSync(sqlPath, "utf8");

const candidates = [
  `postgresql://postgres.${ref}:${pass}@aws-0-ca-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${ref}:${pass}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${ref}:${pass}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres`,
];

(async () => {
  let lastErr;
  for (const connectionString of candidates) {
    const host = connectionString.split("@")[1]?.split("/")[0];
    try {
      const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
      await c.connect();
      await c.query(sql);
      const tables = await c.query(
        `select table_name from information_schema.tables where table_schema='public' and table_name like 'scav_%' order by 1`
      );
      console.log("OK via", host);
      console.log(
        "tables",
        tables.rows.map((r) => r.table_name).join(",")
      );
      await c.end();
      return;
    } catch (e) {
      lastErr = e;
      console.warn("fail", host, e.message || e);
    }
  }
  console.error(lastErr?.message || lastErr);
  process.exit(1);
})();
