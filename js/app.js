/* ─────────────────────────────────────────────────
   Human Work Possibility Tree — Application Logic
   ───────────────────────────────────────────────── */

// ── STATE ────────────────────────────────────────
const state = {
  selections: {}, // { dimensionId: [optionValue, ...] }
  listView: false,
  activeArchetype: null,
};

const DIM_COLORS = {
  domain:      "#a78bfa",
  target:      "#60a5fa",
  creation:    "#f472b6",
  abstraction: "#34d399",
  scale:       "#fb923c",
  time:        "#e879f9",
  mode:        "#fbbf24",
};

// ── INIT ─────────────────────────────────────────
function init() {
  renderFilters();
  renderResults();
  renderArchetypes();
  setupViewToggle();

  document.getElementById("clearAllBtn").addEventListener("click", clearAll);
  document.getElementById("randomBtn").addEventListener("click", randomize);
  document.getElementById("closeCoord").addEventListener("click", () => {
    document.getElementById("coordinateCard").style.display = "none";
  });
}

// ── FILTER RENDERING ─────────────────────────────
function renderFilters() {
  const grid = document.getElementById("filterGrid");
  grid.innerHTML = "";

  DIMENSIONS.forEach(dim => {
    const card = document.createElement("div");
    card.className = "filter-card";
    card.style.setProperty("--dim-color", dim.color);
    card.dataset.dimId = dim.id;

    const count = (state.selections[dim.id] || []).length;
    const hasSelection = count > 0;
    if (hasSelection) card.classList.add("has-selection");

    card.innerHTML = `
      <div class="filter-card-header">
        <div class="filter-card-icon" style="background:${dim.color}18; color:${dim.color}">
          ${dim.icon}
        </div>
        <div style="flex:1; min-width:0">
          <div class="filter-card-title">${dim.label}</div>
          <div class="filter-card-desc">${dim.description}</div>
        </div>
        <div class="filter-card-count" style="background:${dim.color}22; color:${dim.color}">
          ${count} selected
        </div>
        <div class="filter-card-chevron">▼</div>
      </div>
      <div class="filter-options">
        ${dim.options.map(opt => {
          const sel = (state.selections[dim.id] || []).includes(opt.value);
          return `
            <div class="filter-option${sel ? ' selected' : ''}"
                 style="--opt-color:${dim.color}"
                 data-dim="${dim.id}" data-val="${opt.value}">
              <span class="filter-option-icon">${opt.icon}</span>
              <span>${opt.label}</span>
            </div>`;
        }).join("")}
      </div>
    `;

    // Toggle open on header click
    card.querySelector(".filter-card-header").addEventListener("click", () => {
      const isOpen = card.classList.toggle("open");
    });

    // Option selection
    card.querySelectorAll(".filter-option").forEach(el => {
      el.addEventListener("click", e => {
        e.stopPropagation();
        const dimId = el.dataset.dim;
        const val   = el.dataset.val;
        if (!state.selections[dimId]) state.selections[dimId] = [];
        const idx = state.selections[dimId].indexOf(val);
        if (idx === -1) state.selections[dimId].push(val);
        else state.selections[dimId].splice(idx, 1);
        if (state.selections[dimId].length === 0) delete state.selections[dimId];
        onFilterChange();
      });
    });

    grid.appendChild(card);
  });
}

// ── FILTER CHANGE ────────────────────────────────
function onFilterChange() {
  state.activeArchetype = null;
  renderFilters();
  renderResults();
  renderBreadcrumb();
  updateCoordinateCard();
}

// ── BREADCRUMB ────────────────────────────────────
function renderBreadcrumb() {
  const container = document.getElementById("breadcrumbTags");
  container.innerHTML = "";

  const hasAny = Object.keys(state.selections).some(k => state.selections[k].length > 0);
  if (!hasAny) {
    container.innerHTML = `<span style="color:var(--text-dim);font-size:12px">All dimensions open — no filters active</span>`;
    return;
  }

  DIMENSIONS.forEach(dim => {
    const vals = state.selections[dim.id] || [];
    vals.forEach(val => {
      const opt = dim.options.find(o => o.value === val);
      const tag = document.createElement("div");
      tag.className = "breadcrumb-tag";
      tag.style.borderColor = dim.color + "44";
      tag.style.color = dim.color;
      tag.innerHTML = `
        <span>${dim.icon}</span>
        <span>${opt ? opt.label : val}</span>
        <span class="breadcrumb-tag-x">×</span>
      `;
      tag.addEventListener("click", () => {
        const idx = (state.selections[dim.id] || []).indexOf(val);
        if (idx !== -1) state.selections[dim.id].splice(idx, 1);
        if (!state.selections[dim.id] || state.selections[dim.id].length === 0)
          delete state.selections[dim.id];
        onFilterChange();
      });
      container.appendChild(tag);
    });
  });
}

