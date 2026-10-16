/* Entropia Archive items: node render-items.js [folder] draws data/<category>.json into <folder>/items/index.html
   (default: _out beside this file), beside items.js, items.css, sources.json and the data files. Every item is in the
   page, so it reads in full without JavaScript; items.js only filters it. A mistake in the data stops it before
   writing. */
"use strict";
const fs = require("fs");
const path = require("path");

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

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const read = (file) => fs.readFileSync(file, "utf8");

function stop(message) {
  console.error(message);
  process.exit(1);
}

function load(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    return stop(`${path.relative(SITE, file)} could not be read: ${error.message}. Nothing was written.`);
  }
}

// The two-part versions in release order: the VUs an item can be seen in.
const versions = load(path.join(SITE, "versions.json")).versions;
const VUS = Object.keys(versions).filter((k) => /^\d+\.\d+$/.test(k) && versions[k].date)
  .sort((a, b) => versions[a].date.localeCompare(versions[b].date));
const RANK = new Map(VUS.map((v, n) => [v, n]));
// A day's VU is the last two-part version released on or before it; the data stores the day alone.
const vuOn = (day) => VUS.filter((v) => versions[v].date <= day).pop();
const sources = load(path.join(ROOT, "sources.json")).sources || {};
for (const [key, source] of Object.entries(sources)) {
  if (/[–—]/.test(JSON.stringify(source))) stop(`sources.json: ${key} uses an en or em dash. Nothing was written.`);
}
const reasons = (sources.owner && sources.owner.reasons) || {};
// Each picture is described once, and each armour set's colours once, in icons.json; an item names the file.
const pictures = load(path.join(ROOT, "icons.json"));
const ICON_FILE = /^[a-z0-9-]+_(reconstructed_\d{4}|client_[0-9.]+)\.png$/;
const pictureProblems = [];
for (const [file, picture] of Object.entries(pictures.icons || {})) {
  // An icon's file name says what it is: <name>_client_<key>.png, a picture a client stores, or
  // <name>_reconstructed_<year>.png, one drawn since, so a drawing is never taken for the game's own.
  if (!ICON_FILE.test(file) || !fs.existsSync(path.join(ROOT, "icons", file))) pictureProblems.push(`icons.json: ${file} is not a PNG in icons/ named <name>_client_<key>.png or <name>_reconstructed_<year>.png`);
  if (!sources[picture.source]) pictureProblems.push(`icons.json: ${file}'s source ${JSON.stringify(picture.source)} is not in sources.json`);
  if (picture.look !== undefined && !(pictures.looks || {})[picture.look]) pictureProblems.push(`icons.json: ${file}'s look ${JSON.stringify(picture.look)} is not in its looks`);
}
// The Archive's own words carry no en or em dash; what a source says is quoted as it wrote it, dashes and all.
if (/[–—]/.test(JSON.stringify(pictures))) pictureProblems.push("icons.json uses an en or em dash");
const iconFile = (icon) => (typeof icon === "string" ? icon : icon && icon.file);
// Each Wayback capture a fact was read from is listed once in captures.json, by a key that is its timestamp and page,
// under the host spelling Wayback filed it by; a fact cites the key, the capture's day is its timestamp's, and its
// address is https://web.archive.org/web/<timestamp>/<host>/<page>.
const CAPTURE = /^(\d{4})(\d\d)(\d\d)\d{6}\//;
const captures = {};
for (const [host, keys] of Object.entries(load(path.join(ROOT, "captures.json")).captures || {})) {
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/.test(host)) pictureProblems.push(`captures.json: ${host} is not a host`);
  for (const key of keys) {
    if (!CAPTURE.test(key) || captures[key]) pictureProblems.push(`captures.json: ${key} is not a capture key, or is listed twice`);
    captures[key] = `https://web.archive.org/web/${key.slice(0, 14)}/${host}/${key.slice(15)}`;
  }
}
const captureDay = (key) => key.replace(CAPTURE, "$1-$2-$3").slice(0, 10);
// The days a dated citation shows its fact on: those of its first and last captures.
const citationDays = (c) => (typeof c !== "string" && c.first ? [captureDay(c.first), captureDay(c.last)] : null);
// A dated sighting keeps its own day only where it is not its capture's.
const seenDays = (x) => [x.first || (x.first_capture && captureDay(x.first_capture)), x.last || (x.last_capture && captureDay(x.last_capture))];

