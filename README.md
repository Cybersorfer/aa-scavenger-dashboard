# AA Scavenger Hunt Control Dashboard

Interactive leaderboard + staff control board for **Apocalyptic Adventures** scavenger hunts.

- Public leaderboard (filter by month / map, player dossiers)
- Staff PIN to add/remove completions
- Discord shoutout paste → multi-map import (Chernarus / Livonia / Sakhal)
- Data on existing **FleetMind Supabase** (`scav_*` tables only)
- Seeded from Discord scan (358 map-completions)

## Live site

After GitHub Pages is enabled: `https://cybersorfer.github.io/aa-scavenger-dashboard/`

## Local preview

```powershell
cd C:\Users\cyber\ai-tools-tracker\aa-scavenger-dashboard
npx --yes serve -l 8801
```

Open http://127.0.0.1:8801/

## Setup (one time)

### 1. Apply SQL to FleetMind Supabase

FleetMind project must be **running** (DNS for `*.supabase.co` resolves). If the project was paused/deleted, restore it in the Supabase dashboard (or approve a new project + update `config.js` / `.env.local`) before this works.

```powershell
cd C:\Users\cyber\ai-tools-tracker\aa-scavenger-dashboard
npm install
node scripts\apply-scav-sql.js
```

Or paste `docs/supabase-scav.sql` into the Supabase SQL editor.

Until SQL is applied, the site runs in **seed mode** from `data/seed.json` (69 hunters / 195 map-completions from Discord shoutouts that name a map; Falkor XP ignored).

### 2. Set your staff PIN

Default PIN after SQL apply: `change-me-scav`  

Change it from Supabase SQL:

```sql
select scav_set_pin('change-me-scav', 'your-real-pin');
```

### 3. Seed historical Discord data

```powershell
python scripts\seed-scav.py
```

### 4. Config

`config.js` is generated from FleetMind anon URL/key (safe to expose).  
Template: `config.example.js`.

## Staff use

1. Open the site → **Staff PIN**
2. Quick-add a hunter + month + map, or paste Discord shoutouts → **Parse** → **Import all**

## Repo layout

| Path | Role |
|------|------|
| `index.html` / `css/` / `js/` | GitHub Pages UI |
| `data/seed.json` | Offline/seed leaderboard |
| `docs/supabase-scav.sql` | Tables + RLS + RPCs |
| `docs/superpowers/specs/` | Design spec |

## Safety

- Does **not** modify FleetMind taxi tables
- Anon key is public; writes require PIN via security-definer RPCs
- Never commit `service_role` or DB password
