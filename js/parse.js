/** Discord shoutout / map parsing for AA scavenger hunts */
(function (global) {
  const MAP_RX = [
    [/chernarus|cherno|chenarus/i, "Chernarus"],
    [/livonia/i, "Livonia"],
    [/sakhal|sahkal|sakal/i, "Sakhal"],
  ];

  function detectMaps(text) {
    const t = String(text || "");
    if (/all\s+three\s+maps|all\s+3\s+maps/i.test(t)) {
      return ["Chernarus", "Livonia", "Sakhal"];
    }
    const found = [];
    for (const [rx, label] of MAP_RX) {
      if (rx.test(t) && !found.includes(label)) found.push(label);
    }
    return found;
  }

  function extractNames(text) {
    const names = [];
    const mentionIds = [];
    const idRe = /<@!?(\d+)>/g;
    let m;
    while ((m = idRe.exec(text))) mentionIds.push(m[1]);
    // @Handle patterns (no spaces) after Congrats
    const atRe = /@([A-Za-z0-9._\-]{2,32})/g;
    while ((m = atRe.exec(text))) {
      if (!names.includes(m[1])) names.push(m[1]);
    }
    return { names, mentionIds };
  }

  function isShoutBlock(text) {
    const t = text.toLowerCase();
    if (/hunt is here|new hunt for you|item list/.test(t)) return false;
    return /congrats|congratulations|completed scavenger|complet\w*.{0,40}hunt/.test(t);
  }

  /**
   * Parse pasted Discord text into completion rows.
   * @returns {{ display_name: string, maps: string[], raw: string }[]}
   */
  function parseShoutouts(paste, fallbackMap = "Chernarus") {
    const blocks = String(paste || "")
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean);
    // Also try line-grouped: Congrats line + following map line
    const lines = String(paste || "").split(/\r?\n/);
    const rowMap = new Map();

    function add(name, maps, raw) {
      if (!name) return;
      const key = name.toLowerCase();
      const cur = rowMap.get(key) || { display_name: name, maps: [], raw: raw || "" };
      for (const mp of maps.length ? maps : [fallbackMap]) {
        if (!cur.maps.includes(mp)) cur.maps.push(mp);
      }
      rowMap.set(key, cur);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const windowText = [line, lines[i + 1] || "", lines[i + 2] || ""].join("\n");
      if (!isShoutBlock(windowText) && !isShoutBlock(line)) continue;
      const { names } = extractNames(windowText);
      let maps = detectMaps(windowText);
      if (!maps.length) maps = detectMaps(lines[i + 1] || "");
      for (const n of names) add(n, maps, windowText);
    }

    // Fallback: treat double-newline blocks
    if (!rowMap.size) {
      for (const b of blocks) {
        if (!isShoutBlock(b)) continue;
        const { names } = extractNames(b);
        const maps = detectMaps(b);
        for (const n of names) add(n, maps, b);
      }
    }

    return [...rowMap.values()];
  }

  function periodFromLabel(label) {
    const m = String(label || "").trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!m) return null;
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const idx = months.indexOf(m[1].slice(0, 3).toLowerCase());
    if (idx < 0) return null;
    return `${m[2]}-${String(idx + 1).padStart(2, "0")}`;
  }

  function labelFromPeriod(period) {
    const m = String(period || "").match(/^(\d{4})-(\d{2})$/);
    if (!m) return period;
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[Number(m[2]) - 1]} ${m[1]}`;
  }

  global.ScavParse = { detectMaps, extractNames, parseShoutouts, periodFromLabel, labelFromPeriod };
})(window);
