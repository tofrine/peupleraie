const B = Object.fromEntries(DATA.buildings.map((b) => [b.id, b]));
const YEARS = Object.keys(DATA.coverage).map(Number).sort();
const NIVS = ["Galerie verte", "Galerie bleue", "Galerie jaune", "Galerie rouge", "RdC"];
const NIVCOL = {
  "Galerie verte": "#5f9e5a",
  "Galerie bleue": "#4a78b5",
  "Galerie jaune": "#d9b13b",
  "Galerie rouge": "#c4523f",
  RdC: "#8a8f88",
};
DATA.sales.forEach((s, i) => (s.i = i));
const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString("fr-FR"));
const eur = (n) => (n == null ? "–" : fmt(n) + " €");
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y),
    m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dateFr = (d) => d.split("-").reverse().join("/");
const short = (id) => B[id].label.replace(/ · .*/, "").replace("Bd Pasteur, ", "Pasteur ");

const st = {
  sel: new Set(DATA.buildings.filter((b) => b.peupleraie).map((b) => b.id)),
  years: new Set(YEARS.filter((y) => DATA.coverage[y] > 50)),
  rooms: new Set([1, 2, 3, 4, 5]),
  nivs: new Set(NIVS),
  smin: 0,
  smax: 200,
  groupBy: "g",
  noAty: true,
  plan: "AC",
  sort: { key: "med", dir: -1 },
};
try {
  const sv = JSON.parse(localStorage.getItem("peupleraie-v3") || "null");
  if (sv) {
    st.sel = new Set(sv.sel.filter((id) => B[id]));
    st.years = new Set(sv.years.filter((y) => YEARS.includes(y)));
    st.rooms = new Set(sv.rooms);
    st.nivs = new Set(sv.nivs);
    Object.assign(st, { smin: sv.smin, smax: sv.smax, groupBy: sv.groupBy, noAty: sv.noAty });
  }
} catch (e) {}
const save = () => {
  try {
    localStorage.setItem(
      "peupleraie-v3",
      JSON.stringify({
        sel: [...st.sel],
        years: [...st.years],
        rooms: [...st.rooms],
        nivs: [...st.nivs],
        smin: st.smin,
        smax: st.smax,
        groupBy: st.groupBy,
        noAty: st.noAty,
      }),
    );
  } catch (e) {}
};

const weak = YEARS.filter((y) => DATA.coverage[y] < 50);
document.getElementById("coverage").innerHTML =
  `Données DVF ${YEARS[0]}–${YEARS[YEARS.length - 1]} · ${DATA.sales.length}` +
  ` ventes d'appartements dans les ${DATA.buildings.length} bâtiments de la résidence.` +
  (weak.length
    ? ` <b>${weak.join(", ")} est très incomplète</b> (` +
      `${weak.map((y) => DATA.coverage[y]).join(", ")}` +
      ` ventes pour tout Fresnes) et décochée par défaut.`
    : "");
document.getElementById("coverage").hidden = false;
document.getElementById("updated").textContent = DATA.updated || "";

// --- filtres
const room = (p) => Math.min(Math.max(p, 1), 5);
const baseFilter = (s) =>
  st.years.has(s.y) && s.s >= st.smin && s.s <= st.smax && st.rooms.has(room(s.p)) && !(st.noAty && s.aty);
const inFilter = (s) => baseFilter(s) && (!s.niv || st.nivs.has(s.niv));
const refFilter = (r) => st.years.has(r[0]) && r[1] >= st.smin && r[1] <= st.smax && st.rooms.has(room(r[2]));
const filtered = () => DATA.sales.filter(inFilter);

function chips(el, items, set, label) {
  el.innerHTML = items
    .map((v) => `<button class="chip" type="button" data-v="${v}" aria-pressed="${set.has(v)}">${label(v)}</button>`)
    .join("");
  el.onclick = (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    const v = Number(b.dataset.v);
    set.has(v) ? set.delete(v) : set.add(v);
    b.setAttribute("aria-pressed", set.has(v));
    update();
  };
}
chips(document.getElementById("years"), YEARS, st.years, (y) => y + (DATA.coverage[y] < 50 ? " (incomplet)" : ""));
const ROOMS = [1, 2, 3, 4, 5].filter(
  (r) => DATA.sales.some((s) => room(s.p) === r) || DATA.refsales.some((x) => room(x[2]) === r),
);
chips(document.getElementById("rooms"), ROOMS, st.rooms, (r) => (r === 5 ? "F5 et +" : "F" + r));
const gb = document.getElementById("groupBy");
const markGroup = () =>
  gb.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.v === st.groupBy));
gb.onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  st.groupBy = b.dataset.v;
  markGroup();
  update();
};
markGroup();
const smin = document.getElementById("smin"),
  smax = document.getElementById("smax");
smin.value = st.smin;
smax.value = st.smax;
const onSurf = () => {
  st.smin = Number(smin.value) || 0;
  st.smax = Number(smax.value) || 300;
  update();
};
smin.oninput = onSurf;
smax.oninput = onSurf;
document.getElementById("spresets").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  const [a, z] = b.dataset.r.split("-").map(Number);
  smin.value = a;
  smax.value = z;
  onSurf();
};
const noAty = document.getElementById("noAty");
noAty.checked = st.noAty;
noAty.onchange = () => {
  st.noAty = noAty.checked;
  update();
};
const REFS = [
  { t: 0, id: "refA", name: "Fresnes appartements", libelle: "Appartements", classe: "ref", color: "var(--ref)" },
  { t: 1, id: "refM", name: "Fresnes maisons", libelle: "Maisons", classe: "ref2", color: "var(--ref2)" },
];
const refOn = { refA: true, refM: false };
try {
  const r = JSON.parse(localStorage.getItem("peupleraie-refs") || "null");
  if (r) Object.assign(refOn, r);
} catch (e) {}
const activeRefs = () => REFS.filter((r) => refOn[r.id]);
// Puces « Repères Fresnes » : un seul gabarit pour les onglets Comparer et Évolution
const refChip = (r) =>
  `<button class="chip ${r.classe} refchip" type="button" data-ref="${r.id}" aria-pressed="${!!refOn[r.id]}">` +
  `${r.libelle}</button>`;
document.querySelectorAll(".reperes").forEach((el) => {
  el.innerHTML = `<span class="label">Repères Fresnes</span><div class="chips">${REFS.map(refChip).join("")}</div>`;
});
document.querySelectorAll(".refchip").forEach(
  (b) =>
    (b.onclick = () => {
      refOn[b.dataset.ref] = !refOn[b.dataset.ref];
      try {
        localStorage.setItem("peupleraie-refs", JSON.stringify(refOn));
      } catch (e) {}
      update();
    }),
);

