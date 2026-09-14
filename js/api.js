/** Supabase + seed data layer */
(function (global) {
  const cfg = () => global.SCAV_CONFIG || {};
  let client = null;
  let mode = "seed"; // seed | live

  function getClient() {
    if (client) return client;
    const { supabaseUrl, supabaseAnonKey } = cfg();
    if (!supabaseUrl || !supabaseAnonKey || !global.supabase) return null;
    if (supabaseUrl.includes("YOUR_PROJECT")) return null;
    client = global.supabase.createClient(supabaseUrl, supabaseAnonKey);
    return client;
  }

  async function loadSeed() {
    const res = await fetch("./data/seed.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load seed.json");
    const data = await res.json();
    const players = (data.players || []).map((p, i) => ({
      player_id: `seed-${i}`,
      display_name: p.display_name,
      discord_id: null,
      completion_count: (p.completions || []).length,
      completions: (p.completions || []).map((c, j) => ({
        id: `seed-${i}-${j}`,
        period: c.period,
        period_label: c.period_label,
        map: c.map,
        source: "scan_seed",
        completed_at: null,
      })),
    }));
    players.sort((a, b) => b.completion_count - a.completion_count || a.display_name.localeCompare(b.display_name));
    mode = "seed";
    return {
      players,
      config: {
        active_period: new Date().toISOString().slice(0, 7),
        active_period_label: global.ScavParse.labelFromPeriod(new Date().toISOString().slice(0, 7)),
        active_maps: ["Chernarus"],
      },
    };
  }

  async function loadLive() {
    const sb = getClient();
    if (!sb) throw new Error("Supabase not configured");
    const [board, conf] = await Promise.all([
      sb.rpc("scav_leaderboard"),
      sb.rpc("scav_public_config"),
    ]);
    if (board.error) throw board.error;
    if (conf.error) throw conf.error;
    const players = (board.data || []).map((p) => ({
      ...p,
      completions: p.completions || [],
      completion_count: p.completion_count || (p.completions || []).length,
    }));
    mode = "live";
    return { players, config: conf.data || {} };
  }

  async function loadBoard() {
    try {
      const live = await loadLive();
      if ((live.players || []).length === 0 && cfg().useSeedFallback) {
        const seed = await loadSeed();
        mode = "seed";
        return { ...seed, note: "Supabase empty — showing seed until you import." };
      }
      return live;
    } catch (err) {
      if (cfg().useSeedFallback) {
        const seed = await loadSeed();
        return { ...seed, note: `Offline/seed mode: ${err.message || err}` };
      }
      throw err;
    }
  }

  async function verifyPin(pin) {
    const sb = getClient();
    if (!sb) return mode === "seed" && pin.length >= 4; // local demo unlock
    const { data, error } = await sb.rpc("scav_verify_pin", { p_pin: pin });
    if (error) throw error;
    return !!data;
  }

  async function addCompletion(pin, row) {
    const sb = getClient();
    if (!sb) {
      // seed-mode ephemeral (session only)
      return { ok: true, ephemeral: true, ...row };
    }
    const { data, error } = await sb.rpc("scav_add_completion", {
      p_pin: pin,
      p_display_name: row.display_name,
      p_period: row.period,
      p_period_label: row.period_label,
      p_map: row.map,
      p_source: row.source || "manual",
      p_discord_id: row.discord_id || null,
      p_note: row.note || null,
    });
    if (error) throw error;
    return data;
  }

  async function removeCompletion(pin, completionId) {
    const sb = getClient();
    if (!sb) return { ok: true, ephemeral: true };
    const { data, error } = await sb.rpc("scav_remove_completion", {
      p_pin: pin,
      p_completion_id: completionId,
    });
    if (error) throw error;
    return data;
  }

  global.ScavApi = {
    loadBoard,
    verifyPin,
    addCompletion,
    removeCompletion,
    getMode: () => mode,
    getClient,
  };
})(window);
