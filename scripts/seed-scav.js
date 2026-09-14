/**
 * Seed scav_* from data/seed.json via FleetMind DB password.
 */
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
  let nPlayers = 0;
  let nComps = 0;
  for (const p of data.players || []) {
    const name = p.display_name;
    let row = await c.query(
      "select id from public.scav_players where lower(display_name)=lower($1)",
      [name]
    );
    let playerId;
    if (!row.rows.length) {
      row = await c.query(
        "insert into public.scav_players (display_name) values ($1) returning id",
        [name]
      );
      nPlayers += 1;
      playerId = row.rows[0].id;
    } else {
      playerId = row.rows[0].id;
    }
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
  const board = await c.query(
    `select count(*)::int as players from public.scav_players`
  );
  const comps = await c.query(
    `select count(*)::int as completions from public.scav_completions`
  );
  console.log(
    `seeded new_players=${nPlayers} new_completions=${nComps} totals players=${board.rows[0].players} completions=${comps.rows[0].completions}`
  );
  await c.end();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
