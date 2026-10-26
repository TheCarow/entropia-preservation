/* Entropia Archive auction: node render-auction.js [folder] draws data/items/<item id>.json into
   <folder>/auction/index.html (default: _out beside this file), beside auction.js, auction.css and the data. Every item
   with an auction is a row, with its sale count, the days its sales span and its last sale, so the list reads in full
   without JavaScript; auction.js filters it and opens an item's auctions, read from its data file, in a popup. Names,
   categories, types and pictures are the Items page's (../items/), and the sources its sources.json. A mistake in the
   data stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");
const {context, esc, load: loadJSON} = require("../items/provenance");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const DATA = path.join(ROOT, "data", "items");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "auction");
const APP = /<div id="app"><\/div>/;
const FILES = /<!--files-->/;
const WHEN = /^\d{4}-\d\d-\d\d \d\d:\d\d(:\d\d)?$/;
const CATEGORIES = [["weapons", "Weapons"], ["armor", "Armor"], ["attachments", "Attachments"], ["tools", "Tools"],
  ["clothing", "Clothing"], ["housing", "Housing"], ["blueprints", "Blueprints"], ["components", "Components"],
  ["materials", "Materials"], ["resources", "Resources"], ["misc", "Misc"]];

function stop(message) {
  console.error(message);
  process.exit(1);
}

const load = (file) => loadJSON(file, stop);
const problems = [];
const P = context(SITE, stop, problems);
const {VUS, RANK, vuOn, citationVus, widest} = P;
const versions = load(path.join(SITE, "versions.json")).versions;

const items = new Map();
for (const [key, name] of CATEGORIES) {
  for (const item of load(path.join(SITE, "items", "data", `${key}.json`)).items || []) {
    items.set(item.id, {item, key, category: name});
  }
}
// The name an item carried last, as the Items page shows it.
function shownName(item) {
  const names = (item.names || []).map((n) => [n.name, widest(n.sources.map(citationVus))]).filter((n) => n[1])
    .map(([name, w]) => [name, RANK.get(w.first), RANK.get(w.last)]);
  return names.length ? names.sort((a, b) => a[2] - b[2] || a[1] - b[1]).pop()[0] : item.name;
}
const iconFile = (icon) => (typeof icon === "string" ? icon : icon && icon.file);

const records = [];
for (const file of fs.readdirSync(DATA).filter((f) => f.endsWith(".json")).sort()) {
  const at = `data/items/${file}`;
  const data = load(path.join(DATA, file));
  const known = items.get(data.item);
  if (!known || `${data.item}.json` !== file) {
    problems.push(`${at}: names item ${JSON.stringify(data.item)}, which the Items page does not hold under that file name`);
    continue;
  }
  if (!["%", "TT+"].includes(data.markup)) problems.push(`${at}: markup should be "%" or "TT+"`);
  for (const source of data.sources || []) {
    if (!P.sources[source]) problems.push(`${at}: source ${JSON.stringify(source)} is not in ../items/sources.json`);
  }
  for (const url of data.captures || []) {
    if (!/^https:\/\/web\.archive\.org\/web\/\d{14}\//.test(url)) problems.push(`${at}: ${url} is not a Wayback capture`);
  }
  const check = (seen) => {
    for (const [s, when, c] of seen) {
      if (!data.sources[s] || !data.captures[c] || !WHEN.test(when)) problems.push(`${at}: a record's source, time or capture is wrong: ${JSON.stringify(seen)}`);
    }
  };
  for (const sale of data.sold || []) check(sale[4]);
  for (const auction of data.unsold || []) check(auction[3]);
  for (const [s, kind, value, a, b] of data.readings || []) {
    if (!data.sources[s] || !["%", "TT+"].includes(kind) || typeof value !== "number" || !data.captures[a] || !data.captures[b]) {
      problems.push(`${at}: a markup reading is wrong: ${JSON.stringify([s, kind, value, a, b])}`);
    }
  }
  for (const [, c, name] of data.charts || []) {
    if (!data.captures[c] || !fs.existsSync(path.join(ROOT, "charts", name))) problems.push(`${at}: chart ${name} is missing or has no capture`);
  }
  // The game's own markup windows: a Media picture, how the markup is given, and five periods of [markup or null, sales].
  for (const [media, kind, periods] of data.windows || []) {
    if (!P.pictures.has(media) || !["%", "TT+"].includes(kind) || !Array.isArray(periods) || periods.length !== 5
      || periods.some(([m, n]) => (m !== null && typeof m !== "number") || !Number.isInteger(n))) {
      problems.push(`${at}: a markup window is wrong: ${JSON.stringify([media, kind, periods])}`);
    }
  }
  records.push({data, ...known});
}
if (problems.length) {
  stop(`${problems.length} problem(s) in the auction data. Nothing was written.\n  ${problems.slice(0, 50).join("\n  ")}`);
}

const money = (n) => (n === null || n === undefined ? "" : n.toLocaleString("en", {minimumFractionDigits: 2, maximumFractionDigits: 2}));
// A sale's markup as PE Auction printed the item's: the bid as a share of the TT value, or the bid less it.
function markup(data, tt, bid) {
  if (tt === null || bid === null) return "";
  if (data.markup === "%") return tt > 0 ? `${(bid / tt * 100).toFixed(2)}%` : "";
  const plus = bid - tt;
  return `${plus < 0 ? "-" : "+"}${money(Math.abs(plus))} PED`;
}
const day = (when) => when.slice(0, 10);
const captureDay = (url) => {
  const m = url.match(/\/web\/(\d{4})(\d\d)(\d\d)/);
  return `${m[1]}-${m[2]}-${m[3]}`;
};

function rowHTML({data, item, key, category}) {
  const sold = data.sold || [];
  const unsold = data.unsold || [];
  const days = sold.map((s) => day(s[4][0][1])).sort();
  const last = sold.length ? sold[sold.length - 1] : null;
  const readings = data.readings || [];
  const vus = new Set([...sold.map((s) => day(s[4][0][1])), ...unsold.map((u) => day(u[3][0][1])),
    ...readings.flatMap((r) => [captureDay(data.captures[r[3]]), captureDay(data.captures[r[4]])])].map((d) => RANK.get(vuOn(d))));
  const lastReading = readings.length ? readings.reduce((a, b) => (data.captures[b[4]] > data.captures[a[4]] ? b : a)) : null;
  const name = shownName(item);
  const file = iconFile(item.icon);
  const icon = file ? `<span class="i-icon"><img src="../items/icons/${esc(file)}" alt="" loading="lazy"></span>` : `<span class="i-icon"></span>`;
  const span = days.length ? (days[0].slice(0, 7) === days[days.length - 1].slice(0, 7) ? days[0] : `${days[0]} to ${days[days.length - 1]}`) : "";
  const text = [name, item.name, ...(item.names || []).map((n) => n.name), ...(item.also || []), item.type, category].join(" ").toLowerCase();
  return `<li class="item has-more" id="${esc(item.id)}" data-cat="${key}" data-src="${esc(data.sources.join(" "))}" data-v="${[...vus].sort((a, b) => a - b).join(" ")}" data-markup="${esc(data.markup)}" data-text="${esc(text)}">`
    + icon + `<span class="i-name-cell"><span class="i-name">${esc(name)}</span></span><span class="i-type">${esc(item.type)}</span>`
    + `<span class="a-count">${sold.length.toLocaleString("en")}${unsold.length ? ` <span class="a-unsold">(${unsold.length.toLocaleString("en")} unsold)</span>` : ""}${readings.length ? ` <span class="a-unsold">${readings.length.toLocaleString("en")} ${readings.length === 1 ? "reading" : "readings"}</span>` : ""}</span>`
    + `<span class="a-span">${esc(span)}</span>`
    + `<span class="a-last">${last ? `${esc(money(last[2]))} PED <span class="a-mu">${esc(markup(data, last[1], last[2]))}</span>`
      : lastReading ? `<span class="a-mu">${esc(lastReading[1] === "%" ? `${lastReading[2]}%` : `TT+${money(lastReading[2])} PED`)}, ${esc(P.sources[data.sources[lastReading[0]]].name)} ${esc(captureDay(data.captures[lastReading[4]]))}</span>` : ""}</span>`
    + `<span class="a-links"><a href="../items/#${esc(item.id)}">Item</a> <a href="data/items/${esc(item.id)}.json">Data</a></span></li>`;
}

// The auction houses players ran outside the game: PE Auction's FREEAuction, each sighting of a listing in the
// order the captures saw them, and PERC's peBay, each listing with its sale page's details where Wayback kept it.
const houses = load(path.join(ROOT, "data", "houses.json"));
function housesHTML() {
  const capLink = (n, text) => `<a href="${esc(houses.captures[n])}" target="_blank" rel="noopener">${esc(text)}</a>`;
  const free = houses.freeauction.map(([captured, type, title, tt, current, bids, buyout, left, c]) =>
    `<tr><td>${capLink(c, captured)}</td><td>${esc(type)}</td><td class="t">${esc(title)}</td><td class="n">${esc(money(tt))}</td><td class="n">${esc(money(current))}</td><td class="n">${esc(bids ?? "")}</td><td class="n">${esc(money(buyout))}</td><td>${esc(left)}</td></tr>`).join("");
  const pebay = houses.pebay.map((p) => {
    const goods = (p.items || []).map(([name, tt, qty]) => `${esc(name)} (${esc(money(tt))} PED${qty > 1 ? `, ${qty}` : ""})`).join("<br>");
    const pages = [p.list !== undefined ? capLink(p.list, "list") : "", p.sale !== undefined ? capLink(p.sale, "sale page") : ""].filter(Boolean).join(", ");
    const reserve = p.reserve_met === false ? ` <span class="a-mu">reserve not met</span>` : "";
    return `<tr><td class="t">${esc(p.title || "")}</td><td>${esc(p.seller || "")}</td><td class="n">${esc(p.current || "")}</td><td>${esc(p.bidder || "")}${reserve}</td><td>${esc(p.left || "")}</td><td class="t">${goods}</td><td>${pages}</td></tr>`;
  }).join("");
  const free0 = houses.freeauction[0][0], free1 = houses.freeauction[houses.freeauction.length - 1][0];
  return `<section class="a-houses" id="houses"><h2>Auction houses players ran</h2>
<p>${sourceLink("pea")}'s FREEAuction, its own auction house, where players listed items they were selling or wanted to buy: ${houses.freeauction.length} sightings of listings in ${new Set(houses.freeauction.map((f) => f[8])).size} captures, ${free0} to ${free1}, each as the capture showed it. Prices are in PED.</p>
<details><summary>FREEAuction listings (${houses.freeauction.length})</summary><div class="a-scroll"><table class="a-table a-house"><thead><tr><th>Captured</th><th>Type</th><th>Listing</th><th class="n">TT value</th><th class="n">Current bid</th><th class="n">Bids</th><th class="n">Buyout</th><th>Time left</th></tr></thead><tbody>${free}</tbody></table></div></details>
<p>${sourceLink("perc")}'s peBay, a player market on PERC's site: the ${houses.pebay.length} listings Wayback kept, all of 20 April 2005, with the items in a sale and their TT values where its sale page survives.</p>
<details><summary>peBay listings (${houses.pebay.length})</summary><div class="a-scroll"><table class="a-table a-house"><thead><tr><th>Listing</th><th>Seller</th><th class="n">Current bid</th><th>Bidder</th><th>Time left</th><th>Items in the sale</th><th>Captures</th></tr></thead><tbody>${pebay}</tbody></table></div></details>
</section>`;
}

const sorted = records.sort((a, b) => shownName(a.item).localeCompare(shownName(b.item), "en", {sensitivity: "base"}));
const used = new Set(sorted.flatMap((r) => [...(r.data.sold || []).map((s) => day(s[4][0][1])), ...(r.data.unsold || []).map((u) => day(u[3][0][1])),
  ...(r.data.readings || []).flatMap((x) => [captureDay(r.data.captures[x[3]]), captureDay(r.data.captures[x[4]])])].map((d) => vuOn(d))));
const totalSold = sorted.reduce((n, r) => n + (r.data.sold || []).length, 0);
const totalUnsold = sorted.reduce((n, r) => n + (r.data.unsold || []).length, 0);
const sourceKeys = [...new Set(sorted.flatMap((r) => r.data.sources))];
const option = (value, text) => `<option value="${esc(value)}">${esc(text)}</option>`;
const sourceLink = (k) => {
  const s = P.sources[k];
  return s.link ? `<a href="${esc(s.link)}">${esc(s.name)}</a>` : esc(s.name);
};
// What the page's script needs: each source's name and about, and each VU's first day, to place a day in its VU.
const pageData = JSON.stringify({
  sources: Object.fromEntries(sourceKeys.map((k) => [k, {name: P.sources[k].name, about: P.sources[k].about || ""}])),
  vus: VUS.map((v) => [v, versions[v].date]),
}).replace(/</g, "\\u003c");

const body = `<p class="a-intro">Every auction players recorded from the game's auction. Below the list are the <a href="#houses">auction houses players ran</a> outside the game. A sale's markup is shown as PE Auction showed the item's, as a share of its TT value for a stackable item and as the bid less its TT value for any other.</p>
<div class="filters" role="search">
<label>Category <select class="fsel" data-filter="cat"><option value="">Any</option>${CATEGORIES.filter(([k]) => sorted.some((r) => r.key === k)).map(([k, n]) => option(k, n)).join("")}</select></label>
<label>Source <select class="fsel" data-filter="src"><option value="">Any</option>${sourceKeys.map((k) => option(k, P.sources[k].name)).join("")}</select></label>
<label>Sold in <select class="fsel" data-filter="vu" aria-label="Auctioned in VU"><option value="">any VU</option>${VUS.filter((v) => used.has(v)).map((v) => `<option value="${v}" data-rank="${RANK.get(v)}">VU ${v}</option>`).join("")}</select></label>
<label class="i-search">Search <input class="ftext" type="search" data-filter="q" placeholder="Name"></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>
<p class="shown" aria-live="polite">${sorted.length} of ${sorted.length} items</p>
<div class="i-cols" aria-hidden="true"><span></span><span>Name</span><span>Type</span><span>Sales</span><span>Sold</span><span>Last sale</span></div>
<ol class="items">
${sorted.map(rowHTML).join("\n")}
</ol>
<p class="nomatch" hidden>Nothing matches these filters.</p>
${housesHTML()}
<script type="application/json" id="a-data">${pageData}</script>`;

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (!APP.test(template) || !FILES.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into and one <!--files--> for the data links");
}
const files = `<code>data/items/&lt;item id&gt;.json</code>, linked from each row, <a href="data/houses.json">houses.json</a> for the auction houses, with <a href="../items/sources.json">sources.json</a>`;
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, "data"), {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`)
  .replace(FILES, () => `${files}.`));
for (const name of ["auction.js", "auction.css"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
fs.cpSync(DATA, path.join(OUT, "data", "items"), {recursive: true});
fs.copyFileSync(path.join(ROOT, "data", "houses.json"), path.join(OUT, "data", "houses.json"));
fs.cpSync(path.join(ROOT, "charts"), path.join(OUT, "charts"), {recursive: true});
console.log(`Drew ${sorted.length} items, ${totalSold} sales and ${totalUnsold} unsold auctions into ${OUT}`);
