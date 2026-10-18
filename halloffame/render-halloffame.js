/* Entropia Archive Hall of Fame: node render-halloffame.js [folder] draws data/records.json into
   <folder>/halloffame/index.html (default: _out beside this file), beside halloffame.js, halloffame.css and the data.
   Every record is a row of one table, newest first, so the page reads in full without JavaScript; halloffame.js
   filters it. Creature and item names and links are the Creatures and Items pages', the sources ../items/sources.json.
   A mistake in the data stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");
const {context, esc, load: loadJSON} = require("../items/provenance");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "halloffame");
const APP = /<div id="app"><\/div>/;
const FILES = /<!--files-->/;
const DAY = /^\d{4}-\d\d-\d\d$/;
const CATEGORIES = ["weapons", "armor", "attachments", "tools", "clothing", "housing", "blueprints", "components",
  "materials", "resources", "misc"];
const ACTIVITIES = {hunting: "Hunting", mining: "Mining", crafting: "Crafting"};

function stop(message) {
  console.error(message);
  process.exit(1);
}

const load = (file) => loadJSON(file, stop);
const problems = [];
const P = context(SITE, stop, problems);
const {RANK, KIND_NAMES, hallDay, hallVus, hallVuText, hallWhen} = P;

const items = new Map();
for (const key of CATEGORIES) {
  for (const item of load(path.join(SITE, "items", "data", `${key}.json`)).items || []) items.set(item.id, item);
}
const creatures = new Map((load(path.join(SITE, "creatures", "data", "creatures.json")).creatures || []).map((c) => [c.id, c]));
const {records} = P.hall;
for (const [n, r] of records.entries()) {
  const at = `data/records.json, record ${n + 1}`;
  const pictured = r.sources.some(([, c]) => typeof c === "string");
  if (r.day !== undefined ? !DAY.test(r.day) : !pictured || ![r.after, r.before].every((d) => d === undefined || DAY.test(d))) problems.push(`${at}: its day should be YYYY-MM-DD; only a record a picture shows may go without one, with after and before days where its picture is bounded`);
  if (typeof r.value !== "number" || typeof r.player !== "string" || typeof r.target !== "string" || !(r.target || r.loot)) problems.push(`${at}: needs a player (empty where the site printed none), a target or a loot, and a value`);
  if (r.creature && !creatures.has(r.creature)) problems.push(`${at}: names creature ${JSON.stringify(r.creature)}, which the Creatures page does not hold`);
  if (r.item && !items.has(r.item)) problems.push(`${at}: names item ${JSON.stringify(r.item)}, which the Items page does not hold`);
  if (r.activity && !ACTIVITIES[r.activity]) problems.push(`${at}: activity ${JSON.stringify(r.activity)} is not one of ${Object.keys(ACTIVITIES).join(", ")}`);
}
if (problems.length) {
  stop(`${problems.length} problem(s) in the Hall of Fame data. Nothing was written.\n  ${problems.slice(0, 50).join("\n  ")}`);
}

// What a record names, linked to its page where it has one: its target, the creature (with its maturity as printed)
// or the item; else its loot, the item a silent global dropped, shown behind its question mark.
function named(r, text) {
  if (r.creature) {
    return `<a href="../creatures/#${esc(r.creature)}">${esc(text)}</a>`;
  }
  if (r.item) {
    return `<a href="../items/#${esc(r.item)}">${esc(text)}</a>`;
  }
  return esc(text);
}
const targetHTML = (r) => (r.target ? named(r, r.target) : '<span class="h-none">not given</span>');
const lootHTML = (r) => (!r.loot ? "" : r.target ? esc(r.loot) : named(r, r.loot));
// The rest a source said of a record, shown behind its question mark with its sources: how and where Nirfu looted it, his share or the sale price, the note, a team, an
// all-time high, a name the window cut or printed unreadably, an earlier spelling, and how its day was worked out.
function details(r) {
  const how = {C: "crafted", P: "a private hunt", T: "a team hunt"}[r.how];
  const ranks = (r.ranks || []).map(([list, rank]) => `number ${rank} in the ${esc(list)} list`).join(" and ");
  return [r.team ? "a team" : "", r.society ? `of the society ${esc(r.society)}` : "", r.all_time_high ? "an all-time high" : "",
    ranks ? `the Hall of Fame window showed it ${ranks}` : "", r.cut ? "the name cut off at the window's edge" : "",
    r.unread ? "the name printed in glyphs that cannot be read" : "", how, r.place ? `at ${esc(r.place)}` : "", r.share !== undefined ? `his share ${esc(r.share)} PED` : "",
    r.sold !== undefined ? `sold for ${esc(r.sold)} PED` : "", r.note ? `“${esc(r.note)}”` : "",
    r.as ? `first listed as ${r.as.map(esc).join(", ")}` : ""].filter(Boolean).join("; ");
}
function dayNote(r) {
  return r.day_from === "capture" ? "The site printed the time alone; the day is its capture's."
    : r.year_from === "capture" ? "The site printed the day and month alone; the year is its capture's."
    : r.sources.every(([source]) => source === "chat-screenshot")
      ? (r.day ? "The day is its picture's in Media." : r.after || r.before ? "Media dates its picture no closer than this." : "Media does not date its picture.") : "";
}
// The year a record is of: its day's, or the one year its bounds share.
const yearOf = (r) => (r.day || (r.after && r.before && r.after.slice(0, 4) === r.before.slice(0, 4) ? r.after : "")).slice(0, 4);
const order = new Map(records.map((r) => [r, hallWhen(r)]));

const sorted = [...records].sort((a, b) => order.get(a)[0] - order.get(b)[0] || order.get(b)[1].localeCompare(order.get(a)[1])
  || (b.time || "").localeCompare(a.time || "") || b.value - a.value);
const sources = [...new Set(records.flatMap((r) => r.sources.map((s) => s[0])))];
const years = [...new Set(records.map(yearOf).filter(Boolean))].sort();
const option = (value, text) => `<option value="${esc(value)}">${esc(text)}</option>`;

function rowHTML(r) {
  const vus = hallVus(r);
  const vu = hallVuText(vus);
  const text = [r.player, r.target, r.loot || "", r.society || "", ...(r.as || []), r.note || "", r.place || "",
    r.creature ? creatures.get(r.creature).name : "", r.item ? items.get(r.item).name : ""].join(" ").toLowerCase();
  const note = dayNote(r);
  const more = details(r);
  return `<tr data-k="${esc(r.kind)}" data-a="${esc(r.activity || "")}" data-s="${esc([...new Set(r.sources.map((s) => s[0]))].join(" "))}" data-y="${yearOf(r)}" data-v="${vus && vus[1] ? RANK.get(vus[1]) : ""}"`
    + `${r.creature ? ` data-c="${esc(r.creature)}"` : ""}${r.item ? ` data-i="${esc(r.item)}"` : ""} data-text="${esc(text)}">`
    + `<td class="d">${hallDay(r) ? esc(hallDay(r)).replace(/\d{4}-\d\d-\d\d/g, '<span class="nw">$&</span>') : '<span class="h-none">undated</span>'}${r.time ? ` <span class="h-time">${esc(r.time)}</span>` : ""}</td><td class="vu">${esc(vu).replace(/\d+\.\d+(?:\.\d+)?/g, '<span class="nw">$&</span>')}</td>`
    + `<td>${r.player ? esc(r.player) : `<span class="h-none">${r.unread ? "not read" : "not printed"}</span>`}</td><td>${targetHTML(r)}</td><td class="n">${esc(r.value.toLocaleString("en"))}</td>`
    + `<td>${esc(KIND_NAMES[r.kind])}</td><td>${esc(ACTIVITIES[r.activity] || "")}</td>`
    + `<td class="q">${P.mark((r.loot ? `<span class="e">Loot: ${lootHTML(r)}.</span>` : "") + (more ? `<span class="e">${more[0].toUpperCase()}${more.slice(1)}.</span>` : "") + P.hallSources(r) + (note ? `<span class="e">${esc(note)}</span>` : ""))}</td></tr>`;
}

const body = `<p class="h-intro">A global was a loot big enough for the game to announce to every player. The biggest were recorded in the Hall of Fame.</p>
<div class="filters" role="search">
<label>Kind <select class="fsel" data-filter="k"><option value="">Any</option>${Object.entries(KIND_NAMES).map(([k, n]) => option(k, n[0].toUpperCase() + n.slice(1))).join("")}</select></label>
<label>Activity <select class="fsel" data-filter="a"><option value="">Any</option>${Object.entries(ACTIVITIES).map(([k, n]) => option(k, n)).join("")}</select></label>
<label>Source <select class="fsel" data-filter="s"><option value="">Any</option>${sources.map((k) => option(k, P.sources[k].name)).join("")}</select></label>
<label>Year <select class="fsel" data-filter="y"><option value="">Any</option>${years.map((y) => option(y, y)).join("")}</select></label>
<label class="i-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Player, target or loot"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${records.length} of ${records.length} records</p>
<div class="h-scroll"><table class="h-table">
<thead><tr><th>Day</th><th>VU</th><th>Player</th><th>Target</th><th class="n">PED</th><th>Kind</th><th>Activity</th><th></th></tr></thead>
<tbody>
${sorted.map(rowHTML).join("\n")}
</tbody></table></div>
<p class="nomatch" hidden>Nothing matches these filters.</p>`;

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (!APP.test(template) || !FILES.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into and one <!--files--> for the data links");
}
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, "data"), {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`)
  .replace(FILES, () => `<a href="data/records.json">records.json</a>, with <a href="../items/sources.json">sources.json</a>.`));
for (const name of ["halloffame.js", "halloffame.css"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
fs.copyFileSync(path.join(ROOT, "data", "records.json"), path.join(OUT, "data", "records.json"));
console.log(`Drew ${records.length} Hall of Fame records into ${OUT}`);