const problems = [];
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
    // A fact several sources give is stored once with its citations: a source's key, or an object carrying the days
    // that source shows the one fact on (the private editor's tools/itemdata.py describes the layout).
    const shared = [...(item.names || []), ...(item.descriptions || []), ...(item.records || [])];
    const citations = shared.flatMap((entry) => entry.sources || []);
    const file = iconFile(item.icon);
    const facts = [...citations.map((c) => (typeof c === "string" ? {source: c} : c)), ...(item.seen || []), ...(item.tt || []),
      ...(file && pictures.icons[file] ? [pictures.icons[file]] : []), ...(item.icon && item.icon.assigned ? [item.icon.assigned] : [])];
    if (item.unused !== undefined && !reasons[item.unused]) problems.push(`${at}: unused ${JSON.stringify(item.unused)} is not one of the owner's reasons in sources.json`);
    if (item.icon && !(pictures.icons || {})[file]) problems.push(`${at}: icon ${JSON.stringify(file)} is not in icons.json`);
    if (item.icon && item.icon.shared_from !== undefined && !ID.test(item.icon.shared_from)) problems.push(`${at}: shared_from should be an item id`);
    if (!facts.length && !item.unused) problems.push(`${at}: nothing about it has a source`);
    for (const entry of shared) {
      if (!Array.isArray(entry.sources) || !entry.sources.length) problems.push(`${at}: a name, description or record cites no source`);
    }
    for (const n of item.names || []) {
      if (typeof n.name !== "string" || !n.name) problems.push(`${at}: a name entry has no name`);
    }
    for (const d of item.descriptions || []) {
      if (typeof d.text !== "string" || !d.text) problems.push(`${at}: a description entry has no text`);
    }
    for (const fact of facts) {
      if (!sources[fact.source]) problems.push(`${at}: source ${JSON.stringify(fact.source)} is not in sources.json`);
      for (const field of ["first", "last", "capture", "first_capture", "last_capture"]) {
        if (fact[field] !== undefined && field !== "first" && field !== "last" && !captures[fact[field]]) problems.push(`${at}: ${field} ${JSON.stringify(fact[field])} is not in captures.json`);
      }
    }
    for (const r of item.records || []) {
      if (r.capture !== undefined && !captures[r.capture]) problems.push(`${at}: record capture ${JSON.stringify(r.capture)} is not in captures.json`);
    }
    for (const c of citations) {
      if (typeof c === "string") {
        continue;
      }
      const days = citationDays(c);
      if (!c.first || !captures[c.first] || !captures[c.last] || days[1] < days[0] || !vuOn(days[0])) {
        problems.push(`${at}: a dated citation needs its first and last captures, in order, within the versions`);
      }
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
      if (!/^\d+\.\d+$/.test(t.ped || "") || !captures[t.capture]) problems.push(`${at}: a TT value needs ped and the capture it was read off`);
    }
    // The Archive's own words carry no en or em dash; what a source says is quoted as it wrote it, dashes and all.
    const own = [item.type, item.icon && item.icon.assigned && item.icon.assigned.basis];
    if (own.some((text) => /[–—]/.test(text || ""))) problems.push(`${at}: the Archive's own text uses an en or em dash`);
    return item;
  });
  return {key, name: data.category, items};
});
// Every picture is one some item wears.
const worn = new Set(categories.flatMap((c) => c.items.map((i) => iconFile(i.icon)).filter(Boolean)));
for (const file of Object.keys(pictures.icons || {})) {
  if (!worn.has(file)) pictureProblems.push(`icons.json: no item wears ${file}`);
}
problems.push(...pictureProblems);
if (problems.length) {
  stop(`${problems.length} problem(s) in the items data. Nothing was written.\n  ${problems.slice(0, 50).join("\n  ")}`);
}

// The VUs a citation covers: its source's own VU (a client), or the days it carries (PE Auction); none for a source
// that gives no VU by itself.
function citationVus(citation) {
  if (typeof citation === "string") {
    const vu = sources[citation].vu;
    return vu ? [vu, vu] : null;
  }
  const days = citationDays(citation);
  return days ? [vuOn(days[0]), vuOn(days[1])] : null;
}

function widest(pairs) {
  const known = pairs.filter(Boolean);
  if (!known.length) {
    return null;
  }
  const first = known.map((p) => p[0]).sort((a, b) => RANK.get(a) - RANK.get(b))[0];
  const last = known.map((p) => p[1]).sort((a, b) => RANK.get(b) - RANK.get(a))[0];
  return {first, last};
}

