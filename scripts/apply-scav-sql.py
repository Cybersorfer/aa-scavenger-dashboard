# -*- coding: utf-8 -*-
"""Apply docs/supabase-scav.sql to FleetMind Supabase."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / "docs" / "supabase-scav.sql"
ENV = Path(r"C:\Users\cyber\Projects\fleetmind\.env.local")


def main() -> None:
    import psycopg

    vals = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    ref = vals.get("SUPABASE_PROJECT_REF")
    password = vals.get("SUPABASE_DB_PASSWORD")
    if not ref or not password:
        raise SystemExit("Need SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD in fleetmind .env.local")
    conninfo = (
        f"postgresql://postgres.{ref}:{quote_plus(password)}"
        f"@aws-0-ca-central-1.pooler.supabase.com:6543/postgres"
    )
    sql = SQL.read_text(encoding="utf-8")
    with psycopg.connect(conninfo) as conn:
        conn.execute(sql)
        conn.commit()
    print("Applied supabase-scav.sql OK")


if __name__ == "__main__":
    main()
