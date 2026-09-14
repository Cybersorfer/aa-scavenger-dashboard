/** AA Scavenger dashboard UI */
(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const state = {
    players: [],
    filtered: [],
    config: {},
    mapFilter: "All",
    periodFilter: "All",
    query: "",
    staff: false,
    pin: "",
    selected: null,
    note: "",
  };

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function mapCounts(player) {
    const c = { Chernarus: 0, Livonia: 0, Sakhal: 0, Unknown: 0 };
    for (const x of player.completions || []) c[x.map] = (c[x.map] || 0) + 1;
    return c;
  }

  function periods() {
    const set = new Set();
    for (const p of state.players) {
      for (const c of p.completions || []) set.add(c.period);
    }
    return [...set].sort().reverse();
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();
    state.filtered = state.players.filter((p) => {
      if (q && !p.display_name.toLowerCase().includes(q)) return false;
      const comps = p.completions || [];
      if (state.mapFilter !== "All") {
        if (!comps.some((c) => c.map === state.mapFilter)) return false;
      }
      if (state.periodFilter !== "All") {
        if (!comps.some((c) => c.period === state.periodFilter)) return false;
      }
      return true;
    });
    // recompute display count under filters
    state.filtered = state.filtered.map((p) => {
      let comps = p.completions || [];
      if (state.mapFilter !== "All") comps = comps.filter((c) => c.map === state.mapFilter);
      if (state.periodFilter !== "All") comps = comps.filter((c) => c.period === state.periodFilter);
      return { ...p, _viewCount: comps.length, _viewComps: comps };
    });
    state.filtered.sort((a, b) => b._viewCount - a._viewCount || a.display_name.localeCompare(b.display_name));
  }

  function renderStats() {
    const total = state.players.reduce((n, p) => n + (p.completion_count || 0), 0);
    $("#statPlayers").textContent = String(state.players.length);
    $("#statCompletions").textContent = String(total);
    const active = state.config.active_period_label || "—";
    $("#statMonth").textContent = active;
    const mode = ScavApi.getMode();
    const dot = $("#modeDot");
    const label = $("#modeLabel");
    dot.className = "status-dot " + (mode === "live" ? "live" : "seed");
    label.textContent = mode === "live" ? "Live Supabase" : "Seed / offline";
    if (state.note) label.textContent += " · " + state.note;
  }

  function renderPeriodSelect() {
    const sel = $("#periodFilter");
    const cur = state.periodFilter;
    sel.innerHTML = `<option value="All">All months</option>` +
      periods().map((p) => `<option value="${p}">${ScavParse.labelFromPeriod(p)}</option>`).join("");
    sel.value = cur;
    const staffPeriod = $("#staffPeriod");
    if (staffPeriod) {
      const opts = periods();
      const active = state.config.active_period || opts[0] || new Date().toISOString().slice(0, 7);
      staffPeriod.innerHTML = opts.map((p) =>
        `<option value="${p}">${ScavParse.labelFromPeriod(p)}</option>`
      ).join("") || `<option value="${active}">${ScavParse.labelFromPeriod(active)}</option>`;
      if (![...staffPeriod.options].some((o) => o.value === active)) {
        staffPeriod.insertAdjacentHTML("afterbegin", `<option value="${active}">${ScavParse.labelFromPeriod(active)}</option>`);
      }
      staffPeriod.value = active;
    }
  }

  function renderBoard() {
    applyFilters();
    const max = Math.max(1, ...state.filtered.map((p) => p._viewCount));
    const board = $("#board");
    board.innerHTML = state.filtered.map((p, i) => {
      const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
      const mc = mapCounts({ completions: p._viewComps });
      const pills = ["Chernarus", "Livonia", "Sakhal", "Unknown"]
        .filter((m) => mc[m])
        .map((m) => `<span class="pill ${m}">${m.slice(0, 1)} ${mc[m]}</span>`)
        .join("");
      const delay = Math.min(i, 24) * 18;
      return `<article class="row" data-id="${p.player_id}" style="animation-delay:${delay}ms">
        <div class="rank ${rankClass}">${i + 1}</div>
        <div class="who">
          <div class="name">${escapeHtml(p.display_name)}</div>
          <div class="bar"><i style="width:${(p._viewCount / max) * 100}%"></i></div>
        </div>
        <div style="display:grid;gap:8px;justify-items:end">
          <div class="count-badge">${p._viewCount}</div>
          <div class="maps">${pills}</div>
        </div>
      </article>`;
    }).join("") || `<p class="hint">No hunters match these filters.</p>`;

    // animate bars after paint
    requestAnimationFrame(() => {
      $$(".bar > i", board).forEach((el) => {
        const w = el.style.width;
        el.style.width = "0";
        requestAnimationFrame(() => { el.style.width = w; });
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openDossier(player) {
    state.selected = player;
    const d = $("#drawer");
    const b = $("#drawerBackdrop");
    $("#drawerTitle").textContent = player.display_name;
    const mc = mapCounts(player);
    $("#drawerSub").textContent = `${player.completion_count} completions · C ${mc.Chernarus} · L ${mc.Livonia} · S ${mc.Sakhal}`;
    const tl = $("#drawerTimeline");
    const comps = [...(player.completions || [])].sort((a, b) =>
      a.period === b.period ? a.map.localeCompare(b.map) : b.period.localeCompare(a.period)
    );
    tl.innerHTML = comps.map((c) => `
      <div class="tl-item">
        <div class="when">${escapeHtml(c.period_label || c.period)}</div>
        <div>
          <span class="pill ${c.map}">${escapeHtml(c.map)}</span>
          <div class="hint" style="margin-top:6px">${escapeHtml(c.source || "")}</div>
          ${state.staff && c.id && !String(c.id).startsWith("seed-")
            ? `<button class="btn danger" data-rm="${c.id}" style="margin-top:8px">Remove</button>`
            : ""}
        </div>
      </div>`).join("") || `<p class="hint">No completions.</p>`;
    d.classList.add("open");
    b.classList.add("open");
  }

  function closeDossier() {
    $("#drawer").classList.remove("open");
    $("#drawerBackdrop").classList.remove("open");
    state.selected = null;
  }

  function setStaff(on) {
    state.staff = on;
    $("#staffPanel").classList.toggle("hidden", !on);
    $("#staffLocked").classList.toggle("hidden", on);
    $("#btnStaff").textContent = on ? "Staff unlocked" : "Staff PIN";
  }

  async function refresh() {
    const data = await ScavApi.loadBoard();
    state.players = data.players || [];
    state.config = data.config || {};
    state.note = data.note || "";
    renderStats();
    renderPeriodSelect();
    renderBoard();
  }

  function bind() {
    $("#search").addEventListener("input", (e) => {
      state.query = e.target.value;
      renderBoard();
    });
    $("#periodFilter").addEventListener("change", (e) => {
      state.periodFilter = e.target.value;
      renderBoard();
    });
    $$(".chip[data-map]").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$(".chip[data-map]").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.mapFilter = chip.dataset.map;
        renderBoard();
      });
    });
    $("#board").addEventListener("click", (e) => {
      const row = e.target.closest(".row");
      if (!row) return;
      const p = state.players.find((x) => String(x.player_id) === row.dataset.id);
      if (p) openDossier(p);
    });
    $("#drawerClose").addEventListener("click", closeDossier);
    $("#drawerBackdrop").addEventListener("click", closeDossier);
    $("#drawerTimeline").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-rm]");
      if (!btn || !state.staff) return;
      try {
        await ScavApi.removeCompletion(state.pin, btn.dataset.rm);
        toast("Removed");
        await refresh();
        const p = state.players.find((x) => x.display_name === state.selected?.display_name);
        if (p) openDossier(p);
        else closeDossier();
      } catch (err) {
        toast(err.message || String(err));
      }
    });

    $("#btnStaff").addEventListener("click", async () => {
      if (state.staff) {
        setStaff(false);
        state.pin = "";
        return;
      }
      const pin = prompt("Staff PIN");
      if (!pin) return;
      try {
        const ok = await ScavApi.verifyPin(pin);
        if (!ok) {
          toast("Wrong PIN");
          return;
        }
        state.pin = pin;
        setStaff(true);
        toast("Staff mode on");
      } catch (err) {
        toast(err.message || String(err));
      }
    });

    $("#btnAdd").addEventListener("click", async () => {
      const name = $("#staffName").value.trim();
      const period = $("#staffPeriod").value;
      const map = $("#staffMap").value;
      if (!name) return toast("Player name required");
      try {
        await ScavApi.addCompletion(state.pin, {
          display_name: name,
          period,
          period_label: ScavParse.labelFromPeriod(period),
          map,
          source: "manual",
        });
        toast(`Added ${name} · ${map}`);
        $("#staffName").value = "";
        await refresh();
      } catch (err) {
        toast(err.message || String(err));
      }
    });

    $("#btnParse").addEventListener("click", () => {
      const paste = $("#importPaste").value;
      const period = $("#staffPeriod").value;
      const rows = ScavParse.parseShoutouts(paste, $("#staffMap").value);
      const preview = rows.flatMap((r) =>
        r.maps.map((m) => `${r.display_name} · ${ScavParse.labelFromPeriod(period)} · ${m}`)
      );
      $("#importPreview").textContent = preview.join("\n") || "No shoutouts detected.";
      $("#importPreview").dataset.rows = JSON.stringify(
        rows.flatMap((r) =>
          r.maps.map((m) => ({
            display_name: r.display_name,
            period,
            period_label: ScavParse.labelFromPeriod(period),
            map: m,
            source: "discord_import",
          }))
        )
      );
    });

    $("#btnImport").addEventListener("click", async () => {
      let rows = [];
      try {
        rows = JSON.parse($("#importPreview").dataset.rows || "[]");
      } catch {
        rows = [];
      }
      if (!rows.length) return toast("Parse first");
      let n = 0;
      for (const row of rows) {
        try {
          await ScavApi.addCompletion(state.pin, row);
          n++;
        } catch (err) {
          console.warn(err);
        }
      }
      toast(`Imported ${n}/${rows.length}`);
      await refresh();
    });
  }

  async function boot() {
    const title = (window.SCAV_CONFIG && window.SCAV_CONFIG.title) || "AA Scavenger Hunt";
    document.title = title;
    $("#heroTitle").textContent = title;
    $("#heroSub").textContent = (window.SCAV_CONFIG && window.SCAV_CONFIG.subtitle) || "";
    bind();
    try {
      await refresh();
    } catch (err) {
      toast(err.message || String(err));
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