// An item was seen from the earliest VU any source shows it in to the latest: its dated and inferred sightings, and
// every client that names it.
function span(item) {
  const cited = [...(item.names || []), ...(item.descriptions || []), ...(item.records || [])]
    .flatMap((entry) => entry.sources).map(citationVus);
  return widest([...(item.seen || []).map((x) => (x.first_capture ? seenDays(x).map(vuOn) : [x.first_vu, x.last_vu])), ...cited]);
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

// The flavour text an item carried in VU 5.4, as the 5.4 client's description gives it.
const flavour = (item) => (item.descriptions || []).find((d) => d.sources.includes("client-5.4"));

function itemHTML(category, item) {
  const s = span(item);
  const tt = [...(item.tt || [])].sort((a, b) => a.capture.localeCompare(b.capture)).pop();
  const seen = s ? vus(s.first, s.last) : "";
  // The names the page can show by VU, each over the VUs its citations cover, in the order they were first used.
  const names = (item.names || []).map((n) => [n.name, widest(n.sources.map(citationVus))])
    .filter((n) => n[1]).map(([name, w]) => [name, RANK.get(w.first), RANK.get(w.last)]);
  names.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
  // With no VU chosen an item shows the name it carried last.
  const shown = names.length ? [...names].sort((a, b) => a[2] - b[2] || a[1] - b[1]).pop()[0] : item.name;
  const text = [item.name, ...(item.names || []).map((n) => n.name), ...(item.also || []), item.type, category.name].join(" ").toLowerCase();
  const range = s ? ` data-a="${RANK.get(s.first)}" data-b="${RANK.get(s.last)}"` : "";
  const dated = names.length ? ` data-names="${esc(JSON.stringify(names))}"` : "";
  const text54 = flavour(item);
  return `<li class="item${text54 ? " has-desc" : ""}" id="${esc(item.id)}" data-cat="${category.key}" data-type="${esc(item.type)}"${range}${dated} data-text="${esc(text)}"${item.unused ? " data-unused" : ""}>`
    + iconHTML(item.icon)
    + `<span class="i-name">${esc(shown)}</span><span class="i-type">${esc(item.type)}</span>`
    + `<span class="i-tt">${tt ? `${esc(tt.ped)} PED` : ""}</span><span class="i-seen">${esc(seen)}</span>`
    + `<a class="permalink" href="#${esc(item.id)}" title="Link to this item">#</a>`
    + (text54 ? `<p class="i-desc"><span class="i-desc-vu">VU 5.4</span> ${esc(text54.text)}</p>` : "") + "</li>";
}

// An item flagged unused (judged never in the game) is in the page but hidden, and counts only when shown.
const inUse = (c) => c.items.filter((i) => !i.unused).length;
const total = categories.reduce((n, c) => n + inUse(c), 0);
const option = (value, text) => `<option value="${esc(value)}">${esc(text)}</option>`;
const types = categories.map((c) => `<optgroup label="${esc(c.name)}" data-cat="${c.key}">${[...new Set(c.items.map((i) => i.type))]
  .sort((a, b) => a.localeCompare(b, "en", {sensitivity: "base"})).map((t) => `<option value="${esc(`${c.key}:${t}`)}">${esc(t)}</option>`).join("")}</optgroup>`).join("");
const used = new Set(categories.flatMap((c) => c.items.flatMap((i) => {
  const s = span(i);
  return s ? VUS.slice(RANK.get(s.first), RANK.get(s.last) + 1) : [];
})));
const listHTML = categories.map((c) => `<section class="i-group" id="${c.key}"><h2>${esc(c.name)} <span class="i-count">${inUse(c)}</span></h2>
<div class="i-cols" aria-hidden="true"><span></span><span>Name</span><span>Type</span><span>TT value</span><span>Seen</span><span></span></div>
<ol class="items">
${c.items.map((i) => itemHTML(c, i)).join("\n")}
</ol></section>`).join("\n");
const body = `<div class="filters" role="search">
<label>Category <select class="fsel" data-filter="cat"><option value="">Any</option>${categories.map((c) => option(c.key, c.name)).join("")}</select></label>
<label>Type <select class="fsel" data-filter="type"><option value="">Any</option>${types}</select></label>
<label>Seen in <select class="fsel" data-filter="vu" aria-label="Seen in VU"><option value="">any VU</option>${VUS.filter((v) => used.has(v)).map((v) => `<option value="${v}" data-rank="${RANK.get(v)}">VU ${v}</option>`).join("")}</select></label>
<label class="i-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Name or other spelling"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${total} of ${total} items</p>
${listHTML}
<p class="nomatch" hidden>Nothing matches these filters.</p>`;

const template = read(path.join(ROOT, "index.html"));
if (!APP.test(template) || !FILES.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into and one <!--files--> for the data links");
}
const files = [...categories.map((c) => `<a href="data/${c.key}.json">${c.key}.json</a>`), `<a href="icons.json">icons.json</a>`,
  `<a href="captures.json">captures.json</a>`, `<a href="sources.json">sources.json</a>`].join(", ");
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, "data"), {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`)
  .replace(FILES, () => `${files}.`));
fs.cpSync(path.join(ROOT, "icons"), path.join(OUT, "icons"), {recursive: true});
for (const name of ["items.js", "items.css", "sources.json", "icons.json", "captures.json"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
for (const c of categories) {
  fs.copyFileSync(path.join(ROOT, "data", `${c.key}.json`), path.join(OUT, "data", `${c.key}.json`));
}
console.log(`Drew ${total} items in ${categories.length} categories into ${OUT}`);
