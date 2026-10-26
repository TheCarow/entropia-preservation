/* Entropia Archive creatures: node render-creatures.js [folder] draws data/creatures.json into
   <folder>/creatures/index.html (default: _out beside this file), beside creatures.js, creatures.css and the data. Every
   creature is in the page, so it reads in full without JavaScript; creatures.js only filters it and picks each value
   for a chosen VU. The sources, captures and fields are the Items page's (../items/), which this page cites too. A
   mistake in the data stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");
const {context, esc, load: loadJSON} = require("../items/provenance");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "creatures");
const APP = /<div id="app"><\/div>/;
const FILES = /<!--files-->/;
const ID = /^[a-z0-9-]+$/;
// The Items page's categories, in its order: loot is grouped by them.
const CATEGORIES = ["weapons", "armor", "attachments", "tools", "clothing", "housing", "blueprints", "components",
  "materials", "resources", "misc"];

function stop(message) {
  console.error(message);
  process.exit(1);
}

const load = (file) => loadJSON(file, stop);
const problems = [];
const P = context(SITE, stop, problems);
const {VUS, RANK, citationVus, widest} = P;

// The items loot can name, by id: their names and categories.
const items = new Map();
for (const key of CATEGORIES) {
  const data = load(path.join(SITE, "items", "data", `${key}.json`));
  for (const item of data.items || []) items.set(item.id, {item, key, category: data.category});
}

const creatures = load(path.join(ROOT, "data", "creatures.json")).creatures || [];
const ids = new Set();
for (const [n, creature] of creatures.entries()) {
  const at = `data/creatures.json, creature ${creature.id || n + 1}`;
  if (!ID.test(creature.id || "")) problems.push(`${at}: its id should be lowercase letters, digits and hyphens`);
  if (ids.has(creature.id)) problems.push(`${at}: the id is used twice`);
  ids.add(creature.id);
  if (typeof creature.name !== "string" || !creature.name.trim()) problems.push(`${at}: no name`);
  const descriptions = [...(creature.descriptions || []), ...(creature.maturities || []).flatMap((m) => m.descriptions || [])];
  for (const entry of [...(creature.names || []), ...descriptions, ...(creature.loot || []), ...(creature.locations || [])]) {
    if (!Array.isArray(entry.sources) || !entry.sources.length) problems.push(`${at}: a name, description, loot or location entry cites no source`);
    for (const c of entry.sources || []) P.checkCitation(c, at);
  }
  for (const d of descriptions) {
    if (typeof d.text !== "string" || !d.text) problems.push(`${at}: a description entry has no text`);
  }
  P.checkStats(creature.stats, "creatures", at);
  for (const maturity of creature.maturities || []) {
    if (typeof maturity.name !== "string" || !maturity.name) problems.push(`${at}: a maturity has no name`);
    for (const c of maturity.sources || []) P.checkCitation(c, `${at}, maturity ${maturity.name}`);
    P.checkStats(maturity.stats, "maturities", `${at}, maturity ${maturity.name}`);
  }
  for (const entry of creature.loot || []) {
    if (!items.has(entry.item)) problems.push(`${at}: loot names item ${JSON.stringify(entry.item)}, which the Items page lacks`);
  }
  for (const where of creature.locations || []) {
    const placed = (typeof where.lon === "number" && typeof where.lat === "number") || (typeof where.x === "number" && typeof where.y === "number");
    if (!placed) problems.push(`${at}: a location needs a longitude and latitude, or an X and Y`);
    if (where.found !== undefined && !/^\d{4}-\d\d-\d\d$/.test(where.found)) problems.push(`${at}: a location's found should be a day`);
  }
  if (![creature.names, creature.descriptions, creature.stats && Object.keys(creature.stats), creature.loot, creature.maturities, creature.locations]
    .some((x) => x && x.length)) {
    problems.push(`${at}: nothing about it has a source`);
  }
}
if (problems.length) {
  stop(`${problems.length} problem(s) in the creatures data. Nothing was written.\n  ${problems.slice(0, 50).join("\n  ")}`);
}

const allCitations = (c) => [...(c.names || []), ...(c.descriptions || []), ...(c.loot || []), ...(c.locations || []),
  ...Object.values(c.stats || {}).flat(), ...(c.maturities || []), ...(c.maturities || []).flatMap((m) => m.descriptions || []),
  ...(c.maturities || []).flatMap((m) => Object.values(m.stats || {}).flat())].flatMap((entry) => entry.sources);
// A creature's or a maturity's descriptions, as the first rows of its table, each with its sources.
const descriptionRows = (descriptions) => ((descriptions || []).length
  ? [{label: "Description", entries: descriptions.map((d) => ({html: esc(d.text), sources: d.sources}))}] : []);
// A creature was seen from the earliest VU any source shows it in to the latest.
const span = (c) => widest(allCitations(c).map(citationVus));
// The value a field had last, for the list's columns: the latest line of the field, as the page shows with no VU.
function latest(c, field) {
  const entries = (c.stats || {})[field] || [];
  const scored = entries.map((e) => [e, Math.max(...e.sources.map(citationVus).filter(Boolean).map((p) => RANK.get(p[1])))]);
  return scored.sort((a, b) => b[1] - a[1])[0];
}

// What a creature dropped, one row per item in the stats tables' columns, grouped by the Items page's categories, the
// category beside its first item: the item once, with how often a source said it dropped, and behind its question
// mark the sources of every loot entry naming it, the VUs they recorded it in and the names they printed where they
// differ from the item's own.
function lootHTML(c) {
  const byItem = new Map();
  for (const entry of c.loot || []) {
    const seen = byItem.get(entry.item) || {item: entry.item, sources: []};
    byItem.set(entry.item, {...seen, sources: [...seen.sources, ...entry.sources], frequency: seen.frequency || entry.frequency});
  }
  const groups = new Map(CATEGORIES.map((k) => [k, []]));
  for (const entry of byItem.values()) groups.get(items.get(entry.item).key).push(entry);
  const rows = [];
  for (const [, entries] of groups) {
    if (!entries.length) continue;
    const category = items.get(entries[0].item).category;
    entries.sort((a, b) => items.get(a.item).item.name.localeCompare(items.get(b.item).item.name));
    rows.push(...entries.map((entry, n) => {
      const stated = entry.sources.flatMap(P.vusOf);
      const as = [...new Set(entry.sources.flatMap((s) => s.as || []))];
      const often = entry.frequency ? ` (${esc(entry.frequency.toLowerCase())})` : "";
      const sources = `${P.provenance(entry.sources)}${as.length ? `<span class="e">Listed as ${esc(as.join(", "))}</span>` : ""}`;
      return `<tr class="drop" data-v="${esc(stated.map((v) => RANK.get(v)).join(" "))}"><th scope="row">${n ? "" : esc(category)}</th>`
        + `<td class="q">${P.mark(sources)}</td><td class="v"><a href="../items/#${esc(entry.item)}">${esc(items.get(entry.item).item.name)}</a>${often}</td></tr>`;
    }));
  }
  return rows.length ? `<p class="c-head">Dropped</p><table class="i-stats"><tbody class="fixed">${rows.join("")}</tbody></table>` : "";
}

// Each maturity a source names: its name and the sources that name it at the head of its own table, then its stats,
// picked by VU as the creature's are.
function maturitiesHTML(c) {
  const tables = (c.maturities || []).map((m) => P.statsHTML(m.stats, "maturities", {
    head: `<tr class="c-mname"><th scope="row">${esc(m.name)}</th><td class="q">${P.mark(P.provenance(m.sources))}</td><td class="v"></td></tr>`,
    first: descriptionRows(m.descriptions),
  }));
  return tables.length ? `<p class="c-head">Maturities</p>${tables.join("")}` : "";
}

// Where players saw it, one row per place in the stats tables' columns: a continent with longitude and latitude, or a
// position in X, Y and Z, with the name the source gave the place or the creature there, and the day it was found
// where the source says, with its sources behind its question mark.
function locationsHTML(c) {
  const rows = (c.locations || []).map((where, n) => {
    const at = where.lon !== undefined ? `${where.continent ? `${where.continent}, ` : ""}${where.lon}, ${where.lat}`
      : `X ${where.x}, Y ${where.y}${where.z !== undefined ? `, Z ${where.z}` : ""}`;
    const extra = [where.label, where.found && `found ${where.found}`].filter(Boolean).join(", ");
    return `<tr><th scope="row">${n ? "" : "Seen at"}</th><td class="q">${P.mark(P.provenance(where.sources))}</td><td class="v">${esc(at)}${extra ? ` (${esc(extra)})` : ""}</td></tr>`;
  });
  return rows.length ? `<table class="i-stats"><tbody class="fixed">${rows.join("")}</tbody></table>` : "";
}

// The Hall of Fame loots players recorded from the creature, oldest first, each with the maturity it names.
const hallOf = new Map();
for (const r of P.hall.records) {
  if (r.creature) hallOf.set(r.creature, [...(hallOf.get(r.creature) || []), r]);
}
const creatureIds = new Set(creatures.map((c) => c.id));
for (const r of P.hall.records) {
  if (r.creature && !creatureIds.has(r.creature)) stop(`halloffame/data/records.json: a record names creature ${JSON.stringify(r.creature)}, which creatures.json does not hold`);
}
function hallHTML(c) {
  const records = hallOf.get(c.id) || [];
  if (!records.length) return "";
  const link = `<tr><th scope="row">Globals</th><td class="q"></td><td class="v"><a href="../halloffame/?c=${esc(c.id)}">${records.length.toLocaleString("en")} ${records.length === 1 ? "record" : "records"} on the Hall of Fame page</a></td></tr>`;
  return `<table class="i-stats"><tbody class="fixed">${link}${P.hallRows(records.filter((r) => r.kind === "hof"), (r) => (r.maturity ? esc(r.maturity) : ""))}</tbody></table>`;
}

function creatureHTML(c) {
  const s = span(c);
  const klass = latest(c, "class");
  const lootCount = (c.loot || []).length;
  const more = P.mediaLink([c.name, ...(c.names || []).map((n) => n.name)]) + P.statsHTML(c.stats, "creatures", {first: descriptionRows(c.descriptions)}) + maturitiesHTML(c)
    + locationsHTML(c) + hallHTML(c) + lootHTML(c);
  const text = [c.name, ...(c.names || []).map((n) => n.name), ...(c.also || [])].join(" ").toLowerCase();
  return `<li class="item${more ? " has-more" : ""}" id="${esc(c.id)}" data-class="${esc(klass ? klass[0].value : "")}"${s ? ` data-a="${RANK.get(s.first)}" data-b="${RANK.get(s.last)}"` : ""} data-text="${esc(text)}">`
    + `<span class="i-icon"></span><span class="i-name-cell"><span class="i-name">${esc(c.name)}</span></span>`
    + `<span class="i-type">${esc(klass ? klass[0].value : "")}</span><span class="c-count">${lootCount ? `${lootCount} items` : ""}</span>`
    + `<span class="i-seen">${s ? esc(s.first === s.last ? `VU ${s.first}` : `VU ${s.first} to ${s.last}`) : ""}</span>`
    + (more ? `<div class="i-more">${more}</div>` : "") + "</li>";
}

const sorted = [...creatures].sort((a, b) => a.name.localeCompare(b.name, "en", {sensitivity: "base"}));
const classes = [...new Set(sorted.map((c) => latest(c, "class")).filter(Boolean).map((x) => x[0].value))].sort();
const used = new Set(sorted.flatMap((c) => {
  const s = span(c);
  return s ? VUS.slice(RANK.get(s.first), RANK.get(s.last) + 1) : [];
}));
const option = (value, text) => `<option value="${esc(value)}">${esc(text)}</option>`;
const body = `<div class="filters" role="search">
<label>Class <select class="fsel" data-filter="class"><option value="">Any</option>${classes.map((k) => option(k, k)).join("")}</select></label>
<label>Seen in <select class="fsel" data-filter="vu" aria-label="Seen in VU"><option value="">any VU</option>${VUS.filter((v) => used.has(v)).map((v) => `<option value="${v}" data-rank="${RANK.get(v)}">VU ${v}</option>`).join("")}</select></label>
<label class="i-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Name"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${sorted.length} of ${sorted.length} creatures</p>
<div class="i-cols" aria-hidden="true"><span></span><span>Name</span><span>Class</span><span>Loot</span><span>Seen</span></div>
<ol class="items">
${sorted.map(creatureHTML).join("\n")}
</ol>
<p class="nomatch" hidden>Nothing matches these filters.</p>
<script type="application/json" id="i-fields">${P.fieldsJSON()}</script>`;

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (!APP.test(template) || !FILES.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into and one <!--files--> for the data links");
}
const files = [`<a href="data/creatures.json">creatures.json</a>`, `<a href="../halloffame/data/records.json">records.json</a> (Hall of Fame)`, `<a href="../items/fields.json">fields.json</a>`,
  `<a href="../items/captures.json">captures.json</a>`, `<a href="../items/sources.json">sources.json</a>`].join(", ");
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, "data"), {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`)
  .replace(FILES, () => `${files}.`));
for (const name of ["creatures.js", "creatures.css"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
fs.copyFileSync(path.join(ROOT, "data", "creatures.json"), path.join(OUT, "data", "creatures.json"));
console.log(`Drew ${sorted.length} creatures into ${OUT}`);
