/* Entropia Archive items: node render-items.js [folder] draws data/<category>.json into <folder>/items/index.html
   (default: _out beside this file), beside items.js, items.css, sources.json and the data files. Every item is in the
   page, so it reads in full without JavaScript; items.js only filters it and picks each value for a chosen VU. A
   mistake in the data stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");
const {context, esc, load: loadJSON} = require("./provenance");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "items");
const APP = /<div id="app"><\/div>/;
const FILES = /<!--files-->/;
// The page's categories in the order it shows them; each is data/<key>.json.
const CATEGORIES = ["weapons", "armor", "attachments", "tools", "clothing", "housing", "blueprints", "components",
  "materials", "resources", "misc"];
const DAY = /^\d{4}-\d\d-\d\d$/;
const ID = /^[a-z0-9-]+$/;

const read = (file) => fs.readFileSync(file, "utf8");

function stop(message) {
  console.error(message);
  process.exit(1);
}

const load = (file) => loadJSON(file, stop);
const problems = [];
const P = context(SITE, stop, problems);
const {VUS, RANK, vuOn, sources, captures, captureDay, citationVus, widest} = P;
const reasons = (sources.owner && sources.owner.reasons) || {};
// Each picture is described once in icons.json; an item names the file. A picture drawn in an armour set's colours
// names the set as its look and the VU it shows; the colours are the set's own in sets.json for that VU, which the
// page does not show. A VU is one of versions.json's, or blank for a set 5.4 does not list.
const lookVu = (vu) => vu === "" || RANK.has(vu);
const pictures = load(path.join(ROOT, "icons.json"));
const sets = load(path.join(ROOT, "sets.json")).sets || {};
const ICON_FILE = /^[a-z0-9-]+_(reconstructed_\d{4}|client_[0-9.]+)\.png$/;
for (const [file, picture] of Object.entries(pictures.icons || {})) {
  // An icon's file name says what it is: <name>_client_<key>.png, a picture a client stores, or
  // <name>_reconstructed_<year>.png, one drawn since, so a drawing is never taken for the game's own.
  if (!ICON_FILE.test(file) || !fs.existsSync(path.join(ROOT, "icons", file))) problems.push(`icons.json: ${file} is not a PNG in icons/ named <name>_client_<key>.png or <name>_reconstructed_<year>.png`);
  if (!sources[picture.source]) problems.push(`icons.json: ${file}'s source ${JSON.stringify(picture.source)} is not in sources.json`);
  if (picture.look !== undefined && !((sets[picture.look] || {}).colours || []).some((c) => c.vu === picture.vu)) {
    problems.push(`icons.json: ${file}'s look ${JSON.stringify(picture.look)} has no colours in sets.json for VU ${JSON.stringify(picture.vu)}`);
  }
}
// The Archive's own words carry no en or em dash; what a source says is quoted as it wrote it, dashes and all.
if (/[–—]/.test(JSON.stringify(pictures))) problems.push("icons.json uses an en or em dash");
const iconFile = (icon) => (typeof icon === "string" ? icon : icon && icon.file);
// A dated sighting keeps its own day only where it is not its capture's.
const seenDays = (x) => [x.first || (x.first_capture && captureDay(x.first_capture)), x.last || (x.last_capture && captureDay(x.last_capture))];

// Armour sets (sets.json): the stats every piece of a set has alike, kept once, and the set's pieces. A set's colours,
// the colour each channel of its armour's mask was painted for the icons and why, are checked here and not shown.
const pieceSet = new Map();
for (const [key, set] of Object.entries(sets)) {
  const at = `sets.json, set ${key}`;
  if (!ID.test(key) || typeof set.name !== "string" || !set.name) problems.push(`${at}: a set needs an id and a name`);
  P.checkStats(set.stats, "sets", at);
  if (!Object.keys(set.stats || {}).length && !set.colours) problems.push(`${at}: nothing about it has a source`);
  if (set.colours && (!Array.isArray(set.colours) || set.colours.some((c) => !lookVu(c.vu)
      || !["red", "green", "blue"].every((k) => /^#[0-9A-F]{6}$/.test(c[k] || "")) || !c.basis))) {
    problems.push(`${at}: its colours need, per VU, red, green and blue as #RRGGBB and a basis`);
  }
  for (const piece of set.pieces || []) {
    if (pieceSet.has(piece)) problems.push(`${at}: ${piece} is a piece of two sets`);
    pieceSet.set(piece, set);
  }
}

// What each item was looted from: loot is stored on the creature (creatures/data/creatures.json) and drawn here too.
const creatures = (load(path.join(SITE, "creatures", "data", "creatures.json")).creatures || []);
const droppedBy = new Map();
for (const creature of creatures) {
  for (const entry of creature.loot || []) {
    if (!droppedBy.has(entry.item)) droppedBy.set(entry.item, []);
    droppedBy.get(entry.item).push({creature, entry});
  }
}

const ids = new Set();
const categories = CATEGORIES.map((key) => {
  const data = load(path.join(ROOT, "data", `${key}.json`));
  if (!data.category) problems.push(`data/${key}.json: no category name`);
  const items = (data.items || []).map((item, n) => {
    const at = `data/${key}.json, item ${item.id || n + 1}`;
    if (!ID.test(item.id || "")) problems.push(`${at}: its id should be lowercase letters, digits and hyphens`);
    if (ids.has(item.id)) problems.push(`${at}: the id is used twice`);
    ids.add(item.id);
    for (const field of ["name", "type"]) {
      if (typeof item[field] !== "string" || !item[field].trim()) problems.push(`${at}: no ${field}`);
    }
    if (item.also !== undefined && (!Array.isArray(item.also) || item.also.some((a) => typeof a !== "string"))) {
      problems.push(`${at}: also should be a list of names`);
    }
    // A fact several sources give is stored once with its citations (the private editor's tools/itemdata.py
    // describes the layout).
    const shared = [...(item.names || []), ...(item.descriptions || []), ...(item.records || [])];
    const file = iconFile(item.icon);
    if (item.unused !== undefined && !reasons[item.unused]) problems.push(`${at}: unused ${JSON.stringify(item.unused)} is not one of the owner's reasons in sources.json`);
    if (item.icon && !(pictures.icons || {})[file]) problems.push(`${at}: icon ${JSON.stringify(file)} is not in icons.json`);
    // How the Archive reproduces an armour piece, per VU: the model's class, the detail sheet and mask, the channels and
    // why. Checked here and not shown. A look without a basis of its own shares its set's: the basis of the set's colours
    // for the same VU.
    const setBasis = (vu) => ((pieceSet.get(item.id) || {}).colours || []).some((c) => c.vu === vu && c.basis);
    for (const look of item.look || []) {
      if (!lookVu(look.vu) || !Number.isInteger(look.class) || ![0, 1].includes(look.detail) || ![5, 6, 7].includes(look.mask)
          || !/^[123],[123],[123]$/.test(look.channels || "") || !(look.basis || setBasis(look.vu))) {
        problems.push(`${at}: a look needs a VU, a class, a detail sheet (0, 1), a mask (5, 6, 7), channels and a basis, its own or its set's colours' for that VU`);
      }
    }
    if (item.icon && item.icon.shared_from !== undefined && !ID.test(item.icon.shared_from)) problems.push(`${at}: shared_from should be an item id`);
    const statEntries = Object.values(item.stats || {}).flat();
    const anything = shared.length || statEntries.length || (item.seen || []).length || (item.tt || []).length || file
      || item.unused || droppedBy.has(item.id);
    if (!anything) problems.push(`${at}: nothing about it has a source`);
    for (const entry of shared) {
      if (!Array.isArray(entry.sources) || !entry.sources.length) problems.push(`${at}: a name, description or record cites no source`);
      for (const c of entry.sources || []) P.checkCitation(c, at);
    }
    for (const n of item.names || []) {
      if (typeof n.name !== "string" || !n.name) problems.push(`${at}: a name entry has no name`);
    }
    for (const d of item.descriptions || []) {
      if (typeof d.text !== "string" || !d.text) problems.push(`${at}: a description entry has no text`);
    }
    P.checkStats(item.stats, key, at);
    for (const fact of [...(item.seen || []), ...(item.tt || [])]) {
      if (!sources[fact.source]) problems.push(`${at}: source ${JSON.stringify(fact.source)} is not in sources.json`);
      for (const field of ["capture", "first_capture", "last_capture"]) {
        if (fact[field] !== undefined && !captures[fact[field]]) problems.push(`${at}: ${field} ${JSON.stringify(fact[field])} is not in captures.json`);
      }
    }
    for (const r of item.records || []) {
      if (r.capture !== undefined && !captures[r.capture]) problems.push(`${at}: record capture ${JSON.stringify(r.capture)} is not in captures.json`);
    }
    for (const x of item.seen || []) {
      // A dated sighting (PE Auction) has both days in order, its VUs following from them; an inferred one (source
      // "set") has VUs and the items it rests on. A client's sighting is not stored: the client naming the item is it.
      const dated = x.first_capture !== undefined || x.last_capture !== undefined;
      const days = seenDays(x);
      if (dated && (!DAY.test(days[0] || "") || !DAY.test(days[1] || "") || days[1] < days[0] || !vuOn(days[0]))) problems.push(`${at}: seen needs first and last days in order`);
      if (!dated && !(x.basis || []).length) problems.push(`${at}: a sighting without days needs the items it rests on (basis)`);
      for (const vu of [...(dated ? [] : [x.first_vu, x.last_vu]), ...(x.vus || [])]) {
        if (!RANK.has(vu)) problems.push(`${at}: VU ${JSON.stringify(vu)} is not a version in versions.json`);
      }
    }
    for (const t of item.tt || []) {
      const read = t.media !== undefined ? P.pictures.has(t.media) : captures[t.capture];
      if (!/^\d+\.\d+$/.test(t.ped || "") || !read) problems.push(`${at}: a TT value needs ped and the capture or picture it was read off`);
    }
    // The Archive's own words carry no en or em dash; what a source says is quoted as it wrote it, dashes and all.
    const own = [item.type, item.icon && item.icon.assigned && item.icon.assigned.basis];
    if (own.some((text) => /[–—]/.test(text || ""))) problems.push(`${at}: the Archive's own text uses an en or em dash`);
    return item;
  });
  return {key, name: data.category, items};
});
const armor = new Set(categories.find((c) => c.key === "armor").items.map((i) => i.id));
for (const [piece] of pieceSet) {
  if (!armor.has(piece)) problems.push(`sets.json: piece ${JSON.stringify(piece)} is not an item of data/armor.json`);
}
for (const [item] of droppedBy) {
  if (!ids.has(item)) problems.push(`creatures.json: loot names item ${JSON.stringify(item)}, which no category holds`);
}
const byId = new Map(categories.flatMap((c) => c.items.map((i) => [i.id, i])));
for (const [at, entries] of P.recipes) {
  for (const part of entries.flatMap((entry) => entry.value)) {
    const id = typeof part === "string" ? part : part.item;
    if (!byId.has(id)) problems.push(`${at}: it names item ${JSON.stringify(id)}, which no category holds`);
  }
}
// The names an item can show by VU, each over the VUs its citations cover, in the order they were first used; with no
// VU chosen it shows the name it carried last, and a link to it says that name too.
function datedNames(item) {
  const names = (item.names || []).map((n) => [n.name, widest(n.sources.map(citationVus))])
    .filter((n) => n[1]).map(([name, w]) => [name, RANK.get(w.first), RANK.get(w.last)]);
  return names.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
}
const shownName = (item, names = datedNames(item)) => (names.length ? [...names].sort((a, b) => a[2] - b[2] || a[1] - b[1]).pop()[0] : item.name);
P.setItemLink((id) => `<a href="#${esc(id)}">${esc(shownName(byId.get(id)))}</a>`);
// Every picture is one some item wears.
const worn = new Set(categories.flatMap((c) => c.items.map((i) => iconFile(i.icon)).filter(Boolean)));
for (const file of Object.keys(pictures.icons || {})) {
  if (!worn.has(file)) problems.push(`icons.json: no item wears ${file}`);
}
if (problems.length) {
  stop(`${problems.length} problem(s) in the items data. Nothing was written.\n  ${problems.slice(0, 50).join("\n  ")}`);
}

// An armour part the game added after its sets: foot guards came with VU 9.0 (notes.md, VU 9: "Armor Foot Guards are
// finally introduced"). A set's stats, cited since its first pieces, date such a piece only from then.
const PART_SINCE = {"Foot Guards": "9.0"};
const notBefore = (vu) => (pair) => (!pair || RANK.get(pair[1]) < RANK.get(vu) ? null
  : [RANK.get(pair[0]) < RANK.get(vu) ? vu : pair[0], pair[1]]);

// An item was seen from the earliest VU any source shows it in to the latest: its dated and inferred sightings, the
// clients that name it, the values players recorded, the loot that names it and its set's stats.
function span(item) {
  const cited = [...(item.names || []), ...(item.descriptions || []), ...(item.records || []), ...Object.values(item.stats || {}).flat(),
    ...(droppedBy.get(item.id) || []).map((d) => d.entry)]
    .flatMap((entry) => entry.sources).map(citationVus);
  const since = PART_SINCE[item.type];
  const fromSet = Object.values((pieceSet.get(item.id) || {}).stats || {}).flat()
    .flatMap((entry) => entry.sources).map(citationVus).map((pair) => (since ? notBefore(since)(pair) : pair));
  return widest([...(item.seen || []).map((x) => (x.first_capture ? seenDays(x).map(vuOn) : [x.first_vu, x.last_vu])), ...cited, ...fromSet]);
}

// An icon drawn since, not stored by a client, says so when the pointer rests on it.
const RECONSTRUCTED = "The client rendered this icon at runtime. This is a modern reconstruction.";
const iconHTML = (icon) => {
  const file = iconFile(icon);
  if (!file) {
    return `<span class="i-icon"></span>`;
  }
  const image = `<img src="icons/${esc(file)}" alt="" loading="lazy">`;
  return /_reconstructed_\d{4}\.png$/.test(file)
    ? `<span class="i-icon recon" tabindex="0" aria-label="${RECONSTRUCTED}" data-tip="${RECONSTRUCTED}">${image}</span>`
    : `<span class="i-icon">${image}</span>`;
};

const vus = (first, last) => (first === last ? `VU ${first}` : `VU ${first} to ${last}`);

// The flavour text an item carried in VU 5.4, as the 5.4 client's description gives it, and any other text the game's
// own item window showed for it in a dated screenshot.
const flavours = (item) => (item.descriptions || []).filter((d) => d.sources.includes("client-5.4")
  || d.sources.some((c) => c.source === "item-window")).sort((a, b) => b.sources.includes("client-5.4") - a.sources.includes("client-5.4"));

// A TT value's place among the item's others: its capture's timestamp, or the start of the latest day the picture it was
// read off can date from.
const ttOrder = (t) => t.capture || `${(P.pictureDay(t.media) || "").replace(/-/g, "")}000000/`;

// A piece of an armour set shows the set's stats beside its own, field by field: a value both give is one line with the
// sources of both.
function mergeStats(...all) {
  const out = {};
  for (const [field, entries] of all.flatMap((stats) => Object.entries(stats || {}))) {
    const lines = out[field] || (out[field] = []);
    for (const entry of entries) {
      const same = lines.find((line) => JSON.stringify(line.value) === JSON.stringify(entry.value));
      if (same) {
        same.sources = [...same.sources, ...entry.sources];
      } else {
        lines.push({value: entry.value, sources: [...entry.sources]});
      }
    }
  }
  return out;
}

// The blueprints that make an item, one row each in the stats table's columns, with the sources that say so behind
// the question mark (a link inferred from a blueprint's name says that too).
const madeWith = new Map();
for (const blueprint of categories.find((c) => c.key === "blueprints").items) {
  for (const entry of (blueprint.stats || {}).product || []) {
    for (const id of entry.value) {
      madeWith.set(id, [...(madeWith.get(id) || []), {blueprint, sources: entry.sources}]);
    }
  }
}
function madeWithHTML(item) {
  const rows = (madeWith.get(item.id) || []).map((row) => ({...row, name: shownName(row.blueprint)})).sort((a, b) => a.name.localeCompare(b.name));
  return rows.map(({blueprint, name, sources}, n) => `<tr><th scope="row">${n ? "" : "Made with"}</th><td class="q">${P.mark(P.provenance(sources))}</td>`
    + `<td class="v"><a href="#${esc(blueprint.id)}">${esc(name)}</a></td></tr>`).join("");
}

// The auctions players recorded of an item, counted from its file on the Auction page (../auction/data/items/), with a
// link to them there.
const AUCTIONS = path.join(SITE, "auction", "data", "items");
const auctions = new Map(fs.existsSync(AUCTIONS) ? fs.readdirSync(AUCTIONS).filter((f) => f.endsWith(".json")).map((f) => {
  const data = JSON.parse(fs.readFileSync(path.join(AUCTIONS, f), "utf8"));
  return [data.item, [data.sold.length, data.unsold.length]];
}) : []);
function auctionHTML(item) {
  const counts = auctions.get(item.id);
  if (!counts) return "";
  const [sold, unsold] = counts;
  const text = [`${sold.toLocaleString("en")} ${sold === 1 ? "sale" : "sales"}`, unsold ? `${unsold.toLocaleString("en")} unsold` : ""].filter(Boolean).join(", ");
  return `<tr><th scope="row">Auction</th><td class="q"></td><td class="v"><a href="../auction/#${esc(item.id)}">${esc(text)}</a></td></tr>`;
}

// The Hall of Fame loots players recorded of the item, a mined ore or enmatter, oldest first.
const hallOf = new Map();
for (const r of P.hall.records) {
  if (r.item) hallOf.set(r.item, [...(hallOf.get(r.item) || []), r]);
}
for (const r of P.hall.records) {
  if (r.item && !byId.has(r.item)) problems.push(`halloffame/data/records.json: a record names item ${JSON.stringify(r.item)}, which no category holds`);
}
function hallHTML(item) {
  const records = hallOf.get(item.id) || [];
  if (!records.length) return "";
  return `<tr><th scope="row">Globals</th><td class="q"></td><td class="v"><a href="../halloffame/?i=${esc(item.id)}">${records.length.toLocaleString("en")} ${records.length === 1 ? "record" : "records"} on the Hall of Fame page</a></td></tr>`
    + P.hallRows(records.filter((r) => r.kind === "hof"), () => "");
}

// The creatures an item was looted from, one row each in the stats table's columns: the creature, with the sources of
// every loot entry of the creature that names the item, and the VUs they recorded it in, behind its question mark.
function dropsHTML(item) {
  const byCreature = new Map();
  for (const {creature, entry} of droppedBy.get(item.id) || []) {
    const sources = [...(byCreature.get(creature.id) || {sources: []}).sources, ...entry.sources];
    byCreature.set(creature.id, {creature, sources});
  }
  const drops = [...byCreature.values()].sort((a, b) => a.creature.name.localeCompare(b.creature.name));
  return drops.map(({creature, sources}, n) => {
    const stated = sources.flatMap(P.vusOf);
    return `<tr class="drop" data-v="${esc(stated.map((v) => RANK.get(v)).join(" "))}"><th scope="row">${n ? "" : "Dropped by"}</th>`
      + `<td class="q">${P.mark(P.provenance(sources))}</td><td class="v"><a href="../creatures/#${esc(creature.id)}">${esc(creature.name)}</a></td></tr>`;
  }).join("");
}

function itemHTML(category, item) {
  const s = span(item);
  const tt = [...(item.tt || [])].sort((a, b) => ttOrder(a).localeCompare(ttOrder(b))).pop();
  const seen = s ? vus(s.first, s.last) : "";
  const names = datedNames(item);
  const shown = shownName(item, names);
  const text = [item.name, ...(item.names || []).map((n) => n.name), ...(item.also || []), item.type, category.name].join(" ").toLowerCase();
  const range = s ? ` data-a="${RANK.get(s.first)}" data-b="${RANK.get(s.last)}"` : "";
  const dated = names.length ? ` data-names="${esc(JSON.stringify(names))}"` : "";
  const texts = flavours(item);
  // A piece of an armour set shows the set's stats beside its own, which every piece of the set has alike.
  const set = pieceSet.get(item.id);
  const description = texts.length ? [{label: "Description", entries: texts.map((d) => ({html: esc(d.text), sources: d.sources}))}] : [];
  const pictured = P.mediaLink([item.name, ...(item.names || []).map((n) => n.name), ...(item.also || [])], set ? [`${set.name} Armor`] : []);
  const more = pictured + P.statsHTML(mergeStats(set && set.stats, item.stats), category.key, {first: description, last: madeWithHTML(item) + auctionHTML(item) + hallHTML(item) + dropsHTML(item)});
  return `<li class="item${more ? " has-more" : ""}" id="${esc(item.id)}" data-cat="${category.key}" data-type="${esc(item.type)}"${range}${dated} data-text="${esc(text)}"${item.unused ? " data-unused" : ""}>`
    + iconHTML(item.icon)
    + `<span class="i-name-cell"><span class="i-name">${esc(shown)}</span></span><span class="i-type">${esc(item.type)}</span>`
    + `<span class="i-tt">${tt ? `${esc(tt.ped)} PED` : ""}</span><span class="i-seen">${esc(seen)}</span>`
    + (more ? `<div class="i-more">${more}</div>` : "") + "</li>";
}

// An item flagged unused (judged never in the game) is in the page but hidden, and counts only when shown.
const inUse = (c) => c.items.filter((i) => !i.unused).length;
const total = categories.reduce((n, c) => n + inUse(c), 0);
const option = (value, text) => `<option value="${esc(value)}">${esc(text)}</option>`;
// The categories as the page lists them, by name, the Category filter's first one first.
const listed = [...categories].sort((a, b) => a.name.localeCompare(b.name, "en"));
const types = listed.map((c) => `<optgroup label="${esc(c.name)}" data-cat="${c.key}">${[...new Set(c.items.map((i) => i.type))]
  .sort((a, b) => a.localeCompare(b, "en", {sensitivity: "base"})).map((t) => `<option value="${esc(`${c.key}:${t}`)}">${esc(t)}</option>`).join("")}</optgroup>`).join("");
const used = new Set(categories.flatMap((c) => c.items.flatMap((i) => {
  const s = span(i);
  return s ? VUS.slice(RANK.get(s.first), RANK.get(s.last) + 1) : [];
})));
const listHTML = listed.map((c) => `<section class="i-group" id="${c.key}"><h2>${esc(c.name)} <span class="i-count">${inUse(c)}</span></h2>
<div class="i-cols" aria-hidden="true"><span></span><span>Name</span><span>Type</span><span>TT value</span><span>Seen</span></div>
<ol class="items">
${c.items.map((i) => itemHTML(c, i)).join("\n")}
</ol></section>`).join("\n");
const body = `<div class="filters" role="search">
<label>Category <select class="fsel" data-filter="cat">${listed.map((c) => option(c.key, c.name)).join("")}</select></label>
<label>Type <select class="fsel" data-filter="type"><option value="">Any</option>${types}</select></label>
<label>Seen in <select class="fsel" data-filter="vu" aria-label="Seen in VU"><option value="">any VU</option>${VUS.filter((v) => used.has(v)).map((v) => `<option value="${v}" data-rank="${RANK.get(v)}">VU ${v}</option>`).join("")}</select></label>
<label class="i-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Name or other spelling"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${total} of ${total} items</p>
${listHTML}
<p class="nomatch" hidden>Nothing matches these filters.</p>
<script type="application/json" id="i-fields">${P.fieldsJSON()}</script>`;

const template = read(path.join(ROOT, "index.html"));
if (!APP.test(template) || !FILES.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into and one <!--files--> for the data links");
}
const files = [...categories.map((c) => `<a href="data/${c.key}.json">${c.key}.json</a>`), `<a href="icons.json">icons.json</a>`,
  `<a href="sets.json">sets.json</a>`, `<a href="fields.json">fields.json</a>`, `<a href="captures.json">captures.json</a>`, `<a href="sources.json">sources.json</a>`].join(", ");
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, "data"), {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`)
  .replace(FILES, () => `${files}.`));
fs.cpSync(path.join(ROOT, "icons"), path.join(OUT, "icons"), {recursive: true});
for (const name of ["items.js", "items.css", "sources.json", "icons.json", "sets.json", "fields.json", "captures.json"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
for (const c of categories) {
  fs.copyFileSync(path.join(ROOT, "data", `${c.key}.json`), path.join(OUT, "data", `${c.key}.json`));
}
console.log(`Drew ${total} items in ${categories.length} categories into ${OUT}`);