// --- onglets
const SANS_FILTRES = ["energie"]; // onglets indépendants du plan et des filtres du haut
const TABS = ["compare", "trend", "gal", "fresnes", "sales", "estimer"];
function showTab(t) {
  if (!TABS.includes(t)) t = "compare";
  TABS.forEach((k) => {
    document.getElementById("tab-" + k).hidden = k !== t;
  });
  document.querySelectorAll("#tabs .tab").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  const bench = document.querySelector(".bench"),
    planSeul = t === "estimer"; // le plan reste visible ; réglages et chiffres clés n'ont pas d'effet ici
  bench.hidden = SANS_FILTRES.includes(t);
  bench.classList.toggle("plan-seul", planSeul);
  document.querySelector(".bench > [aria-label='Réglages']").hidden = planSeul;
  document.getElementById("summary").hidden = SANS_FILTRES.includes(t) || planSeul;
  try {
    sessionStorage.setItem("peupleraie-tab", t);
  } catch (e) {}
}
document.getElementById("tabs").onclick = (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  showTab(b.dataset.tab);
  b.scrollIntoView({ inline: "center", block: "nearest" });
  update(); // les graphiques prennent la largeur de l'onglet devenu visible
  map.invalidateSize();
};
document.getElementById("tabs").onkeydown = (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const cur = TABS.findIndex((k) => document.getElementById("tab-" + k).hidden === false),
    n = (cur + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
  showTab(TABS[n]);
  update();
  map.invalidateSize();
  document.querySelector(`#tabs [data-tab="${TABS[n]}"]`).focus();
};
let startTab = "compare";
try {
  startTab = sessionStorage.getItem("peupleraie-tab") || "compare";
} catch (e) {}
showTab(startTab);

// --- liste des bâtiments
const SHORTN = {
  A: "A · Oseraie",
  B: "B · Favorite",
  C: "C · Braque",
  E: "E · Résidence",
  O: "O · Blancs-Bouleaux",
  F: "F · Louis Pasteur",
  H: "H · Convention",
};
const MAPL = { A: "A", B: "B", C: "C", E: "E", O: "O", F: "F", H: "H" };
function renderList() {
  const counts = {};
  filtered().forEach((s) => (counts[s.g] = (counts[s.g] || 0) + 1));
  const chip = (b) =>
    `<button type="button" class="chip${b.peupleraie ? "" : " alt"}" data-id="${b.id}` +
    `" aria-pressed="${st.sel.has(b.id)}" title="${esc(b.label)} · entrées ` +
    `${b.entrees.join(", ")}">${SHORTN[b.id] || esc(b.label)}<span class="n">` +
    `${counts[b.id] || 0}</span></button>`;
  const inside = DATA.buildings.filter((b) => b.peupleraie),
    outside = DATA.buildings.filter((b) => !b.peupleraie);
  document.getElementById("bchips").innerHTML = outside.length
    ? `<div><div class="sublabel">La Peupleraie</div><div class="chips">` +
      `${inside.map(chip).join("")}</div></div><div>` +
      `<div class="sublabel">En face, pour comparer</div><div class="chips">` +
      `${outside.map(chip).join("")}</div></div>`
    : `<div class="chips">${inside.map(chip).join("")}</div>`;
}
document.getElementById("bchips").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  const id = b.dataset.id;
  st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id);
  update();
};
document.getElementById("mapkey").innerHTML = DATA.buildings
  .map(
    (b) =>
      `<span><b>${MAPL[b.id] || b.id}</b> ` +
      `${esc(SHORTN[b.id] || b.label).replace(/^[A-Z] · /, "")}` +
      `${b.peupleraie ? "" : " (en face)"}</span>`,
  )
  .join("");
document.getElementById("selNone").onclick = () => {
  st.sel = new Set();
  update();
};

// --- plan
const map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.5 });
const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  maxNativeZoom: 19,
  attribution: "© contributeurs OpenStreetMap",
}).addTo(map);
let tileErr = 0;
tiles.on("tileerror", () => {
  if (++tileErr === 3)
    document.getElementById("tilenote").textContent +=
      " Le fond de carte ne se charge pas dans cet aperçu ; il s'affiche sur le site publié.";
});
map.fitBounds(L.latLngBounds(DATA.buildings.map((b) => [b.lat, b.lon])).pad(0.2));
const markers = {},
  labels = {};
DATA.buildings.forEach((b) => {
  const m = L.circleMarker([b.lat, b.lon], { radius: 10, weight: 2 }).addTo(map);
  m.on("click", () => {
    st.sel.has(b.id) ? st.sel.delete(b.id) : st.sel.add(b.id);
    update();
  });
  markers[b.id] = m;
  labels[b.id] = L.marker([b.lat, b.lon], {
    interactive: false,
    icon: L.divIcon({
      className: "",
      html: `<span class="maplabel">${esc(MAPL[b.id] || b.id)}</span>`,
      iconSize: [0, 0],
    }),
  }).addTo(map);
});
const SEQ = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5"];
let scale = { lo: 0, hi: 1 };
const seqColor = (med) => {
  if (med == null) return css("--nodata");
  const k = Math.min(4, Math.max(0, Math.floor((med - scale.lo) / ((scale.hi - scale.lo) / 5 || 1))));
  return css(SEQ[k]);
};
function renderMap() {
  const by = {};
  filtered().forEach((s) => (by[s.g] = by[s.g] || []).push(s.m2));
  const meds = Object.values(by)
    .map(median)
    .sort((a, b) => a - b);
  scale = { lo: meds.length ? meds[0] : 0, hi: meds.length ? meds[meds.length - 1] : 1 };
  document.getElementById("ramp").innerHTML = SEQ.map((v) => `<i style="background:var(${v})"></i>`).join("");
  document.getElementById("rampLabels").textContent = meds.length ? `${fmt(scale.lo)} → ${fmt(scale.hi)} €/m²` : "";
  DATA.buildings.forEach((b) => {
    const arr = by[b.id] || [],
      med = median(arr),
      sel = st.sel.has(b.id);
    markers[b.id].setStyle({
      radius: 8 + Math.min(12, Math.sqrt(arr.length) * 2.2),
      fillColor: seqColor(med),
      fillOpacity: sel ? 0.95 : 0.35,
      color: sel ? css("--sel") : css("--ink-3"),
      weight: sel ? 4 : 1,
      dashArray: sel ? null : "3 3",
    });
    markers[b.id].bindTooltip(
      `<b>${esc(b.label)}</b><br>Entrées ${b.entrees.join(", ")}<br>${arr.length} vente` +
        `${arr.length > 1 ? "s" : ""}${med != null ? " · médiane " + fmt(med) + " €/m²" : ""}` +
        `<br><span style="color:var(--ink-3)">` +
        `${sel ? "Clic pour retirer" : "Clic pour ajouter"}</span>`,
      { direction: "top", offset: [0, -8] },
    );
    if (sel) markers[b.id].bringToFront();
  });
}

