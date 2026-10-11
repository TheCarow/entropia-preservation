/* Entropia Archive sites and tools: node render-sites.js [folder] draws sites.json into <folder>/sites/index.html
   (default: _out beside this file), beside sites.js, sites.css and sites.json. The whole list is in the page, so it
   reads in full without JavaScript; sites.js only filters it. A mistake in sites.json, or a media source that names no picture,
   stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "sites");
const APP = /<div id="app"><\/div>/;
const BY = {mindark: "MindArk", players: "Players"};
const KINDS = ["Company", "Official site", "Forum", "News", "Wiki", "Market", "Web tool", "Program", "Spreadsheet", "Guide", "Society", "Fan page", "Blog", "Tribute"];
// The kinds the Sites/Tools filter counts as tools; every other kind is a site.
const TOOLS = new Set(["Web tool", "Program", "Spreadsheet"]);
const STATUS = {archived: "Archived", partial: "Partial", lost: "Lost", live: "Live"};
const YEAR = /^(19|20)\d\d$/;

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (text) => String(text).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const read = (file) => fs.readFileSync(file, "utf8");
// A link out of the site opens in a new tab; one to another of its pages ("../clients/") does not.
const link = (url, text) => (/^https?:\/\//.test(url)
  ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : `<a href="${esc(url)}">${esc(text)}</a>`);

function stop(message) {
  console.error(message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(read(path.join(ROOT, "sites.json")));
} catch (error) {
  stop(`sites.json could not be read: ${error.message}. Nothing was written.`);
}
// A site's pictures are those with a source of the site's media name, or that name with a poster in brackets: the
// same grouping the media page's Source filter makes (draw-media.js), so the link shows what the count says.
const media = JSON.parse(read(path.join(SITE, "media", "media.json")));
const pictureSources = media.images.map((i) => new Set(i.variants.flatMap((v) => v.originals.flatMap((o) => (o.sources || []).map((s) => s.name)))));
const pictures = (name) => pictureSources.filter((names) => [...names].some((s) => s === name || s.startsWith(`${name} (`))).length;

const problems = [];
const seen = new Set();
const sites = (data.sites || []).map((s, n) => {
  const at = `site ${s.id || n + 1}`;
  if (!/^[a-z0-9-]+$/.test(s.id || "")) problems.push(`${at}: its id should be lowercase letters, digits and hyphens`);
  if (seen.has(s.id)) problems.push(`${at}: the id is used twice`);
  seen.add(s.id);
  for (const field of ["name", "summary"]) {
    if (!s[field]) problems.push(`${at}: no ${field}`);
  }
  if (s.maker !== undefined && (typeof s.maker !== "string" || !s.maker.trim())) problems.push(`${at}: maker should be text`);
  if (s.approx !== undefined && typeof s.approx !== "boolean") problems.push(`${at}: approx should be true or false`);
  if (!Array.isArray(s.addresses || []) || (s.addresses || []).some((a) => typeof a !== "string" || /^https?:/.test(a))) {
    problems.push(`${at}: addresses should be a list of addresses without http://`);
  }
  // Without a start year an entry would sit under Later tributes, which is only for present-day tributes.
  if (s.by === "players" && !s.from && s.kind !== "Tribute") problems.push(`${at}: needs a from year (only a Tribute may have none)`);
  if (!BY[s.by]) problems.push(`${at}: by ${JSON.stringify(s.by)} should be "mindark" or "players"`);
  if (!KINDS.includes(s.kind)) problems.push(`${at}: kind ${JSON.stringify(s.kind)} is not one of ${KINDS.join(", ")}`);
  if (!STATUS[s.status]) problems.push(`${at}: status ${JSON.stringify(s.status)} is not one of ${Object.keys(STATUS).join(", ")}`);
  for (const field of ["from", "to"]) {
    if (s[field] !== null && s[field] !== undefined && !YEAR.test(s[field])) problems.push(`${at}: ${field} should be a year or null`);
  }
  if (s.from && s.to && s.to < s.from) problems.push(`${at}: it ends before it starts`);
  if (s.to && !s.from) problems.push(`${at}: it has an end year but no start`);
  for (const l of [...(s.links || []), ...(s.evidence || [])]) {
    if (!l.label || !/^(https?:\/\/|\.\.\/)/.test(l.url || "")) problems.push(`${at}: a link needs a label and an http or ../ address`);
  }
  if (s.status === "lost" && !(s.evidence || []).length) problems.push(`${at}: a lost site needs evidence that it existed`);
  for (const name of s.media || []) {
    if (!pictures(name)) problems.push(`${at}: media source ${JSON.stringify(name)} names no picture in media.json`);
  }
  if (/[–—]/.test(JSON.stringify(s))) problems.push(`${at}: uses an en or em dash`);
  return s;
});
if (problems.length) {
  stop(`${problems.length} problem(s) in sites.json. Nothing was written.\n  ${problems.join("\n  ")}`);
}
const order = (a, b) => (a.from || "9999").localeCompare(b.from || "9999") || a.name.localeCompare(b.name, "en", {sensitivity: "base"});
sites.sort(order);

function years(s) {
  const about = s.approx ? "c. " : "";
  if (!s.from) {
    return "present day";
  }
  if (!s.to) {
    return `from ${about}${s.from}`;
  }
  return s.from === s.to ? `${about}${s.from}` : `${about}${s.from} to ${s.to}`;
}

function siteHTML(s) {
  const links = (s.links || []).map((l) => link(l.url, l.label));
  (s.media || []).forEach((name, n) => {
    const shown = `${n === 0 ? "Pictures in the media archive" : `${name} pictures`} (${pictures(name)})`;
    links.splice(n === 0 && links.length ? 1 : links.length, 0, `<a href="../media/?source=${esc(slug(name))}">${esc(shown)}</a>`);
  });
  links.push(...(s.evidence || []).map((e) => link(e.url, `Known from: ${e.label}`)));
  const title = s.links && s.links.length ? link(s.links[0].url, s.name) : esc(s.name);
  const text = [s.name, s.kind, s.maker || "", s.summary, ...(s.addresses || [])].join(" ").toLowerCase();
  const span = s.from ? `data-from="${s.from}" data-to="${s.to || ""}"` : "";
  const maker = s.maker ? `<span class="s-maker">by ${esc(s.maker)}</span>` : "";
  return `<li class="site" id="${esc(s.id)}" data-by="${s.by}" data-type="${TOOLS.has(s.kind) ? "tools" : "sites"}" data-kind="${esc(s.kind)}" data-status="${s.status}" ${span} data-text="${esc(text)}">
<div class="s-head"><span class="s-years">${esc(years(s))}</span><span class="s-kind">${esc(s.kind)}</span><span class="s-status ${s.status}">${STATUS[s.status]}</span>${maker}</div>
<h3 class="s-name">${title}</h3>
<p class="s-summary">${esc(s.summary)}</p>${s.note ? `\n<p class="s-note">${esc(s.note)}</p>` : ""}
${(s.addresses || []).length ? `<p class="s-addr">${s.addresses.map(esc).join(", ")}</p>` : ""}
${links.length ? `<div class="s-links">${links.join(" ")}</div>` : ""}</li>`;
}

// MindArk's sites first, then the players' sites and tools by the year they began; a present-day tribute after them.
const groups = new Map();
for (const s of sites) {
  const key = s.by === "mindark" ? "Official sites" : s.from ? `Player sites and tools from ${s.from}` : "Later tributes";
  groups.set(key, [...(groups.get(key) || []), s]);
}
const keys = [...groups.keys()].sort((a, b) => {
  const rank = (k) => (k === "Official sites" ? "0" : k === "Later tributes" ? "9" : `1${k}`);
  return rank(a).localeCompare(rank(b));
});
const listHTML = keys.map((key) => `<section class="s-group"><h2>${esc(key)}</h2>
<ol class="sites">
${groups.get(key).map(siteHTML).join("\n")}
</ol></section>`).join("\n");

const allYears = sites.flatMap((s) => [s.from, s.to].filter(Boolean).map(Number));
const span = allYears.length ? Array.from({length: Math.max(...allYears) - Math.min(...allYears) + 1}, (_, n) => Math.min(...allYears) + n) : [];
const option = (value, text) => `<option value="${esc(value)}">${esc(text)}</option>`;
const kinds = KINDS.filter((k) => sites.some((s) => s.kind === k));
const body = `<div class="filters" role="search">
<label>Show <select class="fsel" data-filter="type"><option value="">Sites and tools</option>${option("sites", "Sites")}${option("tools", "Tools")}</select></label>
<label>Made by <select class="fsel" data-filter="by"><option value="">Anyone</option>${Object.entries(BY).map(([v, t]) => option(v, t)).join("")}</select></label>
<label>Kind <select class="fsel" data-filter="kind"><option value="">Any</option>${kinds.map((k) => option(k, k)).join("")}</select></label>
<label>Status <select class="fsel" data-filter="status"><option value="">Any</option>${Object.entries(STATUS).map(([v, t]) => option(v, t)).join("")}</select></label>
<label>From <select class="fsel" data-filter="from" aria-label="From year"><option value="">any</option>${span.map((y) => option(y, y)).join("")}</select></label>
<label>to <select class="fsel" data-filter="to" aria-label="To year"><option value="">any</option>${span.map((y) => option(y, y)).join("")}</select></label>
<label class="s-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Name, maker, address"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${sites.length} of ${sites.length} entries</p>
${listHTML}
<p class="nomatch" hidden>Nothing matches these filters.</p>`;

const template = read(path.join(ROOT, "index.html"));
if (!APP.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into");
}
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`));
for (const name of ["sites.js", "sites.css", "sites.json"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
console.log(`Drew ${sites.length} sites and tools into ${OUT}`);
