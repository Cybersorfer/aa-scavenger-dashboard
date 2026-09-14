# AA Scavenger Dashboard — Implementation Plan

> **For agentic workers:** implement task-by-task; mark checkboxes done.

**Goal:** Ship GitHub Pages dashboard + Supabase `scav_*` tables on FleetMind project.

**Tech:** Static HTML/CSS/JS, Supabase JS CDN, security-definer RPCs for staff PIN.

---

### Task 1: Supabase schema + RPCs
- Create `docs/supabase-scav.sql` (players, completions, config, RLS, `scav_add_completion` / `scav_remove_completion` / `scav_set_pin`)
- Apply to FleetMind Supabase via existing DB connection pattern

### Task 2: Seed data
- Build `data/seed.json` from multi-map Discord scan
- Script to upsert seed via service role or SQL

### Task 3: Frontend dashboard
- `index.html` + `css/app.css` + `js/*` (api, parse, ui)
- Public leaderboard, filters, dossier, staff PIN panel, Discord paste import
- `config.example.js` → `config.js` (url + anon key; gitignore real secrets if needed — anon key is public)

### Task 4: GitHub repo + Pages
- `gh repo create Cybersorfer/aa-scavenger-dashboard --public`
- Push + enable Pages from main `/` or `/docs`
- Update PROJECT_INDEX

### Task 5: README
- How to set PIN, apply SQL, import Discord, open Pages URL