// --- regroupements
const KEY = {
  g: (s) => s.g,
  e: (s) => s.g + "|" + (s.e || "?"),
  p: (s) => String(room(s.p)),
  niv: (s) => s.niv || null,
  md: (s) => (s.md ? (s.md === "M" ? "Montant" : "Descendant") : null),
};
const LABEL = {
  g: (k) => B[k].label,
  e: (k) => {
    const [g, e] = k.split("|");
    return `${short(g)} · n° ${e}`;
  },
  p: (k) => (k === "5" ? "5 pièces et +" : `${k} pièce${k > 1 ? "s" : ""}`),
  niv: (k) => k,
  md: (k) => k,
};
function groups() {
  const sales = filtered().filter((s) => st.sel.has(s.g)),
    g = new Map();
  sales.forEach((s) => {
    const k = KEY[st.groupBy](s);
    if (k == null) return;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(s);
  });
  return {
    sales,
    list: [...g].map(([k, ss]) => ({ k, label: LABEL[st.groupBy](k), ss, med: median(ss.map((s) => s.m2)) })),
    note:
      (st.groupBy === "niv" || st.groupBy === "md") && !st.sel.has("A") && !st.sel.has("C")
        ? "Cochez le bâtiment A ou C : la galerie n'est connue que pour eux."
        : "",
  };
}
const refRows = (t) => DATA.refsales.filter((r) => r[4] === t && refFilter(r));
const refVals = (t) => refRows(t).map((r) => r[3]);

function renderSummary(G) {
  const m = G.sales.map((s) => s.m2),
    mr = median(refVals(0)),
    md = median(m);
  const diff = md != null && mr ? Math.round((md / mr - 1) * 1000) / 10 : null;
  const tile = (v, u, l, cls = "") =>
    `<div class="stat ${cls}"><b>${v}${u ? `<small>${u}</small>` : ""}</b><span>${l}</span></div>`;
  document.getElementById("summary").innerHTML =
    tile(md != null ? fmt(md) : "–", "€/m²", "médiane de votre sélection", "lead") +
    tile(mr != null ? fmt(mr) : "–", "€/m²", "médiane Fresnes, appartements") +
    tile(
      diff == null ? "–" : (diff > 0 ? "+" : diff < 0 ? "−" : "") + String(Math.abs(diff).toFixed(1)).replace(".", ","),
      "%",
      diff == null
        ? "écart avec Fresnes"
        : diff === 0
          ? "au niveau de Fresnes"
          : diff > 0
            ? "au-dessus de Fresnes"
            : "sous Fresnes",
    ) +
    tile(G.sales.length, "", `vente${G.sales.length > 1 ? "s" : ""} retenue${G.sales.length > 1 ? "s" : ""}`);
  const n = DATA.sales.filter((s) => s.aty && st.sel.has(s.g)).length;
  document.getElementById("atyCount").textContent = n ? `(${n} dans la sélection)` : "";
}

