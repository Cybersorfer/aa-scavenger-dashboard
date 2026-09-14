-- AA Scavenger Hunt tables on FleetMind Supabase
-- Safe: only creates scav_* objects. Does not alter taxi tables.
-- Run in Supabase SQL editor OR via scripts/apply-scav-sql.js

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.scav_players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  discord_id text unique,
  created_at timestamptz not null default now()
);

create unique index if not exists scav_players_display_name_lower_idx
  on public.scav_players (lower(display_name));

create table if not exists public.scav_completions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.scav_players (id) on delete cascade,
  period text not null,
  period_label text not null,
  map text not null check (map in ('Chernarus', 'Livonia', 'Sakhal', 'Unknown')),
  source text not null default 'manual',
  note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, period, map)
);

create index if not exists scav_completions_period_idx on public.scav_completions (period);
create index if not exists scav_completions_map_idx on public.scav_completions (map);

create table if not exists public.scav_config (
  id int primary key default 1 check (id = 1),
  pin_hash text not null,
  active_period text,
  active_period_label text,
  active_maps text[] not null default array['Chernarus']::text[],
  updated_at timestamptz not null default now()
);

-- Default PIN: change immediately via scav_set_pin after deploy
insert into public.scav_config (id, pin_hash, active_period, active_period_label, active_maps)
values (
  1,
  extensions.crypt('change-me-scav', extensions.gen_salt('bf')),
  to_char(now(), 'YYYY-MM'),
  to_char(now(), 'Mon YYYY'),
  array['Chernarus']::text[]
)
on conflict (id) do nothing;

alter table public.scav_players enable row level security;
alter table public.scav_completions enable row level security;
alter table public.scav_config enable row level security;

drop policy if exists scav_players_select_public on public.scav_players;
create policy scav_players_select_public
  on public.scav_players for select
  to anon, authenticated
  using (true);

drop policy if exists scav_completions_select_public on public.scav_completions;
create policy scav_completions_select_public
  on public.scav_completions for select
  to anon, authenticated
  using (true);

-- Config: allow reading non-secret fields only via RPC; block direct select of pin_hash
drop policy if exists scav_config_deny_all on public.scav_config;
create policy scav_config_deny_all
  on public.scav_config for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.scav_public_config()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'active_period', active_period,
    'active_period_label', active_period_label,
    'active_maps', active_maps
  )
  from public.scav_config
  where id = 1;
$$;

create or replace function public.scav_verify_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.scav_config
    where id = 1 and pin_hash = crypt(p_pin, pin_hash)
  );
$$;

create or replace function public.scav_set_pin(p_old_pin text, p_new_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.scav_verify_pin(p_old_pin) then
    raise exception 'Invalid PIN';
  end if;
  if length(coalesce(p_new_pin, '')) < 4 then
    raise exception 'PIN must be at least 4 characters';
  end if;
  update public.scav_config
  set pin_hash = crypt(p_new_pin, gen_salt('bf')), updated_at = now()
  where id = 1;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.scav_add_completion(
  p_pin text,
  p_display_name text,
  p_period text,
  p_period_label text,
  p_map text,
  p_source text default 'manual',
  p_discord_id text default null,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_row public.scav_completions%rowtype;
  v_map text;
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
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Player name required';
  end if;

  select id into v_player_id
  from public.scav_players
  where lower(display_name) = lower(trim(p_display_name))
     or (p_discord_id is not null and discord_id = p_discord_id)
  limit 1;

  if v_player_id is null then
    insert into public.scav_players (display_name, discord_id)
    values (trim(p_display_name), nullif(p_discord_id, ''))
    returning id into v_player_id;
  elsif p_discord_id is not null then
    update public.scav_players
    set discord_id = coalesce(discord_id, p_discord_id)
    where id = v_player_id;
  end if;

  insert into public.scav_completions (
    player_id, period, period_label, map, source, note, completed_at
  ) values (
    v_player_id, p_period, p_period_label, v_map, coalesce(nullif(p_source, ''), 'manual'),
    p_note, now()
  )
  on conflict (player_id, period, map) do update
    set source = excluded.source,
        note = coalesce(excluded.note, public.scav_completions.note)
  returning * into v_row;

  return json_build_object(
    'ok', true,
    'completion_id', v_row.id,
    'player_id', v_player_id,
    'period', v_row.period,
    'map', v_row.map
  );
end;
$$;

create or replace function public.scav_remove_completion(
  p_pin text,
  p_completion_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.scav_verify_pin(p_pin) then
    raise exception 'Invalid PIN';
  end if;
  delete from public.scav_completions where id = p_completion_id;
  return json_build_object('ok', true);
end;
$$;

-- Staff: set / correct map on an existing completion (esp. Unknown → named map)
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

  select id into v_existing
  from public.scav_completions
  where player_id = v_row.player_id
    and period = v_row.period
    and map = v_map
    and id <> p_completion_id
  limit 1;

  if v_existing is not null then
    -- already have that map for the month — drop the Unknown/old row
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
        when source in ('scan_seed', 'discord_import', 'xp_only') then source || '+map_fix'
        else coalesce(nullif(source, ''), 'manual')
      end,
      note = coalesce(note, '') || case when map = 'Unknown' then ' [map set by staff]' else '' end
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

create or replace function public.scav_leaderboard()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(json_agg(row_to_json(t) order by t.completion_count desc, t.display_name), '[]'::json)
  from (
    select
      p.id as player_id,
      p.display_name,
      p.discord_id,
      count(c.*)::int as completion_count,
      json_agg(
        json_build_object(
          'id', c.id,
          'period', c.period,
          'period_label', c.period_label,
          'map', c.map,
          'source', c.source,
          'completed_at', c.completed_at
        )
        order by c.period, c.map
      ) filter (where c.id is not null) as completions
    from public.scav_players p
    left join public.scav_completions c on c.player_id = p.id
    group by p.id, p.display_name, p.discord_id
  ) t;
$$;

grant execute on function public.scav_public_config() to anon, authenticated;
grant execute on function public.scav_verify_pin(text) to anon, authenticated;
grant execute on function public.scav_set_pin(text, text) to anon, authenticated;
grant execute on function public.scav_add_completion(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.scav_remove_completion(text, uuid) to anon, authenticated;
grant execute on function public.scav_set_completion_map(text, uuid, text) to anon, authenticated;
grant execute on function public.scav_leaderboard() to anon, authenticated;
