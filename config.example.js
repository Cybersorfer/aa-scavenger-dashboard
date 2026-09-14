# Copy to config.js and fill from FleetMind Supabase (anon key is public by design).
# Do NOT put the service_role key here.
window.SCAV_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY",
  // Optional: load seed.json when Supabase empty / offline
  useSeedFallback: true,
  title: "AA Scavenger Hunt",
  subtitle: "Apocalyptic Adventures · control board",
};