// --- infobulle
const tip = document.getElementById("tip");
function showTip(e, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14,
    y = e.clientY + 14;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
const hideTip = () => {
  tip.hidden = true;
};
const where = (s) =>
  `${short(s.g)}${s.e ? ", n° " + s.e : ""}` +
  `${s.niv ? " · " + s.niv + (s.md ? (s.md === "M" ? ", montant" : ", descendant") : "") : ""}`;
const saleTip = (s) =>
  `<b>${esc(where(s))}</b><br>${dateFr(s.d)} · ${s.s} m² · ${s.p || "?"} p.` +
  `${s.typ ? " (" + s.typ + ")" : ""}<br>${eur(s.v)} · <b>${fmt(s.m2)} €/m²</b>` +
  `${s.dep ? `<br>avec ${s.dep} dépendance${s.dep > 1 ? "s" : ""} (cave, parking…)` : ""}` +
  `${s.aty ? "<br><i>Vente atypique</i>" : ""}`;

function niceTicks(lo, hi, n = 6) {
  const raw = (hi - lo) / n,
    p = Math.pow(10, Math.floor(Math.log10(raw))),
    sp = [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= raw);
  const t = [];
  for (let v = Math.ceil(lo / sp) * sp; v <= hi + 1e-9; v += sp) t.push(v);
  return t;
}

// --- largeur des graphiques : celle du conteneur (l'onglet doit être visible), de 300 à 900 px
const chartWidth = (el) => Math.max(300, Math.min(900, el.clientWidth || 900));

// --- comparaison vente par vente
const stripLabel = (r, compact) => {
  const nom = compact && st.groupBy === "g" && SHORTN[r.k] ? SHORTN[r.k] : r.label,
    max = compact ? 15 : 34;
  return esc(nom.length > max ? nom.slice(0, max - 1) + "…" : nom);
};
function renderStrip(G) {
  const el = document.getElementById("strip"),
    rows = [...G.list].sort((a, b) => b.med - a.med);
  const refs = activeRefs()
    .map((r) => ({ ...r, v: refVals(r.t) }))
    .filter((r) => r.v.length);
  if (!rows.length) {
    el.innerHTML =
      `<p class="empty">` +
      `${G.note || "Aucune vente ne correspond : sélectionnez des bâtiments sur le plan ou élargissez les filtres."}` +
      `</p>`;
    return;
  }
  const all = rows.flatMap((r) => r.ss.map((s) => s.m2)).concat(refs.map((r) => median(r.v)));
  let lo = Math.min(...all),
    hi = Math.max(...all);
  const pad = (hi - lo) * 0.06 || 200;
  lo -= pad;
  hi += pad;
  const W = chartWidth(el),
    compact = W < 560,
    L0 = compact ? 120 : 230,
    R0 = compact ? 74 : 96,
    rh = compact ? 34 : 36,
    n = rows.length + refs.length,
    H = 40 + n * rh;
  const x = (v) => L0 + ((v - lo) / (hi - lo)) * (W - L0 - R0);
  let s =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Prix au m² par vente"><g class="axis">` +
    niceTicks(lo, hi, compact ? 3 : 6)
      .map(
        (t) =>
          `<line x1="${x(t)}" x2="${x(t)}" y1="18" y2="${H - 22}` +
          `" stroke="var(--grid)" stroke-width="1"/><text x="${x(t)}" y="${H - 6}` +
          `" text-anchor="middle">${fmt(t)}</text>`,
      )
      .join("") +
    `</g>`;
  s +=
    `<text x="${W - R0 + 8}" y="12" ` +
    `style="font-family:var(--f-mono);font-size:10px;fill:var(--ink-3)">méd. · nb</text>`;
  rows.forEach((r, i) => {
    const y = 34 + i * rh,
      v = r.ss.map((q) => q.m2),
      mn = Math.min(...v),
      mx = Math.max(...v);
    s += `<text x="${L0 - 12}" y="${y + 4}" text-anchor="end">` + `${stripLabel(r, compact)}</text>`;
    s +=
      `<line x1="${x(mn)}" x2="${x(mx)}" y1="${y}" y2="${y}` +
      `" stroke="var(--line)" stroke-width="2" stroke-linecap="round"/>`;
    r.ss.forEach((q, j) => {
      s +=
        `<circle class="sd" data-i="${q.i}" cx="${x(q.m2)}" cy="${y + ((j % 3) - 1) * 4}` +
        `" r="5.5" fill="${q.niv && st.groupBy !== "niv" ? NIVCOL[q.niv] : "var(--accent)"}` +
        `" fill-opacity="0.8" stroke="var(--panel)" stroke-width="1.5"/>`;
    });
    s +=
      `<line x1="${x(r.med)}" x2="${x(r.med)}" y1="${y - 11}" y2="${y + 11}` +
      `" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>`;
    s +=
      `<text x="${W - R0 + 8}" y="${y + 4}` +
      `" style="font-family:var(--f-mono);font-size:11px">${fmt(r.med)} · ${r.ss.length}` +
      `</text>`;
  });
  refs.forEach((r, k) => {
    const y = 34 + (rows.length + k) * rh,
      srt = [...r.v].sort((a, b) => a - b),
      q = (p) => srt[Math.floor(p * (srt.length - 1))],
      m = median(r.v);
    const x1 = x(Math.max(lo, q(0.25))),
      x2 = x(Math.min(hi, q(0.75)));
    s +=
      `<text x="${L0 - 12}" y="${y + 4}" text-anchor="end" style="font-style:italic">` +
      `${compact ? r.name.replace("appartements", "apparts.") : r.name + " (mêmes filtres)"}</text>`;
    s +=
      `<rect class="refbar" data-tip="${r.name}, mêmes filtres : la moitié des ventes entre ` +
      `${fmt(q(0.25))} et ${fmt(q(0.75))} €/m²" x="${Math.min(x1, x2)}" y="${y - 5}" width="` +
      `${Math.max(2, Math.abs(x2 - x1))}" height="10" rx="3" fill="${r.color}` +
      `" fill-opacity="0.3"/>`;
    s +=
      `<line x1="${x(m)}" x2="${x(m)}" y1="${y - 11}" y2="${y + 11}" stroke="${r.color}` +
      `" stroke-width="2.5" stroke-dasharray="3 2"/>`;
    s +=
      `<text x="${W - R0 + 8}" y="${y + 4}` +
      `" style="font-family:var(--f-mono);font-size:11px">${fmt(m)} · ${r.v.length}</text>`;
  });
  el.innerHTML =
    s +
    `</svg>` +
    (G.list.some((r) => r.ss.some((q) => q.niv)) && st.groupBy !== "niv"
      ? `<div class="legend">` +
        `${NIVS.map((n) => `<span><i style="background:${NIVCOL[n]};height:10px;width:10px;border-radius:50%"></i>${n} (bât. A et C)</span>`).join("")}` +
        `<span><i style="background:var(--accent);height:10px;width:10px;border-radius:50%">` +
        `</i>autres bâtiments</span></div>`
      : "");
  el.querySelectorAll(".sd").forEach((c) => {
    c.onmousemove = (e) => showTip(e, saleTip(DATA.sales[+c.dataset.i]));
    c.onmouseleave = hideTip;
  });
  el.querySelectorAll(".refbar").forEach((rb) => {
    rb.onmousemove = (e) => showTip(e, esc(rb.dataset.tip));
    rb.onmouseleave = hideTip;
  });
}

// --- tableau
const COLS = [
  ["label", "Groupe"],
  ["n", "Ventes"],
  ["surf", "Surface méd."],
  ["min", "Min €/m²"],
  ["med", "Médiane €/m²"],
  ["max", "Max €/m²"],
  ["prix", "Prix méd."],
];
// --- tableaux triables : un clic sur un titre trie la colonne, un second clic inverse l'ordre
const TEXTE = new Set(["label", "g", "e", "niv"]); // colonnes qui se trient d'abord de A à Z
function enteteTriable(colonnes, tri) {
  const cols = colonnes
    .map(
      ([k, l]) =>
        `<th data-k="${k}"${k === tri.key ? ` aria-sort="${tri.dir > 0 ? "ascending" : "descending"}"` : ""}>${l}</th>`,
    )
    .join("");
  return `<thead><tr>${cols}</tr></thead>`;
}
function trier(lignes, tri, valeur = (l, k) => l[k]) {
  const vide = (v) => v == null || v === "";
  return [...lignes].sort((a, b) => {
    const [x, y] = [valeur(a, tri.key), valeur(b, tri.key)];
    if (vide(x) || vide(y)) return vide(x) - vide(y); // les cases vides vont toujours à la fin
    const c = typeof x === "string" ? x.localeCompare(y, "fr", { numeric: true }) : x - y;
    return c * tri.dir;
  });
}
function brancherTri(table, tri, redessiner) {
  const changer = (k) => {
    Object.assign(tri, { key: k, dir: tri.key === k ? -tri.dir : TEXTE.has(k) ? 1 : -1 });
    redessiner();
  };
  const titres = [...table.querySelectorAll("th[data-k]")];
  titres.forEach((th) => (th.onclick = () => changer(th.dataset.k)));
  // sur téléphone les tableaux deviennent des fiches sans titres : un menu prend le relais
  const hote = table.closest(".tablewrap"),
    ancien = hote.previousElementSibling;
  if (ancien?.classList.contains("tri-mobile")) ancien.remove();
  if (!titres.length) return;
  const barre = document.createElement("div");
  barre.className = "tri-mobile";
  barre.innerHTML =
    `<label>Trier par <select class="pick">` +
    titres
      .map(
        (th) =>
          `<option value="${th.dataset.k}"${th.dataset.k === tri.key ? " selected" : ""}>${th.textContent}</option>`,
      )
      .join("") +
    `</select></label><button class="chip" type="button" aria-label="Inverser l'ordre">${tri.dir > 0 ? "↑" : "↓"}</button>`;
  barre.querySelector("select").onchange = (e) => {
    Object.assign(tri, { key: e.target.value, dir: TEXTE.has(e.target.value) ? 1 : -1 });
    redessiner();
  };
  barre.querySelector("button").onclick = () => {
    tri.dir = -tri.dir;
    redessiner();
  };
  hote.before(barre);
}

function statsOf(ss) {
  const v = ss.map((s) => s.m2);
  return {
    n: ss.length,
    surf: median(ss.map((s) => s.s)),
    min: Math.min(...v),
    med: median(v),
    max: Math.max(...v),
    prix: median(ss.map((s) => s.v)),
  };
}
function renderTable(G) {
  const t = document.getElementById("table");
  if (!G.list.length) {
    t.innerHTML = `<tr><td class="empty">${G.note || "Aucune vente avec ces réglages."}</td></tr>`;
    return;
  }
  const rows = G.list.map((r) => ({ label: r.label, ...statsOf(r.ss) }));
  const sorted = trier(rows, st.sort);
  const cell = (r, k) =>
    k === "label"
      ? esc(r.label)
      : k === "n"
        ? r.n
        : k === "surf"
          ? fmt(r.surf) + " m²"
          : k === "prix"
            ? eur(r.prix)
            : fmt(r[k]);
  let h = enteteTriable(COLS, st.sort) + "<tbody>";
  h += sorted
    .map((r) => `<tr class="${r.n < 3 ? "few" : ""}">${COLS.map(([k]) => `<td>${cell(r, k)}</td>`).join("")}</tr>`)
    .join("");
  if (G.list.length > 1) {
    const all = { label: "Ensemble de la sélection", ...statsOf(G.list.flatMap((r) => r.ss)) };
    h += `<tr class="total">${COLS.map(([k]) => `<td>${cell(all, k)}</td>`).join("")}</tr>`;
  }
  activeRefs().forEach((rf) => {
    const rr = refRows(rf.t);
    if (rr.length) {
      const v = rr.map((r) => r[3]);
      const ref = {
        label: `${rf.name} (mêmes filtres)`,
        n: rr.length,
        surf: median(rr.map((r) => r[1])),
        min: Math.min(...v),
        med: median(v),
        max: Math.max(...v),
        prix: null,
      };
      h += `<tr class="ref">${COLS.map(([k]) => `<td>${cell(ref, k)}</td>`).join("")}</tr>`;
    }
  });
  t.innerHTML = h + "</tbody>";
  brancherTri(t, st.sort, () => renderTable(groups()));
}

const lum = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 1;
  const c = [0, 2, 4]
    .map((i) => parseInt(m[1].substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
// --- schéma du bâtiment A
function renderBatA() {
  const el = document.getElementById("bata"),
    ss = DATA.sales.filter((s) => st.plan.includes(s.g) && s.niv && baseFilter(s));
  let h =
    `<div class="bata"><span></span><span class="h">Escalier A · portes 2 à 10</span>` +
    `<span class="h">Escalier B · portes 10 à 18</span>`;
  NIVS.forEach((n) => {
    h += `<span class="lv"><i style="background:${NIVCOL[n]}"></i>` + `${n === "RdC" ? "Rez-de-chaussée" : n}</span>`;
    ["A", "B"].forEach((e) => {
      const v = ss.filter((s) => s.niv === n && s.esc === e),
        med = median(v.map((s) => s.m2)),
        bg = seqColor(med);
      const cls = lum(bg) < 0.3 ? "lt" : "dk";
      const mm = v.length
        ? `${v.filter((s) => s.md === "M").length} mont. · ${v.filter((s) => s.md === "D").length} desc.`
        : "";
      h += `<button type="button" class="cell ${cls}" data-n="${n}" aria-pressed="${st.nivs.has(n)}" style="background:${bg}">
        <b>${med != null ? fmt(med) + " €/m²" : "–"}</b><span>${v.length} vente${v.length > 1 ? "s" : ""}${mm ? " · " + mm : ""}</span></button>`;
    });
  });
  el.innerHTML = h + `</div>`;
  el.querySelectorAll(".cell").forEach(
    (c) =>
      (c.onclick = () => {
        const n = c.dataset.n;
        st.nivs.has(n) ? st.nivs.delete(n) : st.nivs.add(n);
        if (!st.nivs.size) NIVS.forEach((x) => st.nivs.add(x));
        update();
      }),
  );
}

const planEl = document.getElementById("plan");
const markPlan = () =>
  planEl.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.v === st.plan));
planEl.onclick = (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  st.plan = b.dataset.v;
  markPlan();
  renderBatA();
};
markPlan();

// --- évolution
function lineChart(el, legendEl, ys, series, labelAll, noLabels) {
  legendEl.innerHTML = series
    .map((s) => `<span><i class="${s.dash ? "dash" : ""}" style="background:${s.color}"></i>${s.name}</span>`)
    .join("");
  const vals = series.flatMap((s) => s.pts.filter((p) => p.med != null).map((p) => p.med));
  if (!ys.length || !vals.length) {
    el.innerHTML = `<p class="empty">Pas assez de ventes pour tracer une évolution.</p>`;
    return;
  }
  let lo = Math.min(...vals),
    hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || 300;
  lo = Math.max(0, lo - pad);
  hi += pad;
  const W = chartWidth(el),
    compact = W < 560,
    H = compact ? 260 : 300,
    L0 = compact ? 46 : 56,
    R0 = compact ? 16 : 24,
    T0 = 22,
    B0 = 32;
  const x = (y) =>
      ys.length === 1 ? (L0 + W - R0) / 2 : L0 + 20 + ((y - ys[0]) / (ys[ys.length - 1] - ys[0])) * (W - L0 - R0 - 40),
    yy = (v) => T0 + (1 - (v - lo) / (hi - lo)) * (H - T0 - B0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du prix médian au m²">` + `<g class="axis">`;
  niceTicks(lo, hi, 5).forEach((t) => {
    s +=
      `<line x1="${L0}" x2="${W - R0}" y1="${yy(t)}" y2="${yy(t)}" stroke="var(--grid)"/>` +
      `<text x="${L0 - 8}" y="${yy(t) + 4}" text-anchor="end">${fmt(t)}</text>`;
  });
  ys.forEach((y) => {
    s += `<text x="${x(y)}" y="${H - 10}" text-anchor="middle">${y}</text>`;
  });
  s += `</g>`;
  series.forEach((se, si) => {
    const pts = se.pts.filter((p) => p.med != null);
    if (pts.length > 1)
      s +=
        `<polyline fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" ` +
        `${se.dash ? 'stroke-dasharray="6 4"' : ""} points="` +
        `${pts.map((p) => `${x(p.y)},${yy(p.med)}`).join(" ")}"/>`;
    pts.forEach((p) => {
      s +=
        `<circle cx="${x(p.y)}" cy="${yy(p.med)}" r="5" fill="` +
        `${p.n < 3 ? "var(--panel)" : se.color}" stroke="${se.color}" stroke-width="2"/>` +
        `<circle class="hit" data-s="${si}" data-y="${p.y}" cx="${x(p.y)}" cy="${yy(p.med)}` +
        `" r="14" fill="transparent"/>`;
    });
    if ((si === 0 && !noLabels) || labelAll)
      pts.forEach((p) => {
        s +=
          `<text x="${x(p.y)}" y="${yy(p.med) + (labelAll && si === 1 ? 21 : -12)}" ` +
          `text-anchor="middle" ` +
          `style="font-family:var(--f-mono);font-size:11px;fill:var(--ink)">${fmt(p.med)}</text>`;
      });
  });
  el.innerHTML = s + `</svg>`;
  el.querySelectorAll(".hit").forEach((c) => {
    c.onmousemove = (e) => {
      const se = series[+c.dataset.s],
        p = se.pts.find((q) => q.y === +c.dataset.y);
      showTip(e, `<b>${se.name}, ${p.y}</b><br>médiane ${fmt(p.med)} €/m² · ${p.n} vente${p.n > 1 ? "s" : ""}`);
    };
    c.onmouseleave = hideTip;
  });
}
const pointsBy = (rows, ys) =>
  ys.map((y) => {
    const v = rows.filter((r) => r[0] === y).map((r) => r[3]);
    return { y, med: median(v), n: v.length };
  });

const TREND_COL = ["#2a6fdb", "#d9822b", "#2f9e6b", "#c0457b", "#7a5bd1", "#b59a1c", "#2aa3b8", "#8a8f98"];
let trendMode = "g";
const trendSel = document.getElementById("trendMode");
trendSel.onchange = () => {
  trendMode = trendSel.value;
  update();
};
function renderTrend(G) {
  const ys = YEARS.filter((y) => st.years.has(y)),
    by = (rows) =>
      ys.map((y) => {
        const v = rows.filter((s) => s.y === y).map((s) => s.m2);
        return { y, med: median(v), n: v.length };
      });
  let series = [];
  if (trendMode !== "pool") {
    const m = new Map();
    G.sales.forEach((s) => {
      const k = KEY[trendMode](s);
      if (k == null) return;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    });
    const nom = (k) => (trendMode === "g" ? SHORTN[k] || LABEL.g(k) : LABEL[trendMode](k));
    series = [...m]
      .sort((x, y) => String(x[0]).localeCompare(String(y[0]), "fr", { numeric: true }))
      .map(([k, ss], i) => ({ name: nom(k), color: TREND_COL[i % TREND_COL.length], dash: false, pts: by(ss) }));
  }
  const split = series.length > 1;
  if (!split) series = [{ name: "Sélection", color: "var(--accent)", dash: false, pts: by(G.sales) }];
  activeRefs().forEach((rf) =>
    series.push({ name: `${rf.name} (mêmes filtres)`, color: rf.color, dash: true, pts: pointsBy(refRows(rf.t), ys) }),
  );
  lineChart(document.getElementById("trend"), document.getElementById("trendLegend"), ys, series, false, split);
  document.getElementById("trendNote").textContent =
    trendMode === "niv" || trendMode === "md"
      ? G.sales.some((s) => KEY[trendMode](s))
        ? ""
        : "Cochez le bâtiment A ou C : la galerie n'est connue que pour eux."
      : "";
  document.getElementById("trendTable").innerHTML = !series.some((s) => s.pts.some((p) => p.med != null))
    ? ""
    : `<thead><tr><th>Année</th>` +
      `${series.map((s) => `<th>${s.name} €/m²</th><th>ventes</th>`).join("")}</tr></thead>` +
      `<tbody>` +
      ys
        .map(
          (y, k) =>
            `<tr><td>${y}</td>` +
            `${series.map((s) => `<td>${s.pts[k].med != null ? fmt(s.pts[k].med) : "–"}</td><td>${s.pts[k].n}</td>`).join("")}` +
            `</tr>`,
        )
        .join("") +
      `</tbody>`;
}

// --- Fresnes : ensemble, appartements, maisons
function renderFresnes() {
  const ys = YEARS.filter((y) => st.years.has(y)),
    useF = document.getElementById("frFilters").checked;
  const rows = DATA.refsales.filter((r) => (useF ? refFilter(r) : st.years.has(r[0])));
  const series = [
    { name: "Fresnes, ensemble", color: "var(--ink-2)", dash: false, pts: pointsBy(rows, ys) },
    {
      name: "Fresnes, appartements",
      color: "var(--ref)",
      dash: false,
      pts: pointsBy(
        rows.filter((r) => r[4] === 0),
        ys,
      ),
    },
    {
      name: "Fresnes, maisons",
      color: "var(--ref2)",
      dash: false,
      pts: pointsBy(
        rows.filter((r) => r[4] === 1),
        ys,
      ),
    },
  ];
  lineChart(document.getElementById("fresnes"), document.getElementById("fresnesLegend"), ys, series, true);
  const t = document.getElementById("fresnesTable");
  t.innerHTML =
    `<thead><tr><th>Année</th>` +
    `${series.map((s) => `<th>${s.name.replace("Fresnes, ", "")} €/m²</th><th>ventes</th>`).join("")}` +
    `</tr></thead><tbody>` +
    ys
      .map(
        (y, i) =>
          `<tr><td>${y}</td>` +
          `${series.map((s) => `<td>${fmt(s.pts[i].med)}</td><td>${s.pts[i].n}</td>`).join("")}` +
          `</tr>`,
      )
      .join("") +
    `</tbody>`;
}
document.getElementById("frFilters").onchange = () => renderFresnes();

// --- Énergie (DPE) : effectifs et médianes par groupe, jamais de logement isolé
const ETIQ = ["A", "B", "C", "D", "E", "F", "G"];
function renderEnergie() {
  const D = DATA.dpe;
  if (!D) return;
  document.getElementById("tabEnergie").hidden = false;
  TABS.splice(TABS.indexOf("fresnes") + 1, 0, "energie");
  const name = (c) => (c === "TOUS" ? "Tout le domaine" : SHORTN[c] || c);
  document.getElementById("energieSrc").textContent = `ADEME, mis à jour le ${D.maj} · ${D.n_logements} logements`;
  document.getElementById("energieKey").innerHTML = ETIQ.map((e) => `<span style="--c:var(--e${e})">${e}</span>`).join(
    "",
  );
  const rows = Object.entries(D.repartition).map(
    ([c, r]) => `<div class="erow"><span class="elab">${name(c)}</span>
    <div class="ebar" role="img" aria-label="${ETIQ.map((e) => `${e} : ${r[e]}`).join(", ")}">${ETIQ.filter((e) => r[e])
      .map((e) => `<i style="flex:${r[e]};background:var(--e${e})" title="${e} : ${r[e]}">${r[e] >= 3 ? r[e] : ""}</i>`)
      .join("")}</div>
    <span class="en">${r.n} DPE</span></div>`,
  );
  D.trop_peu.forEach((c) =>
    rows.push(
      `<div class="erow"><span class="elab">${name(c)}</span>` +
        `<span class="hint">moins de 5 DPE : non affiché</span><span></span></div>`,
    ),
  );
  document.getElementById("energieBars").innerHTML = rows.join("");
  document.getElementById("energieNote").innerHTML =
    "Un seul DPE par logement (le plus récent), établis depuis juillet 2021 : cela ne " +
    "couvre pas tous les logements. " +
    ("Calendrier de la loi Climat et résilience : les logements classés G ne peuvent plus " +
      "être loués depuis 2025, les F à partir de 2028, les E à partir de 2034.");
  const cols = Object.keys(D.prix).filter((c) => c === "TOUS" || Object.values(D.prix[c]).some((s) => s.med != null)),
    cell = (s) =>
      !s || !s.n ? "–" : s.med ? `${fmt(s.med)} <small>n=${s.n}</small>` : `<span class="dim">n=${s.n}</span>`;
  const ref = D.prix.TOUS["D"] && D.prix.TOUS["D"].med;
  document.getElementById("energiePrix").innerHTML =
    `<thead><tr><th>Étiquette</th>` +
    `${cols.map((c, i) => `<th>${name(c)} €/m²</th>${i === 0 ? "<th>Écart à D</th>" : ""}`).join("")}` +
    `</tr></thead><tbody>` +
    Object.keys(D.prix.TOUS)
      .map((g) => {
        const s = D.prix.TOUS[g],
          ec = ref && s.med && g !== "D" ? Math.round((s.med / ref - 1) * 100) : null;
        return (
          `<tr><td>${g}</td>` +
          `${cols.map((c, i) => `<td>${cell(D.prix[c][g])}</td>${i === 0 ? `<td>${ec == null ? "–" : (ec > 0 ? "+" : "") + ec + " %"}</td>` : ""}`).join("")}` +
          `</tr>`
        );
      })
      .join("") +
    `</tbody>`;
  const L = D.lien,
    pc = (v) => (v > 0 ? "+" : "") + String(v).replace(".", ",") + " %",
    V = document.getElementById("energieVerdict");
  const reserve = " L'intervalle est large parce que les ventes rapprochées d'un DPE sont peu nombreuses.";
  const msg = {
    trop_peu:
      `<b>Trop peu de ventes pour conclure.</b> Seules ${L.n} ventes sont rapprochées d'un ` +
      `DPE avec un prix de comparaison fiable ; il en faudrait au moins 20, réparties sur ` +
      `au moins deux classes d'étiquette.`,
    aucun:
      `<b>On ne peut pas conclure à un lien entre l'étiquette et le prix.</b> Sur ${L.n}` +
      ` ventes, l'écart estimé est de ${pc(L.effet)}` +
      ` par classe d'étiquette, avec un intervalle de confiance à 95 % de ` +
      `${pc(L.ic && L.ic[0])} à ${pc(L.ic && L.ic[1])}` +
      ` : il contient 0, donc les données sont compatibles avec <b>aucun effet</b>.` +
      `${reserve}`,
    negatif:
      `<b>Les logements moins bien classés se vendent moins cher :</b> environ ` +
      `${pc(L.effet)}` +
      ` par classe d'étiquette (de A–C vers F–G), intervalle de confiance à 95 % de ` +
      `${pc(L.ic && L.ic[0])} à ${pc(L.ic && L.ic[1])}, sur ${L.n} ventes.${reserve}`,
    positif:
      `<b>Résultat inattendu :</b> les logements moins bien classés se vendent plutôt plus ` +
      `cher (${pc(L.effet)} par classe, intervalle à 95 % de ${pc(L.ic && L.ic[0])} à ` +
      `${pc(L.ic && L.ic[1])}, ${L.n} ventes). Cela vient très probablement d'autres ` +
      `différences (étage, état, rénovation) et non de l'étiquette.${reserve}`,
  }[L.verdict];
  V.innerHTML = msg;
  V.classList.toggle("found", L.verdict === "negatif" || L.verdict === "positif");
  document.getElementById("energieEcart").innerHTML =
    `<thead><tr><th>Étiquette</th><th>écart au prix typique</th><th>ventes</th></tr></thead><tbody>` +
    Object.entries(D.ecart)
      .map(
        ([g, s]) =>
          `<tr><td>${g}</td><td>` +
          `${s.med != null ? `${pc(s.med)} <small>(${pc(s.q1)} à ${pc(s.q3)})</small>` : "–"}` +
          `</td><td>${s.n}</td></tr>`,
      )
      .join("") +
    `</tbody>`;
  const m = D.rapprochement;
  document.getElementById("energieMatch").innerHTML =
    `${m.apparie} ventes sur ${m.ventes}` +
    ` ont pu être rapprochées d'un DPE sans ambiguïté, dont ${m.par_lot} grâce à un ` +
    `numéro de lot commun (le critère le plus sûr). Pour les autres : même bâtiment et ` +
    `même entrée, DPE établi dans les deux ans avant la vente, surface proche. ${m.ambigu}` +
    ` ventes étaient ambiguës et ${m.aucun} sans DPE correspondant. ` +
    (cols.length === 1
      ? "Aucun bâtiment n'a assez de ventes par classe pour être détaillé : seul le total du " + "domaine est affiché. "
      : "") +
    ("Un prix plus bas pour une mauvaise étiquette peut aussi venir de l'étage, de l'état " +
      "du logement ou de l'année de la vente : ces écarts ne sont pas corrigés. Aucun " +
      "chiffre n'est affiché pour moins de 5 logements ou ventes.");
}

// --- ventes une à une
let showAllSales = false;
document.getElementById("salesMore").onclick = () => {
  showAllSales = !showAllSales;
  renderSales();
};
const SALES_COLS = [
  ["g", "Bâtiment"],
  ["e", "Entrée"],
  ["niv", "Galerie"],
  ["d", "Date"],
  ["s", "Surface"],
  ["p", "Pièces"],
  ["v", "Prix"],
  ["m2", "€/m²"],
  ["dep", "Dép."],
];
const salesSort = { key: "d", dir: -1 };
function renderSales() {
  const ss = trier(
    DATA.sales.filter(
      (s) =>
        st.sel.has(s.g) &&
        st.years.has(s.y) &&
        s.s >= st.smin &&
        s.s <= st.smax &&
        st.rooms.has(room(s.p)) &&
        (!s.niv || st.nivs.has(s.niv)),
    ),
    salesSort,
  );
  lastSales = ss;
  const shown = ss.filter((s) => !(st.noAty && s.aty)).length;
  document.getElementById("salesCount").textContent =
    `${shown} vente${shown > 1 ? "s" : ""} · cliquez un titre pour trier` +
    `${st.noAty && ss.length > shown ? " ; barrées : atypiques, écartées des calculs" : ""}`;
  const table = document.getElementById("sales");
  table.innerHTML = ss.length
    ? enteteTriable(SALES_COLS, salesSort) +
      `<tbody>` +
      (showAllSales ? ss : ss.slice(0, 30))
        .map(
          (s) =>
            `<tr class="${s.aty ? "aty" : ""}"><td>${esc(short(s.g))}</td><td>${s.e || "–"}</td>` +
            `<td>` +
            `${s.niv ? `<span class="tag">${s.niv.replace("Galerie ", "")}${s.md ? " · " + (s.md === "M" ? "mont." : "desc.") : ""}</span>` : ""}` +
            `</td><td>${dateFr(s.d)}</td><td>${s.s} m²</td><td>${s.p || "?"}` +
            `${s.typ ? " (" + s.typ + ")" : ""}</td><td>${eur(s.v)}</td><td>${fmt(s.m2)}</td><td>` +
            `${s.dep || ""}</td></tr>`,
        )
        .join("") +
      "</tbody>"
    : `<tr><td class="empty">Aucune vente avec ces réglages.</td></tr>`;
  brancherTri(table, salesSort, () => {
    renderSales();
    labelCells();
  });
  const more = document.getElementById("salesMore");
  more.hidden = ss.length <= 30;
  more.textContent = showAllSales ? "Réduire la liste" : `Afficher les ${ss.length} ventes`;
}

// --- export CSV (séparateur « ; », virgule décimale : s'ouvre directement dans Excel)
let lastSales = [];
function salesCsv() {
  const q = (v) => {
    const t = String(v ?? "");
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = [
    "Bâtiment",
    "Entrée",
    "Galerie",
    "Duplex",
    "Date",
    "Surface m²",
    "Pièces",
    "Type",
    "Prix €",
    "€/m²",
    "Dépendances",
    "Atypique",
  ];
  const rows = lastSales.map((s) => [
    B[s.g].label,
    s.e || "",
    s.niv || "",
    s.md === "M" ? "montant" : s.md === "D" ? "descendant" : "",
    s.d,
    s.s,
    s.p || "",
    s.typ || "",
    s.v,
    s.m2,
    s.dep,
    s.aty ? "oui" : "",
  ]);
  return [head, ...rows].map((r) => r.map(q).join(";")).join("\r\n");
}
const csvMsg = (t) => {
  const m = document.getElementById("csvMsg");
  m.textContent = t;
  m.hidden = false;
};
document.getElementById("csvDl").onclick = () => {
  try {
    const url = URL.createObjectURL(new Blob(["\ufeff" + salesCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventes-peupleraie-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    csvMsg(
      `${lastSales.length} ventes exportées. Si aucun fichier n'apparaît, utilisez « Copier ` +
        `» puis collez dans un tableur.`,
    );
  } catch (e) {
    csvMsg("Le téléchargement est bloqué ici : utilisez « Copier » puis collez dans un tableur.");
  }
};
document.getElementById("csvCopy").onclick = () => {
  const text = salesCsv();
  navigator.clipboard
    .writeText(text)
    .then(() => csvMsg(`${lastSales.length} ventes copiées : collez-les dans Excel ou un tableur.`))
    .catch(() => csvMsg("La copie automatique est refusée par ce navigateur."));
};

// Tableaux en fiches sur téléphone : chaque cellule connaît le titre de sa colonne
function labelCells() {
  document.querySelectorAll("table").forEach((table) => {
    const titres = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach((tr) => {
      [...tr.children].forEach((td, i) => (td.dataset.label = titres[i] || ""));
    });
  });
}

function update() {
  renderList();
  const G = groups();
  renderSettingsSum();
  renderMap();
  renderSummary(G);
  renderStrip(G);
  renderTable(G);
  renderBatA();
  renderTrend(G);
  renderFresnes();
  renderSales();
  save();
  document.getElementById("tabSalesN").textContent = G.sales.length;
  labelCells();
  document.querySelectorAll(".refchip").forEach((b) => b.setAttribute("aria-pressed", !!refOn[b.dataset.ref]));
  document.querySelectorAll("#spresets .chip").forEach((b) => {
    const [a, z] = b.dataset.r.split("-").map(Number);
    b.setAttribute("aria-pressed", a === st.smin && z === st.smax);
  });
}
// --- réglages : ouverts sur grand écran, repliés sur téléphone, avec un résumé de la sélection
const mq = matchMedia("(max-width: 880px)"),
  settings = document.getElementById("settings");
const fitSettings = () => {
  settings.open = !mq.matches;
};
fitSettings();
mq.addEventListener("change", fitSettings);
function renderSettingsSum() {
  const ys = YEARS.filter((y) => st.years.has(y)),
    n = st.sel.size;
  const yrs = ys.length === 0 ? "aucune année" : ys.length === YEARS.length ? "toutes les années" : ys.join(", ");
  const sf = st.smin <= 0 && st.smax >= 200 ? "toutes surfaces" : `${st.smin}–${st.smax} m²`;
  const pc =
    st.rooms.size === ROOMS.length
      ? "tous types"
      : [...st.rooms]
          .sort()
          .map((r) => (r === 5 ? "F5 et +" : "F" + r))
          .join(", ");
  document.getElementById("settingsSum").textContent = `${n} bâtiment${n > 1 ? "s" : ""} · ${yrs} · ${sf} · ${pc}`;
}

// --- estimer : fourchette de prix à partir des ventes comparables
const EST = { annees: 3, ecart: 0.15, minVentes: 4 };
const quantile = (tri, q) => {
  const i = (tri.length - 1) * q,
    k = Math.floor(i);
  return tri[k] + (tri[Math.min(k + 1, tri.length - 1)] - tri[k]) * (i - k);
};
const aMille = (n) => Math.round(n / 1000) * 1000;

// ventes comparables : même surface à ±15 %, hors ventes atypiques, sur les dernières années complètes
function comparables(bat, surface) {
  const complete = YEARS.filter((y) => DATA.coverage[y] >= 50),
    annees = complete.slice(-EST.annees);
  const proches = DATA.sales.filter(
    (s) => B[s.g].peupleraie && !s.aty && annees.includes(s.y) && Math.abs(s.s - surface) <= surface * EST.ecart,
  );
  const duBat = bat ? proches.filter((s) => s.g === bat) : proches;
  const elargi = duBat.length < EST.minVentes;
  return { ventes: elargi ? proches : duBat, elargi, annees };
}

function estimer(bat, surface) {
  const { ventes, elargi, annees } = comparables(bat, surface);
  if (ventes.length < EST.minVentes) return { n: ventes.length, ventes, elargi, annees };
  const tri = ventes.map((s) => s.m2).sort((a, b) => a - b),
    [q1, med, q3] = [0.25, 0.5, 0.75].map((q) => quantile(tri, q));
  return {
    n: ventes.length,
    ventes,
    elargi,
    annees,
    q1,
    med,
    q3,
    bas: aMille(q1 * surface),
    haut: aMille(q3 * surface),
  };
}

const EST_COLS = [
  ["d", "Date"],
  ["g", "Bâtiment"],
  ["s", "Surface"],
  ["v", "Prix"],
  ["m2", "€/m²"],
];
const estSort = { key: "d", dir: -1 };
function renderEstimer() {
  const bat = document.getElementById("estBat").value,
    surface = Number(document.getElementById("estSurf").value),
    verdict = document.getElementById("estVerdict"),
    table = document.getElementById("estTable"),
    note = document.getElementById("estNote");
  table.innerHTML = "";
  verdict.classList.remove("found");
  if (!(surface >= 9)) {
    verdict.textContent = "Choisissez un bâtiment et indiquez une surface en m² pour voir la fourchette.";
    note.textContent = "";
    return;
  }
  const r = estimer(bat, surface),
    de = r.annees[0],
    a = r.annees[r.annees.length - 1];
  if (r.n < EST.minVentes) {
    verdict.textContent = `Trop peu de ventes comparables (${r.n}) pour donner un repère fiable à cette surface.`;
    note.textContent = "";
    return;
  }
  verdict.classList.add("found");
  verdict.innerHTML =
    `Les appartements d'environ ${fmt(surface)} m² se sont vendus <b>entre ${eur(r.bas)} et ${eur(r.haut)}</b>` +
    ` (médiane ${eur(aMille(r.med * surface))}, soit ${fmt(r.med)} €/m²).` +
    (r.elargi ? " Comme ce bâtiment a trop peu de ventes, c'est calculé sur toute la résidence." : "");
  note.textContent =
    `Calculé sur ${r.n} ventes de ${de} à ${a}, surface à ±15 %, ventes atypiques écartées. La fourchette va du quart bas au quart haut des prix au m². ` +
    "C'est un repère, pas une estimation officielle : l'étage, l'état, les travaux et l'exposition ne sont pas pris en compte.";
  table.innerHTML =
    enteteTriable(EST_COLS, estSort) +
    "<tbody>" +
    trier(r.ventes, estSort)
      .map(
        (s) =>
          `<tr><td>${dateFr(s.d)}</td><td>${esc(short(s.g))}</td><td>${fmt(s.s)} m²</td><td>${eur(s.v)}</td><td>${fmt(s.m2)}</td></tr>`,
      )
      .join("") +
    "</tbody>";
  labelCells();
  brancherTri(table, estSort, renderEstimer);
}
{
  const sel = document.getElementById("estBat");
  sel.innerHTML =
    '<option value="">Toute la résidence</option>' +
    DATA.buildings
      .filter((b) => b.peupleraie)
      .map((b) => `<option value="${b.id}">${esc(b.label)}</option>`)
      .join("");
  sel.onchange = document.getElementById("estSurf").oninput = renderEstimer;
  renderEstimer();
}

renderEnergie();
update();
let largeurPrecedente = innerWidth,
  minuteur;
addEventListener("resize", () => {
  if (innerWidth === largeurPrecedente) return; // la barre d'adresse du mobile ne change que la hauteur
  largeurPrecedente = innerWidth;
  clearTimeout(minuteur);
  minuteur = setTimeout(update, 150);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
