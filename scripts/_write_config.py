# -*- coding: utf-8 -*-
from pathlib import Path

env = Path(r"C:\Users\cyber\Projects\fleetmind\.env.local").read_text(encoding="utf-8")
vals = {}
for line in env.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        vals[k.strip()] = v.strip().strip('"').strip("'")

url = vals.get("EXPO_PUBLIC_SUPABASE_URL") or vals.get("SUPABASE_URL") or ""
anon = vals.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") or vals.get("SUPABASE_ANON_KEY") or ""
for k, v in vals.items():
    if k.endswith("SUPABASE_URL") and not url:
        url = v
    if "ANON" in k and "KEY" in k and not anon:
        anon = v

out = Path(r"C:\Users\cyber\ai-tools-tracker\aa-scavenger-dashboard\config.js")
out.write_text(
    "window.SCAV_CONFIG = {\n"
    f"  supabaseUrl: {url!r},\n"
    f"  supabaseAnonKey: {anon!r},\n"
    "  useSeedFallback: true,\n"
    '  title: "AA Scavenger Hunt",\n'
    '  subtitle: "Apocalyptic Adventures · control board",\n'
    "};\n",
    encoding="utf-8",
)
print("ok", bool(url), bool(anon))
