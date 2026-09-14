# -*- coding: utf-8 -*-
"""Seed scav_* tables from data/seed.json."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "data" / "seed.json"
ENV = Path(r"C:\Users\cyber\Projects\fleetmind\.env.local")


def main() -> None:
    import psycopg

    vals = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    ref = vals["SUPABASE_PROJECT_REF"]
    password = vals["SUPABASE_DB_PASSWORD"]
    data = json.loads(SEED.read_text(encoding="utf-8"))
    conninfo = (
        f"postgresql://postgres.{ref}:{quote_plus(password)}"
        f"@aws-0-ca-central-1.pooler.supabase.com:6543/postgres"
    )
    n_players = 0
    n_comps = 0
    with psycopg.connect(conninfo) as conn:
        for p in data.get("players") or []:
            name = p["display_name"]
            row = conn.execute(
                "select id from public.scav_players where lower(display_name)=lower(%s)",
                (name,),
            ).fetchone()
            if not row:
                row = conn.execute(
                    "insert into public.scav_players (display_name) values (%s) returning id",
                    (name,),
                ).fetchone()
                n_players += 1
            player_id = row[0]
            for c in p.get("completions") or []:
                cur = conn.execute(
                    """
                    insert into public.scav_completions
                      (player_id, period, period_label, map, source)
                    values (%s,%s,%s,%s,'scan_seed')
                    on conflict (player_id, period, map) do nothing
                    returning id
                    """,
                    (player_id, c["period"], c["period_label"], c["map"]),
                )
                if cur.fetchone():
                    n_comps += 1
        conn.commit()
    print(f"New players={n_players} new completions={n_comps}")


if __name__ == "__main__":
    main()
