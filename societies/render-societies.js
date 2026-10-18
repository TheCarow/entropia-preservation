/* Entropia Archive Societies: node render-societies.js [folder] draws data/societies.json into
   <folder>/societies/index.html (default: _out beside this file), beside societies.js, societies.css and the data.
   Every society is a row of one table, as on the Creatures page, with what the sources say of it under the row, so the
   page reads in full without JavaScript; societies.js filters the rows and opens a row's details in a popup. Sources are ../items/sources.json's, a picture's page ../media/<id>/. A mistake
   in the data stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");
const {context, esc, load: loadJSON} = require("../items/provenance");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "societies");
const APP = /<div id="app"><\/div>/;
const FILES = /<!--files-->/;
const DAY = /^\d{4}-\d\d-\d\d$/;

function stop(message) {
  console.error(message);
  process.exit(1);
}

const load = (file) => loadJSON(file, stop);
const problems = [];
const P = context(SITE, stop, problems);
const data = load(path.join(ROOT, "data", "societies.json"));
const {captures, societies} = data;
const sites = new Set((load(path.join(SITE, "sites", "sites.json")).sites || []).map((s) => s.id));
const key = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, "");

function checkSources(list, at) {
  for (const [source, ref] of list || []) {
    if (!P.sources[source] || (typeof ref === "string" ? !P.pictures.has(ref) : !captures[ref])) {
      problems.push(`${at}: source ${JSON.stringify(source)}, capture or picture ${JSON.stringify(ref)} is unknown`);
    }
  }
}
const ids = new Set();
for (const [n, s] of societies.entries()) {
  const at = `data/societies.json, society ${n + 1} (${s.name})`;
  if (!s.id || ids.has(s.id) || !s.name) problems.push(`${at}: needs a name and an id no other society has`);
  ids.add(s.id);
  if (s.site && !sites.has(s.site)) problems.push(`${at}: names site ${JSON.stringify(s.site)}, which sites.json does not hold`);
  if (!s.sources || !s.sources.length) problems.push(`${at}: names no source`);
  checkSources(s.sources, at);
  for (const field of ["founded", "founder", "leader", "skill_rank", "people_rank", "websites", "land", "members"]) {
    for (const fact of s[field] || []) {
      checkSources(fact.sources, `${at}, ${field}`);
      if (fact.seen && !fact.seen.every((d) => DAY.test(d))) problems.push(`${at}, ${field}: its days should be YYYY-MM-DD`);
    }
  }
}
if (problems.length) {
  stop(`${problems.length} problem(s) in the Societies data. Nothing was written.\n  ${problems.slice(0, 50).join("\n  ")}`);
}

// The Hall of Fame records of each society and each player, by name with case and punctuation aside.
const hallBySociety = new Map();
const hallByPlayer = new Map();
for (const r of P.hall.records) {
  if (r.society) hallBySociety.set(key(r.society), (hallBySociety.get(key(r.society)) || 0) + 1);
  if (r.player) hallByPlayer.set(key(r.player), (hallByPlayer.get(key(r.player)) || 0) + 1);
}

// A fact's sources: each source with the captures or pictures that show it, behind a question mark.
function sourcesHTML(list) {
  const bySource = new Map();
  for (const [source, ref] of list) bySource.set(source, [...(bySource.get(source) || []), ref]);
  return [...bySource].map(([source, refs]) => {
    if (typeof refs[0] === "string") {
      return `<span class="e">${esc(P.sources[source].name)}: ${refs.map((id) => `<a href="../media/${esc(id)}/">picture ${esc(id)}</a>`).join(", ")}</span>`;
    }
    return `<span class="e">${esc(P.sources[source].name)}, captured ${refs.map((c) => {
      const m = captures[c].match(/\/web\/(\d{4})(\d\d)(\d\d)/);
      return `<a href="${esc(captures[c])}" target="_blank" rel="noopener">${m[1]}-${m[2]}-${m[3]}</a>`;
    }).join(", ")}</span>`;
  }).join("");
}
const mark = (list) => P.mark(sourcesHTML(list));
const seen = (s) => (!s ? "" : s[0] === s[1] ? s[0] : `${s[0]} to ${s[1]}`);
const years = (s) => (!s ? "" : s[0].slice(0, 4) === s[1].slice(0, 4) ? s[0].slice(0, 4) : `${s[0].slice(0, 4)} to ${s[1].slice(0, 4)}`);
const sourceKeys = (s) => [...new Set(s.sources.map((x) => x[0]))];

// One row of facts: a label, and each value a source gave with its question mark and the days it was seen.
function factRow(label, facts, show = (v) => esc(v)) {
  if (!facts || !facts.length) {
    return "";
  }
  return `<tr><th scope="row">${esc(label)}</th><td>${facts.map((f) => `<span class="s-fact">${show(f.value)} ${mark(f.sources)}${f.seen ? ` <span class="s-seen">${esc(seen(f.seen))}</span>` : ""}</span>`).join("")}</td></tr>`;
}
function websitesRow(s) {
  return factRow("Website", (s.websites || []).map((w) => ({...w, value: w.url})), (url) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ""))}</a>`);
}
function landHTML(s) {
  if (!s.land) {
    return "";
  }
  const rows = s.land.map((l) => `<tr><td>${esc(l.deed || "")}${l.land ? `, ${esc(l.land)}` : ""}</td><td>${esc(l.continent || "")}</td><td class="n">${esc(l.lon || "")}</td><td class="n">${esc(l.lat || "")}</td>`
    + `<td class="n">${l.size ? `${esc(l.size)} km²` : ""}</td><td class="n">${esc(l.hunting_tax || "")}${l.hunting_tax ? "%" : ""}</td><td class="n">${esc(l.mining_tax || "")}${l.mining_tax ? "%" : ""}</td><td class="q">${mark(l.sources)}</td></tr>`).join("");
  return `<h3>Land</h3><div class="s-scroll"><table class="s-table"><thead><tr><th>Deed</th><th>Continent</th><th class="n">Lon.</th><th class="n">Lat.</th><th class="n">Size</th><th class="n">Hunting tax</th><th class="n">Mining tax</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function membersHTML(s) {
  if (!s.members) {
    return "";
  }
  const rows = s.members.map((m) => {
    const hall = hallByPlayer.get(key(m.player));
    const name = hall ? `<a href="../halloffame/?q=${encodeURIComponent(m.player).replace(/%20/g, "+")}">${esc(m.player)}</a>` : esc(m.player);
    const ranks = (m.ranks || []).map((r) => `${esc(r.value)}${r.seen ? ` <span class="s-seen">${esc(seen(r.seen))}</span>` : ""}`).join("; ");
    return `<tr><td>${name}</td><td>${ranks}</td><td class="d">${esc(seen(m.seen))}</td><td class="q">${mark(m.sources)}</td></tr>`;
  }).join("");
  return `<h3>Members seen</h3><div class="s-scroll"><table class="s-table"><thead><tr><th>Player</th><th>Society rank</th><th>Seen</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function societyHTML(s) {
  const hall = hallBySociety.get(key(s.name)) || (s.as || []).reduce((n, a) => n + (hallBySociety.get(key(a)) || 0), 0);
  const text = [s.name, ...(s.as || []), ...(s.members || []).map((m) => m.player), ...(s.leader || []).map((f) => f.value),
    ...(s.founder || []).map((f) => f.value)].join(" ").toLowerCase();
  const facts = [
    s.as ? `<tr><th scope="row">Also printed</th><td>${s.as.map(esc).join(", ")}</td></tr>` : "",
    factRow("Founded", s.founded), factRow("Founder", s.founder), factRow("Leader", s.leader), websitesRow(s),
    factRow("Skill rank", s.skill_rank), factRow("People rank", s.people_rank),
    hall ? `<tr><th scope="row">Hall of Fame</th><td><a href="../halloffame/?q=${encodeURIComponent(s.name).replace(/%20/g, "+")}">${hall} ${hall === 1 ? "record" : "records"}</a></td></tr>` : "",
    s.site ? `<tr><th scope="row">On Sites</th><td><a href="../sites/#${esc(s.site)}">Its entry on the Sites page</a></td></tr>` : "",
    `<tr><th scope="row">Named by</th><td>${mark(s.sources)} <span class="s-seen">${esc(seen(s.seen))}</span></td></tr>`,
  ].join("");
  const count = (s.members || []).length;
  const leader = (s.leader || []).at(-1);
  return `<li class="item" id="${esc(s.id)}" data-s="${esc(sourceKeys(s).join(" "))}" data-m="${count ? 1 : 0}" data-w="${s.websites ? 1 : 0}" data-text="${esc(text)}">`
    + `<span class="s-name">${esc(s.name)}</span><span class="s-leader">${leader ? esc(leader.value) : ""}</span>`
    + `<span class="s-count">${count ? `${count} seen` : ""}</span><span class="s-count">${hall ? `${hall} ${hall === 1 ? "record" : "records"}` : ""}</span>`
    + `<span class="s-years">${esc(years(s.seen))}</span>`
    + `<div class="i-more"><table class="s-facts"><tbody>${facts}</tbody></table>${membersHTML(s)}${landHTML(s)}</div></li>`;
}

const used = [...new Set(societies.flatMap(sourceKeys))];
const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
const body = `<p class="s-intro">The societies players formed, as the game's own Hall of Fame window, PE WikiCharts and Entropia Loot named them, ${societies.length.toLocaleString("en")} in all: who was seen in each and when, who led and founded it, its website and its land. A society is one name, its case and punctuation aside.</p>
<div class="filters" role="search">
<label>Source <select class="fsel" data-filter="s"><option value="">Any</option>${used.map((k) => option(k, P.sources[k].name)).join("")}</select></label>
<label>Shows <select class="fsel" data-filter="h"><option value="">Any</option>${option("m", "Members seen")}${option("w", "A website")}</select></label>
<label class="i-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Society, member or leader"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${societies.length} of ${societies.length} societies</p>
<div class="i-cols" aria-hidden="true"><span>Name</span><span>Leader</span><span>Members</span><span>Hall of Fame</span><span>Seen</span></div>
<ol class="items">
${societies.map(societyHTML).join("\n")}
</ol>
<p class="nomatch" hidden>Nothing matches these filters.</p>`;

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (!APP.test(template) || !FILES.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into and one <!--files--> for the data links");
}
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, "data"), {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`)
  .replace(FILES, () => `<a href="data/societies.json">societies.json</a>, with <a href="../items/sources.json">sources.json</a>.`));
for (const name of ["societies.js", "societies.css"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
fs.copyFileSync(path.join(ROOT, "data", "societies.json"), path.join(OUT, "data", "societies.json"));
console.log(`Drew ${societies.length} societies into ${OUT}`);
