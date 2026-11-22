/* BroForever — suivi T0 / T0.5 : accueil (nom + classe + faction), suivi, classement. Sauvegarde Supabase + navigateur. */
(function () {
"use strict";
const CFG = window.TIER_CONFIG, SETS = window.TIER_SETS, CHAIN = window.TIER_CHAIN;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ============ CONSTANTES ============ */
const CLASSES = {
  druid:   { fr: "Druide",    color: "#ff7d0a", armor: "Cuir" },
  hunter:  { fr: "Chasseur",  color: "#abd473", armor: "Mailles" },
  mage:    { fr: "Mage",      color: "#69ccf0", armor: "Tissu" },
  paladin: { fr: "Paladin",   color: "#f58cba", armor: "Plaques" },
  priest:  { fr: "Prêtre",    color: "#ffffff", armor: "Tissu" },
  rogue:   { fr: "Voleur",    color: "#fff569", armor: "Cuir" },
  shaman:  { fr: "Chaman",    color: "#2f8cff", armor: "Mailles" },
  warlock: { fr: "Démoniste", color: "#9482c9", armor: "Tissu" },
  warrior: { fr: "Guerrier",  color: "#c79c6e", armor: "Plaques" },
};
const FACTIONS = { horde: "Horde", alliance: "Alliance" };
const SLOT_FR = { head: "Tête", shoulder: "Épaules", chest: "Torse", wrist: "Poignets", hands: "Mains", waist: "Taille", legs: "Jambes", feet: "Pieds" };
const ORDER_T0 = ["head", "shoulder", "chest", "wrist", "hands", "waist", "legs", "feet"];
const ORDER_T05 = ["wrist", "hands", "waist", "feet", "legs", "shoulder", "head", "chest"];
const T0SRC = {
  head: "Scholomance — Sombre maître Gandling", shoulder: "Pic Blackrock — Gizrul le Asservisseur",
  chest: "Pic Blackrock — Général Drakkisath", wrist: "Scholomance / Stratholme — butin des mobs",
  hands: "Pic Blackrock (mobs) / Stratholme — Le Impardonné", waist: "Butin aléatoire — BRS, Scholomance",
  legs: "Stratholme — Baron Vivebise (Rivendare)", feet: "Pic Blackrock — Mère Fumetoile",
};
const T05STEP = { wrist: "q1", hands: "q8", waist: "q8", feet: "q17", legs: "q17", shoulder: "q17", head: "q29", chest: "q29" };
const T05QNAME = { q1: "Une proposition sérieuse", q8: "Une juste compensation", q17: "Les adieux d'Anthion", q29: "Garder le meilleur pour la fin" };
const MAX_POINTS = 8 + 8 + 29;

// Composants de classe de la chaîne (source : HardcoreHelper, à confirmer en jeu)
const COMP = {
  relic:   { loc: "Berceau-de-l'Hiver · géants Frostmaul", how: "géants Frostmaul, Berceau-de-l'Hiver" },
  remains: { loc: "Hive'Regal · silithides (SE de Silithus)", how: "silithides autour de Hive'Regal, SE de Silithus" },
  sword:   { loc: "Prétorien écarlate (lieu à confirmer)", how: "Prétorien écarlate (lieu à confirmer en jeu)" },
  ashes:   { loc: "Île de la Purgation · fantômes", how: "fantômes de l'île de la Purgation (côte de Hillsbrad)" },
};
const SPIRIT = {
  isalien: { n: "Isalien", d: "Dire Maul Est", alt: "Hache-Tripes Est" },
  mor:     { n: "Mor Grayhoof", d: "Pic Blackrock inférieur" },
  kormok:  { n: "Kormok", d: "Scholomance" },
  jarien:  { n: "Jarien et Sothos", d: "Stratholme" },
};
const PLAN = {
  druid:   [["relic", "isalien"], ["remains", "mor"]],
  hunter:  [["sword", "jarien"], ["ashes", "kormok"]],
  mage:    [["remains", "mor"], ["sword", "jarien"]],
  paladin: [["ashes", "kormok"], ["remains", "mor"]],
  priest:  [["ashes", "kormok"], ["sword", "jarien"]],
  rogue:   [["sword", "jarien"], ["relic", "isalien"]],
  shaman:  [["ashes", "kormok"], ["remains", "mor"]],
  warlock: [["relic", "isalien"], ["ashes", "kormok"]],
  warrior: [["remains", "mor"], ["relic", "isalien"]],
};
const SLOTWORD = { Brassards: "Poignets", Ceinture: "Taille", Gants: "Mains", Bottes: "Pieds", Kilt: "Jambes", "Epaulières": "Épaules", Capuche: "Tête", Veste: "Torse" };
// quêtes dont l'identifiant dépend de la classe ou de la faction : lien de recherche au lieu d'un identifiant
const NO_ID = ["q1", "q2", "q9", "q17", "q21", "q24", "q28"];

/* ============ STOCKAGE ============ */
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); } catch (_) {} },
};
const normName = n => String(n || "").trim().replace(/\s+/g, " ");
const nameKey = n => normName(n).toLowerCase();
const validName = n => { n = normName(n); return n.length >= 2 && n.length <= 24 && !/[<>&"{}\\]/.test(n); };
function newToken() {
  const a = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
}

/* ============ SUPABASE (RPC) ============ */
async function rpc(fn, args) {
  const r = await fetch(CFG.url + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: CFG.key, Authorization: "Bearer " + CFG.key, "Content-Type": "application/json" },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

/* ============ ÉTAT ============ */
let profile = null;   // { name, cls, faction }
let token = null;
let ctx = null;       // données adaptées à la classe / faction
let st = emptyState();
function emptyState() { return { t0: {}, t05: {}, q: {}, m: {}, c: {} }; }
const stateKey = () => "tier-state:" + nameKey(profile.name);

/* ============ DONNÉES ADAPTÉES ============ */
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

function adaptChain(p) {
  const Q = JSON.parse(JSON.stringify(CHAIN.Q)), M = JSON.parse(JSON.stringify(CHAIN.M));
  const comps = SETS.components, plan = PLAN[p.cls];
  const alliance = p.faction === "alliance";
  const bloodFr = comps.blood.fr;
  const fix = s => {
    if (typeof s !== "string") return s;
    s = s.replace(/(Brassards|Ceinture|Gants|Bottes|Kilt|Epaulières|Capuche|Veste) T0/g, (m, w) => SLOTWORD[w] + " T0");
    s = s.replace(/^Brassards \(étape 1\)/, "Poignets T0 (étape 1)");
    if (alliance) {
      s = s.replace("Début — Mokvar, Orgrimmar (près du Chef de guerre)", "Début — Deliana, Forgefer (Hauts-Sièges)")
           .replace(/Mokvar · Orgrimmar/g, "Deliana · Forgefer (Hauts-Sièges)")
           .replace("Retour à Mokvar", "Retour à Deliana")
           .replace(/Echantillons de venin de Silithus/g, bloodFr.replace("Echantillon", "Échantillons"))
           .replace(/Echantillon de venin de Silithus/g, bloodFr);
    }
    return s;
  };
  for (const ph of Q) {
    ph[0] = fix(ph[0]);
    for (const s of ph[1]) {
      s.n = fix(s.n); s.loc = fix(s.loc); s.req = fix(s.req);
      if (NO_ID.includes(s.id)) delete s.id2;
    }
  }
  const step = id => Q.flatMap(ph => ph[1]).find(s => s.id === id);
  const [c1, sp1] = plan[0], [c2, sp2] = plan[1];
  const spLoc = k => SPIRIT[k].d + " · esprit" + (k === "jarien" ? "s " : " ") + SPIRIT[k].n;
  step("q20").loc = COMP[c1].loc; step("q20").req = comps[c1].fr;
  step("q21").loc = spLoc(sp1);
  step("q23").loc = COMP[c2].loc; step("q23").req = comps[c2].fr;
  step("q24").loc = spLoc(sp2);
  for (const g of M) {
    if (g[0] === "Silithus & ectoplasmes" && alliance) g[1][0][0] = bloodFr;
    for (const row of g[1]) {
      row[0] = fix(row[0]);
      if (row[3] === "q20") row[0] = comps[c1].fr;
      if (row[3] === "q23") row[0] = comps[c2].fr;
    }
  }
  return { Q, M, parts: [[c1, sp1], [c2, sp2]] };
}

function buildCtx(p) {
  const set = SETS.classes[p.cls];
  const T0 = ORDER_T0.map(s => { const it = set.t0.items[s]; return { id: s, s: SLOT_FR[s], n: it.fr, fr: it.en, i: it.ilvl, src: T0SRC[s], wh: it.id }; });
  const T05 = ORDER_T05.map(s => {
    const it = set.t05.items[s], step = T05STEP[s];
    return { id: s, s: SLOT_FR[s], n: it.fr, fr: it.en, i: it.ilvl, q: it.q >= 4 ? "epic" : "rare", step, wh: it.id,
      src: step === "q1" ? "Quête « " + T05QNAME[step] + " » (étape 1)" : "Quête « " + T05QNAME[step] + " » (rend " + SLOT_FR[s].toLowerCase() + " T0)" };
  });
  const chain = adaptChain(p);
  const WH0 = {}, WH5 = {};
  T0.forEach(x => WH0[x.id] = x.wh); T05.forEach(x => WH5[x.id] = x.wh);
  const range = (list, k) => { const v = list.map(x => x[k]); return Math.min(...v) + "–" + Math.max(...v); };
  return { set, T0, T05, WH0, WH5, Q: chain.Q, M: chain.M, parts: chain.parts,
    nQ: chain.Q.reduce((a, ph) => a + ph[1].length, 0),
    ilvl0: range(Object.values(set.t0.items), "ilvl"), req0: range(Object.values(set.t0.items), "req"),
    ilvl5: range(Object.values(set.t05.items), "ilvl") };
}

/* ============ LIENS WOWHEAD ============ */
const WHB = "https://www.wowhead.com/classic/fr/";
const aItem = (id, t) => `<a href="${WHB}item=${id}" target="_blank" rel="noopener">${t}</a>`;
const aQuest = (id, t) => `<a href="${WHB}quest=${id}" target="_blank" rel="noopener">${t}</a>`;
const aSearch = (q, t) => `<a class="srch" href="${WHB}search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener" title="Rechercher sur Wowhead">${t}</a>`;
const ITEMS = [
  [/[ÉE]chantillons? de venin de Silithus/, 22381], [/[ÉE]chantillons? de sang de Berceau-de-l'Hiver/, 21928],
  [/Convertisseur d'arcanite délicat/, 16006], [/Essence éternelle supérieure/, 16203],
  [/Huile de pierre-écaille/, 13423], [/Cendre volcanique/, 22338], [/Ectoplasme brûlé/, 21937], [/Ectoplasme glacé/, 21936], [/Ectoplasme stable/, 21935],
  [/Coeur de magma/, 21938], [/Bâtonnet élémentaire de corruption/, 21939], [/Révélateur de fantômes/, 22115], [/Barres? de sombrefer/, 11371],
  [/Cuir enchanté/, 12810], [/Etoffe lunaire/, 14342], [/(Cuirs?|Peaux?) robustes? (traités?|traitées?)/, 15407], [/Perles? de guerre ogre/, 21982],
  [/Essence de spectre railleur/, 22224], [/Runes? (sombres?|ténébreuses?)/, 20520], [/Grands? éclats? brillants?/, 14344], [/Varech de sang/, 22094],
  [/Brassards blackrock/, 22138], [/Flacon de pouvoir suprême/, 13512], [/Relique de Brise-stellaire/, 22227], [/Restes druidiques/, 22226],
  [/Epée brillante de fanatisme/, 22228], [/Cendres d'âme de banni/, 22229],
  [/Incendicite d'Incendius/, 21987], [/Braise du prophète ardent/, 21988], [/Brasero béni/, 22014], [/Brasero d'invocation/, 22057],
  [/Bannière de provocation/, 21986], [/Médaillon d'Ysida/, 22139],
];
const SLOT_BY_LABEL = { Poignets: "wrist", Taille: "waist", Mains: "hands", Pieds: "feet", Jambes: "legs", "Épaules": "shoulder", "Tête": "head", Torse: "chest" };
function linkify(txt) {
  let out = txt;
  ITEMS.forEach(([re, id]) => { out = out.replace(re, m => `\u0001${id}\u0002${m}\u0003`); });
  out = out.replace(/(Poignets|Taille|Mains|Pieds|Jambes|Épaules|Tête|Torse) T0/g, (m, w) => aItem(ctx.WH0[SLOT_BY_LABEL[w]], m));
  return out.replace(/\u0001(\d+)\u0002(.*?)\u0003/g, (_, id, t) => aItem(id, t));
}
const bonusHTML = (list, n) => list.map(b => `<div class="bon ${n >= b[0] ? "act" : ""}"><b>(${b[0]})</b><span>${esc(b[1])}</span></div>`).join("");

/* ============ RENDU ============ */
function renderHeader() {
  const c = CLASSES[profile.cls], [r, g, b] = hexRgb(c.color);
  const root = document.documentElement.style;
  root.setProperty("--accent", c.color);
  root.setProperty("--accent-glow", `rgba(${r},${g},${b},.35)`);
  root.setProperty("--accent-soft", `rgba(${r},${g},${b},.16)`);
  $("heroName").textContent = profile.name;
  $("heroSub").innerHTML = `<b>${c.fr}</b> · ${FACTIONS[profile.faction]} · ❮BroForever❯ · WoW Forever EU`;
  $("heroSets").innerHTML = `Suivi de progression des sets <b style="color:var(--gold)">T0</b> (${esc(ctx.set.t0.name)}) et <b style="color:var(--gold)">T0.5</b> (${esc(ctx.set.t05.name)})`;
  $("tabT0").textContent = "T0 · " + ctx.set.t0.name;
  $("tabT05").textContent = "T0.5 · " + ctx.set.t05.name;
  $("t0title").textContent = "Set de donjon 1 — " + ctx.set.t0.name;
  $("t05title").textContent = "Set de donjon 2 — " + ctx.set.t05.name;
  $("qtitle").textContent = "Chaîne Dungeon Set 2 — " + FACTIONS[profile.faction];
  document.title = profile.name + " — Suivi T0 / T0.5";
  $("t0info").innerHTML = `<div class="chk info">${c.armor} · rare · niveau d'objet ${ctx.ilvl0} · niveau requis ${ctx.req0}.</div>
    <div class="chk info">Les pièces <b>T0</b> sont le prérequis de la quête T0.5 : elles sont rendues (échangées) contre les pièces <b>${esc(ctx.set.t05.name)}</b>.</div>
    <div class="chk warn">Les données Forever datent de datamining : les bonus de set peuvent être revus par rapport au Classic.</div>`;
  $("t05info").innerHTML = `<div class="chk info">Lié quand ramassé · niveau d'objet ${ctx.ilvl5} · niveau requis 58.</div>
    <div class="chk warn"><b>Quelle pièce T0 rendre ?</b> Un emplacement T0 = un emplacement T0.5. Coche d'abord la pièce T0 correspondante avant la quête qui la consomme (voir l'onglet quêtes).</div>
    <div class="chk warn">Des guides parlent de versions par rôle pour certaines classes ; vérifie en jeu la version proposée avant de valider la quête.</div>`;
  const comps = SETS.components;
  $("compTitle").textContent = "Composants " + c.fr;
  $("compBox").innerHTML = ctx.parts.map(([ck, sk], i) => `<div class="chk info"><b>${i + 1}${i ? "e" : "er"} composant :</b> ${linkify(comps[ck].fr)} — ${COMP[ck].how} → esprit <b>${SPIRIT[sk].n}</b> (${SPIRIT[sk].d}${SPIRIT[sk].alt ? " / " + SPIRIT[sk].alt : ""}).</div>`).join("") +
    `<div class="chk warn">Composants et esprits par classe : une seule source (HardcoreHelper), à confirmer en jeu.</div>`;
  const dung = ["Stratholme", "Dire Maul", "Profondeurs de Blackrock", "Pic Blackrock (BRS, 10 joueurs en Forever)", "Haut du Pic (Valthalak)"];
  ctx.parts.forEach(([, sk]) => { const d = SPIRIT[sk].d.replace(" Est", "").replace(" inférieur", ""); if (!dung.some(x => x.startsWith(d.split(" ")[0]))) dung.push(d); });
  const kormok = ctx.parts.some(([, sk]) => sk === "kormok");
  $("dungBox").innerHTML = `<div class="chk info">${dung.join(" · ")}.</div>` + (kormok
    ? `<div class="chk info">Scholomance est <b>requise</b> pour ce personnage (esprit Kormok).</div>`
    : `<div class="chk info">Scholomance n'est <b>pas</b> requise pour ce personnage (esprit Kormok non utilisé), mais elle fait tomber des pièces T0.</div>`);
  const mokvar = profile.faction === "horde" ? "Mokvar (Orgrimmar)" : "Deliana (Forgefer)";
  $("checkBox").innerHTML = `<div class="chk warn">Niveau : 58 minimum, 60 conseillé. La chaîne démarre chez ${mokvar}.</div>
    <div class="chk warn">Or total : 60 selon un guide, ~100 selon un autre (baguette de Vi'el ≈ 40 po).</div>
    <div class="chk warn">3e seigneur du feu (Trois rois de flamme) : Exécuteur Asharell (Steppes ardentes) <i>ou</i> Cendre de Cynders (Silithus) — sources contradictoires.</div>
    <div class="chk warn">Source des données : guides pré-sortie basés sur Wowhead Forever (nov. 2026). Peut changer.</div>`;
  $("foot").innerHTML = `Suivi T0 / T0.5 ${c.fr} ${FACTIONS[profile.faction]} · Sources :
    <a target="_blank" rel="noopener" href="https://www.zockify.com/forever/${profile.cls}/sets/">Zockify</a> ·
    <a target="_blank" rel="noopener" href="https://www.hardcorehelper.com/forever/guides/wow-forever-tier-0-5-dungeon-set-2">HardcoreHelper</a> ·
    <a target="_blank" rel="noopener" href="https://leprestore.com/guides/world-of-warcraft-forever/wow-forever-tier-0-5-upgrade-guide-dungeon-set-2/">Leprestore</a> ·
    <a target="_blank" rel="noopener" href="https://www.wowhead.com/forever">Wowhead Forever</a><br>Données de sortie pré-release : peuvent changer. Les noms français sont ceux de Wowhead Forever (fr).`;
  $("saveInfo").textContent = "Ta progression est enregistrée dans ce navigateur et synchronisée avec le classement de la guilde (seuls le nom, la classe, la faction et la progression sont envoyés).";
}

function render() {
  const { T0, T05, Q, M } = ctx;
  const c0 = T0.filter(p => st.t0[p.id]).length;
  $("t0list").innerHTML = T0.map(p => `<div class="piece ${st.t0[p.id] ? "done" : ""}" data-k="t0" data-id="${p.id}" style="--q:#0070dd">
    <div class="box">✓</div><div class="slot">${p.s}</div><div class="pi"><div class="pn">${aItem(p.wh, esc(p.n))}</div><div class="pm">${esc(p.fr)} · <b>${p.src}</b></div></div><div class="il">${p.i}</div></div>`).join("");
  $("t0sum").textContent = c0 + " / 8 pièces"; $("t0bon").innerHTML = bonusHTML(ctx.set.t0.bonuses, c0); $("hT0").textContent = c0 + "/8";

  const c5 = T05.filter(p => st.t05[p.id]).length;
  const allSteps = Q.flatMap(x => x[1]);
  $("t05list").innerHTML = T05.map(p => `<div class="piece ${st.t05[p.id] ? "done" : ""}" data-k="t05" data-id="${p.id}" style="--q:${p.q === "epic" ? "#a335ee" : "#0070dd"}">
    <div class="box">✓</div><div class="slot">${p.s}</div><div class="pi"><div class="pn">${aItem(p.wh, esc(p.n))}</div><div class="pm">${esc(p.fr)} · <b>${p.src.replace(/« ([^»]+) »/, (m, n) => { const q = allSteps.find(s => s.n === n.trim()); return q && q.id2 ? "« " + aQuest(parseInt(q.id2), n) + " »" : m; })}</b></div></div><div class="il">${p.i}</div></div>`).join("");
  $("t05sum").textContent = c5 + " / 8 pièces"; $("t05bon").innerHTML = bonusHTML(ctx.set.t05.bonuses, c5); $("hT05").textContent = c5 + "/8";

  const nQ = ctx.nQ, cq = Object.values(st.q).filter(Boolean).length;
  $("qsum").textContent = cq + " / " + nQ + " étapes"; $("hQ").textContent = Math.round(cq / nQ * 100) + "%";
  $("qlist").innerHTML = `<div class="bar ${cq === nQ ? "ok" : ""}" style="margin-bottom:6px"><i style="width:${cq / nQ * 100}%"></i></div>` + Q.map(ph => {
    const d = ph[1].filter(s => st.q[s.id]).length;
    return `<div class="phase"><span>${ph[0]}</span><span>${d}/${ph[1].length}</span></div>` + ph[1].map(s => {
      const need = (s.c || []).filter(k => !st.t0[k]);
      const consume = (s.c || []).length ? `<div class="note">⚠ Consomme : ${s.c.map(k => T0.find(p => p.id === k).s).join(", ")}${need.length && !st.q[s.id] ? ` — T0 manquant : ${need.map(k => T0.find(p => p.id === k).s).join(", ")}` : ""}</div>` : "";
      return `<div class="step ${st.q[s.id] ? "done" : ""}" data-k="q" data-id="${s.id}"><div class="box">✓</div><div>
        <div class="sn">${s.id2 ? aQuest(parseInt(s.id2), s.n) : aSearch(s.n + " quest", s.n)}<em>${s.id2 ? "#" + s.id2 + " · " : ""}${s.id.replace("q", "étape ")}</em></div>
        <div class="sd"><span class="loc">${s.loc}</span><br><span class="req">${linkify(s.req)}</span></div>${consume}</div></div>`;
    }).join("");
  }).join("");

  const comps = SETS.components;
  const HINT = {
    "Convertisseur d'arcanite délicat": "Fabriqué par ingénierie (ou Hôtel des ventes)", "Essence éternelle supérieure": "Enchantement (ou Hôtel des ventes)",
    "Huile de pierre-écaille": "Alchimie (ou Hôtel des ventes)", "Cendre volcanique": "Se ramasse dans les Steppes ardentes / Silithus (tas de cendre)",
    "Barre de sombrefer": "Forge (ou Hôtel des ventes)", "Cuir enchanté": "Travail du cuir (ou Hôtel des ventes)", "Etoffe lunaire": "Couture (ou Hôtel des ventes)",
    "Peau robuste traitée": "Travail du cuir (ou Hôtel des ventes)", "Perle de guerre ogre": "Ogres de Dire Maul ou du Pic Blackrock",
    "Essence de spectre railleur": "Butin des spectres à Stratholme / Maleterres", "Rune ténébreuse": "Butin des mobs humanoïdes / Hôtel des ventes",
    "Grand éclat brillant": "Désenchantement d'objets rares", "Varech de sang": "Île d'Alcaz (Marécage d'Âprefange)",
    "Brassards blackrock": "Butin du Pic Blackrock (orcs / ogres)", "Flacon de pouvoir suprême": "Alchimie (ou Hôtel des ventes)",
    "Coeur de magma (Bokk)": "Seigneur du magma Bokk, Steppes ardentes",
    "Echantillon de venin de Silithus": "Butin des mobs de Silithus (scorpions / guêpes)",
  };
  HINT[comps.blood.fr] = "Butin des ours et sabres-de-givre de Berceau-de-l'Hiver";
  ctx.parts.forEach(([ck]) => { HINT[comps[ck].fr] = COMP[ck].how; });
  const steps = Q.flatMap(p => p[1]), goldRows = [], byStep = {};
  M.forEach(g => g[1].forEach(m => { (byStep[m[3]] = byStep[m[3]] || []).push(m); }));
  let tot = 0, have = 0, goldLeft = 0;
  $("mlist").innerHTML = steps.filter(s => byStep[s.id]).map(s => {
    const done = !!st.q[s.id], rows = byStep[s.id];
    const items = rows.filter(m => m[2] !== "po"), golds = rows.filter(m => m[2] === "po");
    golds.forEach(m => { const pd = done || !!st.c[m[0]]; goldRows.push([m[0], m[1], s, pd, m[0].includes("non confirmé")]); if (!pd) goldLeft += m[1]; });
    items.forEach(m => { tot++; if (done || st.c[m[0]] || (st.m[m[0]] || 0) >= m[1]) have++; });
    return `<div class="mstep ${done ? "mdone" : ""}"><div class="mhead">${s.id2 ? aQuest(parseInt(s.id2), s.n) : aSearch(s.n + " quest", s.n)}<span>${done ? "✓ quête terminée" : s.loc}</span></div>` +
      items.map(m => {
        const key = m[0], h = st.m[key] || 0, ck = !!st.c[key], full = done || ck || h >= m[1];
        const nm = linkify(m[0]) !== m[0] ? linkify(m[0]) : aSearch(m[0], m[0]);
        return `<div class="mat ${full ? "full" : ""}" data-k="c" data-id="${esc(key)}"><div class="box">✓</div><div class="mn">${nm}<small>${HINT[key] || ""}</small></div>
        <div class="have">${done ? "<b>✓</b>" : `J'en ai <input type="number" min="0" value="${h}" data-m="${esc(key)}">`}<span class="need">sur <b>${m[1]}</b></span></div></div>`;
      }).join("") +
      golds.map(m => `<div class="mat ${done || st.c[m[0]] ? "full" : ""}" data-k="c" data-id="${esc(m[0])}"><div class="box">✓</div><div class="mn">💰 ${m[0].replace(" (non confirmé)", "")}<small>Or à payer${m[0].includes("non confirmé") ? " — à confirmer en jeu" : ""}</small></div><div class="have">${done || st.c[m[0]] ? "<b>✓ payé</b>" : "<b class='gp'>" + m[1] + " po</b>"}</div></div>`).join("") + `</div>`;
  }).join("");
  $("msum").textContent = have + " / " + tot + " objets rassemblés";
  const sure = goldRows.filter(r => !r[4] && !r[3]).reduce((a, r) => a + r[1], 0), maybe = goldRows.filter(r => r[4] && !r[3]).reduce((a, r) => a + r[1], 0);
  $("gold").innerHTML = `<div class="chk info">Pour finir la chaîne, prévois <b>${sure} po</b> (sûr)${maybe ? ` + <b>${maybe} po</b> peut-être (baguette de Vi'el)` : ""}.</div>` +
    goldRows.map(r => `<div class="mat ${r[3] ? "full" : ""}"><div class="mn">${r[0].replace(" (non confirmé)", "")}<small>${r[2].n}</small></div><div class="have"><b class="gp">${r[3] ? "✓" : r[1] + " po"}</b></div></div>`).join("");

  scheduleSave();
  try { window.$WowheadPower && $WowheadPower.refreshLinks(); } catch (_) {}
}

/* ============ SYNCHRONISATION ============ */
let saveTimer = null, dirty = false, syncMsg = "";
function setSync(kind, msg) {
  const b = $("syncBadge");
  b.className = "sync " + (kind === "ok" ? "ok" : kind === "off" ? "off" : "");
  b.textContent = kind === "ok" ? "☁ synchronisé" : kind === "off" ? "⚠ " + (msg || "hors ligne") + " — sauvegarde locale" : "… envoi";
}
function scheduleSave() {
  if (!profile) return;
  ls.set(stateKey(), JSON.stringify(st));
  dirty = true; setSync("...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 900);
}
async function flush() {
  if (!profile || !dirty) return;
  try {
    const r = await rpc("tier_save", { p_name: profile.name, p_class: profile.cls, p_faction: profile.faction, p_state: st, p_token: token });
    if (r && r.ok) { dirty = false; setSync("ok"); }
    else if (r && r.error === "owned") setSync("off", "nom déjà utilisé par un autre appareil");
    else setSync("off", "refusé (" + (r && r.error) + ")");
  } catch (e) { setSync("off", "hors ligne"); }
}
setInterval(() => { if (dirty) flush(); }, 30000);
window.addEventListener("online", flush);
document.addEventListener("visibilitychange", () => { if (document.hidden && dirty) flush(); });

/* ============ CLASSEMENT ============ */
function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "à l'instant"; if (s < 3600) return Math.round(s / 60) + " min";
  if (s < 86400) return Math.round(s / 3600) + " h"; return Math.round(s / 86400) + " j";
}
async function loadRanking(box) {
  box.innerHTML = '<div class="chk info">Chargement du classement…</div>';
  let rows;
  try { rows = await rpc("tier_ranking", {}); } catch (e) { box.innerHTML = '<div class="chk warn">Classement indisponible pour le moment (connexion).</div>'; return; }
  const draw = () => {
    const fc = box.querySelector(".f-cls").value, ff = box.querySelector(".f-fac").value;
    const list = rows.filter(r => (!fc || r.class === fc) && (!ff || r.faction === ff));
    const me = profile ? nameKey(profile.name) : null;
    box.querySelector(".rk-body").innerHTML = list.length ? list.map((r, i) => {
      const c = CLASSES[r.class] || { fr: r.class, color: "#999" }, pct = Math.round(r.score / MAX_POINTS * 100);
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
      return `<tr class="${me && nameKey(r.name) === me ? "me" : ""}"><td class="pos">${medal}</td><td class="nm" style="color:${c.color}">${esc(r.name)}</td>
        <td class="hide-s">${c.fr}</td><td class="hide-s ${r.faction === "horde" ? "fac-h" : "fac-a"}">${FACTIONS[r.faction] || r.faction}</td>
        <td class="num">${r.t0}/8</td><td class="num">${r.t05}/8</td><td class="num hide-s">${r.quests}/29</td>
        <td class="pct"><b>${pct}%</b><div class="bar ${pct === 100 ? "ok" : ""}"><i style="width:${pct}%"></i></div></td><td class="when hide-s">${ago(r.updated_at)}</td></tr>`;
    }).join("") : `<tr><td colspan="9" style="color:var(--dim);padding:18px">Personne dans ce filtre pour l'instant.</td></tr>`;
  };
  box.innerHTML = `<div class="rank-tools">
      <select class="f-cls"><option value="">Toutes les classes</option>${Object.entries(CLASSES).map(([k, c]) => `<option value="${k}">${c.fr}</option>`).join("")}</select>
      <select class="f-fac"><option value="">Les deux factions</option><option value="horde">Horde</option><option value="alliance">Alliance</option></select>
      <button class="linkbtn rk-refresh">↻ Actualiser</button><span style="color:var(--dim);font-size:12px">${rows.length} personnage(s) · avancement = pièces T0 + pièces T0.5 + étapes de quête (sur ${MAX_POINTS})</span></div>
    <div style="overflow-x:auto"><table class="rank"><thead><tr><th>#</th><th>Personnage</th><th class="hide-s">Classe</th><th class="hide-s">Faction</th><th>T0</th><th>T0.5</th><th class="hide-s">Quêtes</th><th>Avancement</th><th class="hide-s">Mis à jour</th></tr></thead><tbody class="rk-body"></tbody></table></div>`;
  box.querySelector(".f-cls").onchange = draw; box.querySelector(".f-fac").onchange = draw;
  box.querySelector(".rk-refresh").onclick = () => loadRanking(box);
  draw();
}

/* ============ ÉCRANS ============ */
function show(which) {
  $("screen-login").hidden = which !== "login";
  $("screen-rank").hidden = which !== "rank";
  $("screen-app").hidden = which !== "app";
}

let pick = { cls: null, faction: null };
function buildLogin() {
  $("clsChoices").innerHTML = Object.entries(CLASSES).map(([k, c]) => `<button type="button" class="choice" data-cls="${k}" style="--c:${c.color}"><span class="dot"></span>${c.fr}</button>`).join("");
  $("facChoices").innerHTML = Object.entries(FACTIONS).map(([k, f]) => `<button type="button" class="choice ${k}" data-fac="${k}"><span class="dot"></span>${f}</button>`).join("");
  const upd = () => {
    document.querySelectorAll("#clsChoices .choice").forEach(b => b.classList.toggle("on", b.dataset.cls === pick.cls));
    document.querySelectorAll("#facChoices .choice").forEach(b => b.classList.toggle("on", b.dataset.fac === pick.faction));
    $("goBtn").disabled = !(validName($("inName").value) && pick.cls && pick.faction);
  };
  $("clsChoices").onclick = e => { const b = e.target.closest("[data-cls]"); if (b) { pick.cls = b.dataset.cls; upd(); } };
  $("facChoices").onclick = e => { const b = e.target.closest("[data-fac]"); if (b) { pick.faction = b.dataset.fac; upd(); } };
  $("inName").addEventListener("input", () => { $("loginErr").textContent = ""; $("ownedBox").hidden = true; upd(); });
  $("inName").addEventListener("keydown", e => { if (e.key === "Enter" && !$("goBtn").disabled) $("goBtn").click(); });
  $("goBtn").onclick = () => startSession(normName($("inName").value), pick.cls, pick.faction);
  $("seeRank").onclick = () => { show("rank"); loadRanking($("rankBoxAlone")); };
  $("backLogin").onclick = () => show("login");
  $("codeBtn").onclick = async () => {
    const name = normName($("inName").value), code = $("inCode").value.trim();
    if (code.length < 16) { $("loginErr").textContent = "Code invalide."; return; }
    try {
      const info = await rpc("tier_load", { p_name: name, p_token: code });
      if (info && info.owned) { ls.set("tier-token:" + nameKey(name), code); ls.del("tier-state:" + nameKey(name)); $("ownedBox").hidden = true; startSession(name, pick.cls, pick.faction); }
      else $("loginErr").textContent = "Ce code ne correspond pas à ce personnage.";
    } catch (e) { $("loginErr").textContent = "Connexion impossible, réessaie."; }
  };
  upd();
}

async function startSession(name, cls, faction) {
  $("loginErr").textContent = ""; $("goBtn").disabled = true;
  const key = nameKey(name);
  let tk = ls.get("tier-token:" + key) || newToken();
  let info = null, offline = false;
  try { info = await rpc("tier_load", { p_name: name, p_token: tk }); } catch (e) { offline = true; }
  $("goBtn").disabled = false;
  if (info && info.exists && !info.owned) {
    $("loginErr").textContent = "Ce nom de personnage est déjà utilisé.";
    $("ownedBox").hidden = false;
    return;
  }
  ls.set("tier-token:" + key, tk);
  token = tk;
  profile = { name: info && info.exists ? info.name : name, cls, faction };
  ls.set("tier-profile", JSON.stringify(profile));
  let local = null;
  try { local = JSON.parse(ls.get("tier-state:" + key) || "null"); } catch (_) {}
  st = Object.assign(emptyState(), local || (info && info.exists && info.state) || {});
  dirty = true;
  enterApp();
  if (offline) setSync("off", "hors ligne");
}

function enterApp() {
  ctx = buildCtx(profile);
  renderHeader();
  show("app");
  render();
  flush();
  try { const t = ls.get("tier-tab"); const b = t && document.querySelector(`#tabs button[data-v="${t}"]`); if (b) b.click(); } catch (_) {}
}

/* ============ ÉVÉNEMENTS ============ */
document.addEventListener("click", e => {
  if (!profile || $("screen-app").hidden) return;
  if (e.target.closest("a,input,button")) return;
  const el = e.target.closest("[data-k]"); if (!el) return;
  const k = el.dataset.k, id = el.dataset.id; st[k][id] = !st[k][id];
  if (k === "q") ctx.T05.filter(p => p.step === id).forEach(p => { st.t05[p.id] = st.q[id]; });
  render();
});
document.addEventListener("input", e => {
  if (e.target.dataset && e.target.dataset.m !== undefined) {
    st.m[e.target.dataset.m] = +e.target.value || 0; scheduleSave();
    const row = e.target.closest(".mat"), need = parseInt(row.querySelector(".need").textContent.replace(/[^0-9]/g, ""), 10);
    row.classList.toggle("full", (+e.target.value || 0) >= need);
  }
});
$("tabs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll("#screen-app .view").forEach(v => v.classList.toggle("on", v.id === "v-" + b.dataset.v));
  ls.set("tier-tab", b.dataset.v);
  if (b.dataset.v === "rank") loadRanking($("rankBox"));
});
$("qall").onclick = () => { ctx.Q.flatMap(p => p[1]).forEach(s => { st.q[s.id] = true; ctx.T05.filter(p => p.step === s.id).forEach(p => st.t05[p.id] = true); }); render(); };
$("qnone").onclick = () => { st.q = {}; render(); };
$("rst").onclick = () => { if (confirm("Tout réinitialiser ?")) { st = emptyState(); render(); } };
$("exp").onclick = () => { prompt("Copie ce texte pour sauvegarder :", JSON.stringify(st)); };
$("imp").onclick = () => { const t = prompt("Colle ta sauvegarde :"); if (t) { try { st = Object.assign(emptyState(), JSON.parse(t)); render(); } catch (_) { alert("Sauvegarde invalide"); } } };
$("showCode").onclick = () => {
  const box = $("codeBox"); box.hidden = false;
  box.innerHTML = `Code de récupération (garde-le pour retrouver ton personnage sur un autre navigateur ; ne le partage pas) :<br><b style="user-select:all;word-break:break-all">${esc(token)}</b>`;
};
$("delChar").onclick = async () => {
  if (!confirm("Supprimer " + profile.name + " du classement et de ce navigateur ? Cette action est définitive.")) return;
  try { await rpc("tier_delete", { p_name: profile.name, p_token: token }); } catch (_) { alert("Suppression impossible (connexion). Réessaie."); return; }
  const key = nameKey(profile.name); ls.del("tier-state:" + key); ls.del("tier-token:" + key); ls.del("tier-profile");
  profile = null; dirty = false; show("login");
};
$("switchBtn").onclick = () => { if (dirty) flush(); ls.del("tier-profile"); profile = null; document.title = "BroForever — Suivi T0 / T0.5"; show("login"); };

/* ============ DÉMARRAGE ============ */
buildLogin();
(function boot() {
  let p = null;
  try { p = JSON.parse(ls.get("tier-profile") || "null"); } catch (_) {}
  if (p && p.name && SETS.classes[p.cls] && FACTIONS[p.faction]) {
    profile = p; token = ls.get("tier-token:" + nameKey(p.name));
    let local = null; try { local = JSON.parse(ls.get("tier-state:" + nameKey(p.name)) || "null"); } catch (_) {}
    st = Object.assign(emptyState(), local || {});
    if (token) { enterApp(); return; }
    profile = null;
  }
  show("login");
})();
})();
