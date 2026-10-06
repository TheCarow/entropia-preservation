/* Entropia Archive articles: node render-articles.js [folder] draws articles.json into <folder>/articles/index.html
   (default: _out beside this file), beside articles.js, articles.css and articles.json. The whole list is in the page,
   so it reads in full without JavaScript; articles.js only filters it. A mistake in articles.json, a gallery source or
   a version that does not exist, stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "articles");
const APP = /<div id="app"><\/div>/;
const TYPES = ["Press release", "Interview", "Preview", "Review", "Feature", "Guide", "Lore", "News", "Event", "Update", "Screenshots", "Magazine"];
const LANGUAGES = {cs: "Czech", de: "German", en: "English", fi: "Finnish", fr: "French", hu: "Hungarian", it: "Italian", ja: "Japanese",
  lt: "Lithuanian", pl: "Polish", pt: "Portuguese", sk: "Slovak", sv: "Swedish"};
const DAY = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(~)?$/;

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (text) => String(text).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const read = (file) => fs.readFileSync(file, "utf8");

function stop(message) {
  console.error(message);
  process.exit(1);
}

// "2001-06-07", "2001-06", "2001", each with "~" when approximate; "../2001-06-07" for on or before; "A/B" between.
function parseDate(value) {
  if (value === null) {
    return {sort: "9999", years: null, text: "Undated"};
  }
  const part = (text) => {
    const m = DAY.exec(text);
    if (!m) {
      return null;
    }
    const [, y, mo, d, about] = m;
    const shown = [y, mo, d].filter(Boolean).join("-");
    return {sort: [y, mo || "00", d || "00"].join("-"), year: Number(y), text: about ? `about ${shown}` : shown};
  };
  if (value.startsWith("../")) {
    const end = part(value.slice(3));
    return end && {sort: end.sort, years: [end.year, end.year], text: `by ${end.text}`};
  }
  if (value.includes("/")) {
    const [a, b] = value.split("/").map(part);
    return a && b && {sort: a.sort, years: [a.year, b.year], text: `${a.text} to ${b.text}`};
  }
  const one = part(value);
  return one && {sort: one.sort, years: [one.year, one.year], text: one.text};
}

let data;
try {
  data = JSON.parse(read(path.join(ROOT, "articles.json")));
} catch (error) {
  stop(`articles.json could not be read: ${error.message}. Nothing was written.`);
}
const media = JSON.parse(read(path.join(SITE, "media", "media.json")));
const sources = new Set(media.images.flatMap((i) => i.variants.flatMap((v) => v.originals.flatMap((o) => (o.sources || []).map((s) => slug(s.name))))));
const versionData = JSON.parse(read(path.join(SITE, "versions.json")));
const versions = new Set(Object.keys(versionData.versions));
// A link into Clients opens the version's notes or files where the version has them, and its row where it does not.
const withNotes = new Set([...read(path.join(SITE, "notes.md")).matchAll(/^## VU (.+?)\s*$/gm)].map((m) => m[1]));
const withFiles = new Set(versionData.files.map((f) => f.version));
const clientsAnchor = (a) => {
  const part = a.type === "Magazine" ? (withFiles.has(a.clients) ? "-files" : "") : (withNotes.has(a.clients) ? "-notes" : "");
  // The same anchor the Clients page gives a version (draw.js anchorOf).
  return `vu-${a.clients.toLowerCase().replace(/\s+/g, "-")}${part}`;
};

const problems = [];
const seen = new Set();
const articles = (data.articles || []).map((a, n) => {
  const at = `article ${a.id || n + 1}`;
  if (!/^[a-z0-9-]+$/.test(a.id || "")) problems.push(`${at}: its id should be lowercase letters, digits and hyphens`);
  if (seen.has(a.id)) problems.push(`${at}: the id is used twice`);
  seen.add(a.id);
  for (const field of ["title", "outlet", "summary"]) {
    if (!a[field]) problems.push(`${at}: no ${field}`);
  }
  if (!TYPES.includes(a.type)) problems.push(`${at}: type ${JSON.stringify(a.type)} is not one of ${TYPES.join(", ")}`);
  if (!LANGUAGES[a.language]) problems.push(`${at}: language ${JSON.stringify(a.language)} has no name here`);
  const date = parseDate(a.date === undefined ? null : a.date);
  if (!date) problems.push(`${at}: date ${JSON.stringify(a.date)} is not a date this page reads`);
  for (const link of a.links || []) {
    if (!link.label || !/^https?:\/\//.test(link.url || "")) problems.push(`${at}: a link needs a label and an http address`);
  }
  if (a.media && !sources.has(a.media)) problems.push(`${at}: media source ${a.media} names no source in media.json`);
  if (a.clients && !versions.has(a.clients)) problems.push(`${at}: VU ${a.clients} is not in versions.json`);
  if (/[–—]/.test(JSON.stringify(a))) problems.push(`${at}: uses an en or em dash`);
  return {...a, when: date || {sort: "9999", years: null, text: "Undated"}};
});
if (problems.length) {
  stop(`${problems.length} problem(s) in articles.json. Nothing was written.\n  ${problems.join("\n  ")}`);
}
articles.sort((a, b) => a.when.sort.localeCompare(b.when.sort) || a.title.localeCompare(b.title));

const count = (list, key) => list.reduce((m, a) => m.set(a[key], (m.get(a[key]) || 0) + 1), new Map());
const years = [...new Set(articles.flatMap((a) => (a.when.years ? [a.when.years[0], a.when.years[1]] : [])))].sort();
const allYears = years.length ? Array.from({length: years.at(-1) - years[0] + 1}, (_, n) => years[0] + n) : [];
const types = count(articles, "type");
const languages = count(articles, "language");
const option = (value, text) => `<option value="${esc(value)}">${esc(text)}</option>`;

function articleHTML(a) {
  const main = a.links && a.links[0];
  const title = main ? `<a href="${esc(main.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>` : esc(a.title);
  const links = (a.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`);
  if (a.media) {
    links.push(`<a href="../media/?source=${esc(a.media)}">Pictures in the media archive</a>`);
  }
  if (a.clients) {
    links.push(`<a href="../clients/#${esc(clientsAnchor(a))}">VU ${esc(a.clients)} on Clients</a>`);
  }
  const text = [a.title, a.outlet, a.author || "", a.summary].join(" ").toLowerCase();
  const span = a.when.years ? `data-from="${a.when.years[0]}" data-to="${a.when.years[1]}"` : "";
  return `<li class="article" id="${esc(a.id)}" data-type="${esc(a.type)}" data-lang="${esc(a.language)}" ${span} data-text="${esc(text)}">
<div class="a-head"><span class="a-date">${esc(a.when.text)}</span><span class="a-outlet">${esc(a.outlet)}</span><span class="a-type">${esc(a.type)}</span></div>
<h3 class="a-title">${title}</h3>
<p class="a-summary">${esc(a.summary)}</p>${a.note ? `\n<p class="a-note">${esc(a.note)}</p>` : ""}
${links.length ? `<div class="a-links">${links.join(" ")}</div>` : ""}</li>`;
}

const groups = new Map();
for (const a of articles) {
  const key = a.when.years ? String(a.when.years[0]) : "Undated";
  groups.set(key, [...(groups.get(key) || []), a]);
}
const listHTML = [...groups].map(([key, list]) => `<section class="a-year" data-year="${esc(key)}"><h2>${esc(key)}</h2>
<ol class="articles">
${list.map(articleHTML).join("\n")}
</ol></section>`).join("\n");

const body = `<div class="filters" role="search">
<div class="a-types" role="group" aria-label="Types">${TYPES.filter((t) => types.has(t)).map((t) => `<label class="a-type-box"><input type="checkbox" data-type="${esc(t)}" checked> ${esc(t)} <span class="muted">(${types.get(t)})</span></label>`).join("")}</div>
<label>From <select class="fsel" data-filter="from" aria-label="From year"><option value="">any</option>${allYears.map((y) => option(y, y)).join("")}</select></label>
<label>to <select class="fsel" data-filter="to" aria-label="To year"><option value="">any</option>${allYears.map((y) => option(y, y)).join("")}</select></label>
<label>Language <select class="fsel" data-filter="lang"><option value="">Any</option>${[...languages].sort((a, b) => LANGUAGES[a[0]].localeCompare(LANGUAGES[b[0]])).map(([l, n]) => option(l, `${LANGUAGES[l]} (${n})`)).join("")}</select></label>
<label class="a-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Outlet, title, person"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${articles.length} of ${articles.length} articles</p>
${listHTML}
<p class="nomatch" hidden>No articles match these filters.</p>`;

const template = read(path.join(ROOT, "index.html"));
if (!APP.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into");
}
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`));
for (const name of ["articles.js", "articles.css", "articles.json"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
console.log(`Drew ${articles.length} articles into ${OUT}`);
