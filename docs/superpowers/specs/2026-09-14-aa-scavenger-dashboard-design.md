# AA Scavenger Hunt Control Dashboard — Design

**Date:** 2026-09-14  
**Status:** Approved direction (awaiting spec sign-off)  
**Owner:** Cybersorfer  
**Repo (planned):** `Cybersorfer/aa-scavenger-dashboard`  
**Local path:** `C:\Users\cyber\ai-tools-tracker\aa-scavenger-dashboard`

---

## 1. Goal

A public, interactive web dashboard for **Apocalyptic Adventures** scavenger hunts so staff can:

- See **who** finished, **which month/year**, and **which map** (Chernarus / Livonia / Sakhal)
- Keep accurate **counts** (multi-map months = multiple credits)
- **Add/remove** completions with a staff PIN
- **Import** Discord shoutouts (and later re-run scanner exports)
- Seed from the existing Discord scan

Not a replacement for Discord shoutouts — a control board + leaderboard on top of them.

---

## 2. Decisions (locked)

| Topic | Choice |
|--------|--------|
| Logging | **Both:** manual staff entry + Discord import |
| Access | **Public view** + **staff PIN** for writes |
| Backend | **Reuse FleetMind Supabase** (same project, new tables) — no new Cloudflare account |
| Hosting | **GitHub Pages** (static frontend) talking to Supabase |
| Maps | Chernarus, Livonia, Sakhal (+ `Unknown` for legacy rows) |
| Counting | One credit = one `(player, period, map)` |

---

## 3. User experience

### 3.1 Public (no PIN)

- Dark “Chernarus night” aesthetic (charcoal / bone / map accents — not purple SaaS)
- Hero stats: total completions, unique hunters, active month
- Sortable/filterable leaderboard (search, month, map chips)
- Animated rank bars + map chips
- Click player → dossier: timeline, per-map breakdown, count
- Current-month board: who’s done / which maps (when multi-map era)

### 3.2 Staff (PIN unlocks panel)

- Quick-add: player typeahead, period (month/year), map → save
- Remove / undo completion
- Discord import: paste shoutout text → parse preview → confirm
- Export JSON backup
- PIN stored as hash comparison via Supabase Edge Function or RPC (never hardcode PIN in frontend repo)

### 3.3 Motion / “cool”

- Rank transitions, chip pop, dossier slide-over
- Keep motion purposeful (2–3 signature animations), not spam

---

## 4. Architecture

```
Browser (GitHub Pages)
  ├─ Public reads → Supabase anon key (RLS: select allowed on scav_* tables)
  └─ Staff writes → staff PIN → Edge Function / RPC verifies PIN → insert/delete

Supabase (fleetmind project)
  ├─ taxi / FleetMind tables (unchanged)
  └─ scav_* tables (new, isolated)
```

### 4.1 Why shared Supabase is OK

- Separate table prefix `scav_`
- Separate RLS policies
- Tiny write volume vs taxi GPS
- Same free project — no second vendor account

### 4.2 Security notes

- Anon key is public (normal for Supabase web apps)
- RLS: anyone can **SELECT** leaderboard data; **INSERT/UPDATE/DELETE** only via staff-authenticated path
- Staff PIN: verified server-side (Edge Function with secret PIN hash in Supabase secrets) — not `if (pin === '1234')` in client JS
- Never commit service role key or PIN to GitHub

---

## 5. Data model

### `scav_players`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| display_name | text | Discord nick / handle |
| discord_id | text null unique | when known |
| created_at | timestamptz | |

### `scav_completions`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| player_id | uuid FK → scav_players | |
| period | text | e.g. `2026-08` (sortable) |
| period_label | text | e.g. `Aug 2026` |
| map | text | `Chernarus` \| `Livonia` \| `Sakhal` \| `Unknown` |
| source | text | `manual` \| `discord_import` \| `scan_seed` |
| note | text null | optional |
| completed_at | timestamptz | shout/XP time if known |
| created_at | timestamptz | |

**Unique constraint:** `(player_id, period, map)` — prevents double-counting same map/month.

### Optional `scav_staff_meta`

- Single-row config (active month, maps enabled this month) for “current hunt” UI

---

## 6. Discord import

### Input

Paste one or more shoutouts, e.g.:

```text
Congratulations @Player
Chernarus

# Congratulations @Other Completed Scavenger Hunt On Sakhal!
```

### Parser

- Detect `@mentions` / Discord mention IDs if pasted as `<@id>`
- Detect maps: Chernarus/Cherno/Chenarus, Livonia, Sakhal/Sahkal/Sakal
- Detect `all three maps` → three credits
- Period from: explicit month in text, staff-selected month, or active month setting

### Flow

1. Staff unlocks PIN  
2. Paste → **preview table** (player, period, map)  
3. Confirm → upsert completions  

Also support uploading JSON from the local scan scripts (`_aa_scav_maps_report` style) as seed/backfill.

---

## 7. Seed

- Convert current Discord multi-map scan into SQL/JSON seed
- Import once into `scav_*` tables
- Mark `source = scan_seed`

---

## 8. Repo layout (planned)

```
aa-scavenger-dashboard/
  docs/superpowers/specs/   ← this file
  docs/supabase-scav.sql    ← tables + RLS
  public/ or index.html     ← GitHub Pages UI
  src/                      ← JS modules (api, parse, ui)
  scripts/seed-from-scan.py ← optional seed helper
  README.md
```

---

## 9. Out of scope (v1)

- Live Discord bot webhook auto-posting into Supabase
- Auto Falkor XP polling
- Native mobile app
- Changing FleetMind taxi schema

---

## 10. Success criteria

- [ ] Public leaderboard loads from Supabase
- [ ] Staff PIN required to add/remove
- [ ] Multi-map month shows 2–3 credits correctly
- [ ] Discord paste import works for Chernarus/Livonia/Sakhal patterns
- [ ] Seeded historical data visible
- [ ] Repo on GitHub + Pages URL
- [ ] Taxi tables untouched

---

## 11. Open small defaults (unless you object)

- **Active hunt maps (UI default):** Chernarus only (staff can still log Livonia/Sakhal for history)
- **Repo visibility:** Public (leaderboard is public anyway)
- **PIN:** You set once in Supabase secrets during deploy