// ── FILTER DOMAINS ────────────────────────────────
function getFilteredDomains() {
  const sel = state.selections;
  const hasAny = Object.keys(sel).some(k => sel[k] && sel[k].length > 0);
  if (!hasAny) return DOMAINS;

  return DOMAINS.filter(domain => {
    return Object.entries(sel).every(([dimId, vals]) => {
      if (!vals || vals.length === 0) return true;
      // Each dimension check: domain must match at least one selected value
      return vals.some(v => {
        switch (dimId) {
          case "domain":      return domain.domain      && domain.domain.includes(v);
          case "target":      return domain.target      && domain.target.includes(v);
          case "creation":    return domain.creation    && domain.creation.includes(v);
          case "abstraction": return domain.abstraction && domain.abstraction.includes(v);
          case "scale":       return domain.scale       && domain.scale.includes(v);
          case "time":        return domain.time        && domain.time.includes(v);
          case "mode":        return domain.mode        && domain.mode.includes(v);
          default:            return false;
        }
      });
    });
  });
}

// ── RESULTS RENDERING ───────────────────────────
function renderResults() {
  const filtered = getFilteredDomains();
  const grid = document.getElementById("resultsGrid");
  const noRes = document.getElementById("noResults");
  const countEl = document.getElementById("countNum");

  countEl.textContent = filtered.length;
  grid.innerHTML = "";

  if (filtered.length === 0) {
    noRes.style.display = "block";
    return;
  }
  noRes.style.display = "none";

  // Determine a color for each card based on primary domain
  const domainColorMap = {
    physical:      "#fb923c",
    digital:       "#60a5fa",
    human_social:  "#34d399",
    symbolic:      "#e879f9",
    experiential:  "#f472b6",
  };

  filtered.forEach((domain, i) => {
    const cardColor = domainColorMap[domain.domain?.[0]] || "#a78bfa";
    const card = document.createElement("div");
    card.className = "domain-card";
    card.style.setProperty("--card-color", cardColor);
    card.style.animationDelay = `${Math.min(i * 0.02, 0.4)}s`;

    const tagHtml = buildDomainTags(domain);

    card.innerHTML = `
      <div class="domain-card-top">
        <div class="domain-emoji">${domain.emoji}</div>
        <div style="flex:1; min-width:0">
          <div class="domain-name">${domain.name}</div>
        </div>
        ${domain.future ? `<div class="future-badge">✦ Future</div>` : ""}
      </div>
      <div class="domain-layer">${domain.layer}</div>
      <div class="domain-desc">${domain.desc}</div>
      <div class="domain-tags">${tagHtml}</div>
    `;

    card.addEventListener("click", () => openDomainModal(domain));
    grid.appendChild(card);
  });
}

function buildDomainTags(domain) {
  const tags = [];
  // Scale
  (domain.scale || []).forEach(s => {
    const dim = DIMENSIONS.find(d => d.id === "scale");
    const opt = dim?.options.find(o => o.value === s);
    if (opt) tags.push(`<span class="domain-tag">${opt.icon} ${opt.label}</span>`);
  });
  // Mode
  (domain.mode || []).slice(0,2).forEach(s => {
    const dim = DIMENSIONS.find(d => d.id === "mode");
    const opt = dim?.options.find(o => o.value === s);
    if (opt) tags.push(`<span class="domain-tag">${opt.icon} ${opt.label}</span>`);
  });
  return tags.slice(0,3).join("");
}

