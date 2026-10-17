/* Entropia Archive skills: node render-skills.js [folder] draws data/skills.json and data/ranks.json into
   <folder>/skills/index.html (default: _out beside this file), beside skills.js, skills.css and the data. Every skill is
   in the page, so it reads in full without JavaScript; skills.js only filters it, picks each value for a chosen VU and
   opens a skill's details in a popup. The sources, captures and fields are the Items page's (../items/), which this page
   cites too, and a skill's details name the items that train it and its implant from the Items data. A mistake in the
   data stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");
const {context, esc, load: loadJSON} = require("../items/provenance");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "skills");
const APP = /<div id="app"><\/div>/;
const FILES = /<!--files-->/;
const ID = /^[a-z0-9-]+$/;
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

// The items a skill's details can name: the items whose "skills gained" list names it, and its implant.
const items = [];
for (const key of CATEGORIES) {
  for (const item of load(path.join(SITE, "items", "data", `${key}.json`)).items || []) {
    if (!item.unused) items.push(item);
  }
}
const byName = new Map(items.map((i) => [i.name.toLowerCase(), i]));

const skills = load(path.join(ROOT, "data", "skills.json")).skills || [];
const ids = new Set();
for (const [n, skill] of skills.entries()) {
  const at = `data/skills.json, skill ${skill.id || n + 1}`;
  if (!ID.test(skill.id || "")) problems.push(`${at}: its id should be lowercase letters, digits and hyphens`);
  if (ids.has(skill.id)) problems.push(`${at}: the id is used twice`);
  ids.add(skill.id);
  if (typeof skill.name !== "string" || !skill.name.trim()) problems.push(`${at}: no name`);
  for (const entry of [...(skill.names || []), ...(skill.descriptions || []), ...(skill.records || [])]) {
    if (!Array.isArray(entry.sources) || !entry.sources.length) problems.push(`${at}: a name, description or record cites no source`);
    for (const c of entry.sources || []) P.checkCitation(c, at);
  }
  P.checkStats(skill.stats, "skills", at);
}
const ladder = load(path.join(ROOT, "data", "ranks.json"));
const bands = ladder.ranks || [];
if (!P.sources[ladder.source]) problems.push(`data/ranks.json: source ${JSON.stringify(ladder.source)} is not in sources.json`);
for (const [n, band] of bands.entries()) {
  if (typeof band.rank !== "string" || typeof band.from !== "number" || typeof band.to !== "number" || band.to <= band.from) {
    problems.push(`data/ranks.json, band ${n + 1}: needs a rank and from < to`);
  }
}
if (problems.length) {
  stop(`${problems.length} problem(s) in the skills data. Nothing was written.\n  ${problems.slice(0, 50).join("\n  ")}`);
}

const allCitations = (s) => [...(s.names || []), ...(s.descriptions || []), ...(s.records || []), ...Object.values(s.stats || {}).flat()]
  .flatMap((entry) => entry.sources);
// A skill was seen from the earliest VU any source shows it in to the latest.
const span = (s) => widest(allCitations(s).map(citationVus));
// The value a field had last, for the list's columns.
function latest(s, field) {
  const entries = (s.stats || {})[field] || [];
  const scored = entries.map((e) => [e, Math.max(...e.sources.map(citationVus).filter(Boolean).map((p) => RANK.get(p[1])))]);
  return (scored.sort((a, b) => b[1] - a[1])[0] || [])[0];
}

// The items whose "skills gained" list names the skill, as "Category: Skill" or the skill alone, each with the sources
// of that list; and its implant, the item named "<skill> Skill Implant", limited or not.
function trainersHTML(s) {
  const wanted = new Set([s.name, ...(s.names || []).map((n) => n.name)].map((n) => n.toLowerCase()));
  const named = (text) => wanted.has(text.toLowerCase().replace(/^[^:]+:\s*/, ""));
  const trainers = items.flatMap((item) => ((item.stats || {}).skills || [])
    .filter((entry) => entry.value.some((v) => named(v.name))).map((entry) => ({item, sources: entry.sources})));
  const byItem = new Map();
  for (const {item, sources} of trainers) {
    byItem.set(item.id, {item, sources: [...((byItem.get(item.id) || {}).sources || []), ...sources]});
  }
  const rows = [...byItem.values()].sort((a, b) => a.item.name.localeCompare(b.item.name)).map(({item, sources}, n) =>
    `<tr><th scope="row">${n ? "" : "Gained using"}</th><td class="q">${P.mark(P.provenance(sources))}</td><td class="v"><a href="../items/#${esc(item.id)}">${esc(item.name)}</a></td></tr>`);
  const implants = [`${s.name} Skill Implant (L)`, `${s.name} Skill Implant`].map((n) => byName.get(n.toLowerCase())).filter(Boolean);
  rows.push(...implants.map((item, n) => `<tr><th scope="row">${n ? "" : "Implant"}</th><td class="q"></td><td class="v"><a href="../items/#${esc(item.id)}">${esc(item.name)}</a></td></tr>`));
  return rows.join("");
}

