/** Wipe scav_completions then re-seed from data/seed.json */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const envPath = path.join("C:/Users/cyber/Projects/fleetmind/.env.local");
const seedPath = path.join(__dirname, "..", "data", "seed.json");

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
const connectionString = `postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres`;
const data = JSON.parse(fs.readFileSync(seedPath, "utf8"));

(async () => {
  const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("truncate public.scav_completions restart identity");
  await c.query("delete from public.scav_players");
  let nPlayers = 0;
  let nComps = 0;
  for (const p of data.players || []) {
    const name = p.display_name;
    const row = await c.query(
      "insert into public.scav_players (display_name) values ($1) returning id",
      [name]
    );
    nPlayers += 1;
    const playerId = row.rows[0].id;
    for (const comp of p.completions || []) {
      const ins = await c.query(
        `insert into public.scav_completions
           (player_id, period, period_label, map, source)
         values ($1,$2,$3,$4,'scan_seed')
         on conflict (player_id, period, map) do nothing
         returning id`,
        [playerId, comp.period, comp.period_label, comp.map]
      );
      if (ins.rows.length) nComps += 1;
    }
  }
  const totals = await c.query(
    `select
       (select count(*)::int from public.scav_players) as players,
       (select count(*)::int from public.scav_completions) as completions`
  );
  console.log(
    `reset ok players=${nPlayers} completions=${nComps} db=${JSON.stringify(totals.rows[0])}`
  );
  await c.end();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
