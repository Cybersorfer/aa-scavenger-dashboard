/**
 * Apply only the scav_set_completion_map RPC (and grants) to live Supabase.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const envPath = path.join("C:/Users/cyber/Projects/fleetmind/.env.local");
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

const sql = `
create or replace function public.scav_set_completion_map(
  p_pin text,
  p_completion_id uuid,
  p_map text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.scav_completions%rowtype;
  v_map text;
  v_existing uuid;
  v_old_map text;
begin
  if not public.scav_verify_pin(p_pin) then
    raise exception 'Invalid PIN';
  end if;
  v_map := case
    when lower(p_map) in ('chernarus', 'cherno', 'chenarus') then 'Chernarus'
    when lower(p_map) = 'livonia' then 'Livonia'
    when lower(p_map) in ('sakhal', 'sahkal', 'sakal') then 'Sakhal'
    else 'Unknown'
  end;
  if v_map = 'Unknown' then
    raise exception 'Pick Chernarus, Livonia, or Sakhal';
  end if;

  select * into v_row from public.scav_completions where id = p_completion_id;
  if not found then
    raise exception 'Completion not found';
  end if;
  v_old_map := v_row.map;

  select id into v_existing
  from public.scav_completions
  where player_id = v_row.player_id
    and period = v_row.period
    and map = v_map
    and id <> p_completion_id
  limit 1;

  if v_existing is not null then
    delete from public.scav_completions where id = p_completion_id;
    return json_build_object(
      'ok', true,
      'merged', true,
      'completion_id', v_existing,
      'map', v_map
    );
  end if;

  update public.scav_completions
  set map = v_map,
      source = case
        when source like '%map_fix' then source
        else coalesce(nullif(source, ''), 'manual') || '+map_fix'
      end,
      note = case
        when v_old_map = 'Unknown' then coalesce(note || ' ', '') || '[map set by staff]'
        else note
      end
  where id = p_completion_id
  returning * into v_row;

  return json_build_object(
    'ok', true,
    'merged', false,
    'completion_id', v_row.id,
    'map', v_row.map,
    'period', v_row.period
  );
end;
$$;

grant execute on function public.scav_set_completion_map(text, uuid, text) to anon, authenticated;
`;

(async () => {
  const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(sql);
  const r = await c.query(
    `select proname from pg_proc where proname = 'scav_set_completion_map'`
  );
  console.log("OK", r.rows.map((x) => x.proname).join(","));
  await c.end();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