// ── ARCHETYPES ────────────────────────────────────
function renderArchetypes() {
  const grid = document.getElementById("archetypeGrid");
  grid.innerHTML = "";

  ARCHETYPES.forEach(arch => {
    const card = document.createElement("div");
    card.className = "archetype-card" + (state.activeArchetype === arch.id ? " active" : "");
    card.style.setProperty("--arch-color", arch.color);

    card.innerHTML = `
      <div class="archetype-icon" style="color:${arch.color}">${arch.icon}</div>
      <div class="archetype-name">${arch.name}</div>
      <div class="archetype-desc">${arch.desc}</div>
      <div class="archetype-examples">e.g. ${arch.examples}</div>
    `;

    card.addEventListener("click", () => {
      if (state.activeArchetype === arch.id) {
        state.activeArchetype = null;
        clearAll(false);
      } else {
        state.activeArchetype = arch.id;
        applyArchetypeFilter(arch);
      }
    });

    grid.appendChild(card);
  });
}

function applyArchetypeFilter(arch) {
  // Reset and show only domains matching this archetype
  state.selections = {};
  renderFilters();
  // Show filtered by domain IDs
  filterByIds(arch.domains);
  showCoordinateCard(arch);
}

function filterByIds(ids) {
  const grid = document.getElementById("resultsGrid");
  const noRes = document.getElementById("noResults");
  const countEl = document.getElementById("countNum");

  const filtered = DOMAINS.filter(d => ids.includes(d.id));
  countEl.textContent = filtered.length;
  grid.innerHTML = "";
  noRes.style.display = "none";

  const domainColorMap = {
    physical: "#fb923c", digital: "#60a5fa",
    human_social: "#34d399", symbolic: "#e879f9", experiential: "#f472b6",
  };

  filtered.forEach((domain, i) => {
    const cardColor = domainColorMap[domain.domain?.[0]] || "#a78bfa";
    const card = document.createElement("div");
    card.className = "domain-card";
    card.style.setProperty("--card-color", cardColor);
    card.style.animationDelay = `${Math.min(i * 0.03, 0.5)}s`;

    card.innerHTML = `
      <div class="domain-card-top">
        <div class="domain-emoji">${domain.emoji}</div>
        <div style="flex:1; min-width:0">
          <div class="domain-name">${domain.name}</div>
        </div>
        ${domain.future ? `<div class="future-badge">✦ Future</div>` : ""}
      </div>
      <div class="domain-layer">${domain.layer}</div>
      <div class="domain-desc">${domain.desc}</div>
      <div class="domain-tags">${buildDomainTags(domain)}</div>
    `;
    card.addEventListener("click", () => openDomainModal(domain));
    grid.appendChild(card);
  });

  renderArchetypes();
  // Scroll to results
  document.querySelector(".results-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── COORDINATE CARD ───────────────────────────────
function showCoordinateCard(arch) {
  const card = document.getElementById("coordinateCard");
  const body = document.getElementById("coordinateBody");
  card.style.display = "block";

  body.innerHTML = `
    <div style="margin-bottom:14px">
      <div style="font-size:28px; margin-bottom:4px">${arch.icon}</div>
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:${arch.color}">${arch.name}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${arch.desc}</div>
    </div>
    <div style="font-size:12px;color:var(--text-dim);font-style:italic;margin-bottom:14px;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:2px solid ${arch.color}">
      "${arch.drive}"
    </div>
    <div class="coord-hint">Classic examples: ${arch.examples}</div>
  `;
}

function updateCoordinateCard() {
  const hasAny = Object.keys(state.selections).some(k => state.selections[k].length > 0);
  const card = document.getElementById("coordinateCard");
  const body = document.getElementById("coordinateBody");

  if (!hasAny) { card.style.display = "none"; return; }

  card.style.display = "block";
  const rows = DIMENSIONS
    .filter(dim => (state.selections[dim.id] || []).length > 0)
    .map(dim => {
      const vals = state.selections[dim.id].map(v => {
        const opt = dim.options.find(o => o.value === v);
        return `<span class="coord-val">${opt ? opt.icon + " " + opt.label : v}</span>`;
      }).join("");
      return `
        <div class="coord-row">
          <div class="coord-dim" style="color:${dim.color}">${dim.label}</div>
          <div class="coord-vals">${vals}</div>
        </div>`;
    }).join("");

  body.innerHTML = rows + `<div class="coord-hint">These coordinates narrow the space of what you could work on.</div>`;
}

// ── VIEW TOGGLE ───────────────────────────────────
function setupViewToggle() {
  const cardBtn = document.getElementById("cardViewBtn");
  const listBtn = document.getElementById("listViewBtn");
  const grid    = document.getElementById("resultsGrid");

  cardBtn.addEventListener("click", () => {
    state.listView = false;
    grid.classList.remove("list-view");
    cardBtn.classList.add("active");
    listBtn.classList.remove("active");
  });
  listBtn.addEventListener("click", () => {
    state.listView = true;
    grid.classList.add("list-view");
    listBtn.classList.add("active");
    cardBtn.classList.remove("active");
  });
}

// ── DOMAIN MODAL ──────────────────────────────────
function openDomainModal(domain) {
  // Build a nice popup
  const existing = document.getElementById("domainModal");
  if (existing) existing.remove();

  const dimLabels = (dimId) => {
    const dim = DIMENSIONS.find(d => d.id === dimId);
    return dim ? dim.label : dimId;
  };

  const getOptLabel = (dimId, v) => {
    const dim = DIMENSIONS.find(d => d.id === dimId);
    const opt = dim?.options.find(o => o.value === v);
    return opt ? opt.icon + " " + opt.label : v;
  };

  const dimensionHtml = [
    { key: "domain",      vals: domain.domain },
    { key: "target",      vals: domain.target },
    { key: "creation",    vals: domain.creation },
    { key: "abstraction", vals: domain.abstraction },
    { key: "scale",       vals: domain.scale },
    { key: "time",        vals: domain.time },
    { key: "mode",        vals: domain.mode },
  ].filter(r => r.vals && r.vals.length).map(r => `
    <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:${DIM_COLORS[r.key] || "#aaa"};min-width:110px;padding-top:3px">${dimLabels(r.key)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${r.vals.map(v => `<span style="font-size:11px;padding:2px 10px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-muted)">${getOptLabel(r.key, v)}</span>`).join("")}</div>
    </div>
  `).join("");

  const overlay = document.createElement("div");
  overlay.id = "domainModal";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:300;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
    animation:fadein 0.15s ease;padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:#0a0a14;
      border:1px solid rgba(255,255,255,0.12);
      border-radius:20px;
      padding:32px;
      max-width:560px;width:100%;
      max-height:85vh;overflow-y:auto;
      box-shadow:0 32px 80px rgba(0,0,0,0.7);
      animation:slide-up 0.2s cubic-bezier(.4,0,.2,1);
    ">
      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px">
        <div style="font-size:40px">${domain.emoji}</div>
        <div style="flex:1">
          <div style="font-family:var(--font-head);font-size:22px;font-weight:700;margin-bottom:4px">${domain.name}</div>
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim)">${domain.layer}</div>
        </div>
        ${domain.future ? `<div class="future-badge" style="margin-top:4px">✦ Future Domain</div>` : ""}
      </div>
      <div style="font-size:14.5px;color:var(--text-muted);line-height:1.7;margin-bottom:24px;padding:16px;background:rgba(255,255,255,0.03);border-radius:10px;border-left:3px solid var(--accent-1)">
        ${domain.desc}
      </div>
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);margin-bottom:14px">Coordinates</div>
      ${dimensionHtml}
      <button onclick="document.getElementById('domainModal').remove()" style="
        margin-top:20px;width:100%;
        padding:12px;border-radius:10px;
        background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1);
        color:var(--text-muted);cursor:pointer;
        font-family:var(--font);font-size:14px;
        transition:.2s;
      " onmouseover="this.style.background='rgba(255,255,255,0.09)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
        Close
      </button>
    </div>
  `;

  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── CLEAR ALL ─────────────────────────────────────
function clearAll(rerender = true) {
  state.selections = {};
  state.activeArchetype = null;
  if (rerender) {
    renderFilters();
    renderResults();
    renderBreadcrumb();
    renderArchetypes();
    document.getElementById("coordinateCard").style.display = "none";
  }
}

// ── RANDOMIZE ─────────────────────────────────────
function randomize() {
  state.selections = {};
  state.activeArchetype = null;

  // Pick 2–4 random dimensions and 1 random option each
  const shuffled = DIMENSIONS.slice().sort(() => Math.random() - 0.5);
  const pick = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
  pick.forEach(dim => {
    const opt = dim.options[Math.floor(Math.random() * dim.options.length)];
    state.selections[dim.id] = [opt.value];
  });

  renderFilters();
  renderResults();
  renderBreadcrumb();
  renderArchetypes();
  updateCoordinateCard();

  // Open selected filter cards
  document.querySelectorAll(".filter-card").forEach(card => {
    if (state.selections[card.dataset.dimId]) card.classList.add("open");
    else card.classList.remove("open");
  });
}

// ── BOOT ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