function skillHTML(s) {
  const seen = span(s);
  const category = latest(s, "skill_category");
  const hidden = latest(s, "hidden");
  const description = (s.descriptions || []).length
    ? [{label: "Description", entries: s.descriptions.map((d) => ({html: esc(d.text), sources: d.sources}))}] : [];
  const more = P.statsHTML(s.stats, "skills", {first: description, last: trainersHTML(s)});
  const text = [s.name, ...(s.names || []).map((n) => n.name), category ? category.value : ""].join(" ").toLowerCase();
  return `<li class="item${more ? " has-more" : ""}" id="${esc(s.id)}" data-category="${esc(category ? category.value : "")}"${seen ? ` data-a="${RANK.get(seen.first)}" data-b="${RANK.get(seen.last)}"` : ""} data-text="${esc(text)}">`
    + `<span class="i-icon"></span><span class="i-name-cell"><span class="i-name">${esc(s.name)}</span></span>`
    + `<span class="i-type">${esc(category ? category.value : "")}</span><span class="s-hidden">${hidden && hidden.value ? "Hidden" : ""}</span>`
    + `<span class="i-seen">${seen ? esc(seen.first === seen.last ? `VU ${seen.first}` : `VU ${seen.first} to ${seen.last}`) : ""}</span>`
    + (more ? `<div class="i-more">${more}</div>` : "") + "</li>";
}

// The rank ladder, one row per rank: the points its ten grades cover, and where each grade starts.
function ranksHTML() {
  const tiers = new Map();
  for (const band of bands) {
    const [, rank, grade] = band.rank.match(/^(.*) \(Grade (\d+)\)$/) || [null, band.rank, ""];
    tiers.set(rank, [...(tiers.get(rank) || []), {...band, grade}]);
  }
  const rows = [...tiers].map(([rank, grades]) => `<tr><th scope="row">${esc(rank)}</th><td>${esc(grades[0].from)} to ${esc(grades[grades.length - 1].to)}</td>`
    + `<td class="s-grades">${grades.map((g) => `<span title="${esc(`Grade ${g.grade}: ${g.from} to ${g.to}`)}">${esc(g.from)}</span>`).join("")}</td></tr>`);
  return `<section class="s-ranks" id="ranks"><h2>Ranks</h2>
<p>The rank the VU 5.4 client shows beside a skill's points, from its rank ladder: ${tiers.size} ranks of ten grades. The points each grade starts at are listed in order; 8100 points or more match no rank.</p>
<div class="s-scroll"><table class="s-ladder"><thead><tr><th scope="col">Rank</th><th scope="col">Points</th><th scope="col">Grades 1 to 10 start at</th></tr></thead>
<tbody>${rows.join("")}</tbody></table></div></section>`;
}

const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name, "en", {sensitivity: "base"}));
const categories = [...new Set(sorted.map((s) => latest(s, "skill_category")).filter(Boolean).map((x) => x.value))].sort();
const used = new Set(sorted.flatMap((s) => {
  const seen = span(s);
  return seen ? VUS.slice(RANK.get(seen.first), RANK.get(seen.last) + 1) : [];
}));
const option = (value, text) => `<option value="${esc(value)}">${esc(text)}</option>`;
const body = `<div class="filters" role="search">
<label>Category <select class="fsel" data-filter="category"><option value="">Any</option>${categories.map((k) => option(k, k)).join("")}</select></label>
<label>Seen in <select class="fsel" data-filter="vu" aria-label="Seen in VU"><option value="">any VU</option>${VUS.filter((v) => used.has(v)).map((v) => `<option value="${v}" data-rank="${RANK.get(v)}">VU ${v}</option>`).join("")}</select></label>
<label class="i-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Name"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${sorted.length} of ${sorted.length} skills</p>
<div class="i-cols" aria-hidden="true"><span></span><span>Name</span><span>Category</span><span>Hidden</span><span>Seen</span></div>
<ol class="items">
${sorted.map(skillHTML).join("\n")}
</ol>
<p class="nomatch" hidden>Nothing matches these filters.</p>
${ranksHTML()}
<script type="application/json" id="i-fields">${P.fieldsJSON()}</script>`;

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (!APP.test(template) || !FILES.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into and one <!--files--> for the data links");
}
const files = [`<a href="data/skills.json">skills.json</a>`, `<a href="data/ranks.json">ranks.json</a>`,
  `<a href="../items/fields.json">fields.json</a>`, `<a href="../items/captures.json">captures.json</a>`,
  `<a href="../items/sources.json">sources.json</a>`].join(", ");
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, "data"), {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`)
  .replace(FILES, () => `${files}.`));
for (const name of ["skills.js", "skills.css"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
for (const name of ["skills.json", "ranks.json"]) {
  fs.copyFileSync(path.join(ROOT, "data", name), path.join(OUT, "data", name));
}
console.log(`Drew ${sorted.length} skills and ${bands.length} rank bands into ${OUT}`);
