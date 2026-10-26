/* Entropia Archive Maps: node render-maps.js [folder] draws data/maps.json into <folder>/maps/index.html (default:
   _out beside this file), beside maps.js, maps.css, the map pictures and the data. On each map's picture it draws, in
   the game's own coordinates, three layers: the areas the data stores as rectangles; the places, as each client build
   listed them, so a VU's teleporters and where they stood can be told apart; the Media pictures with known
   coordinates (../media/media.json), each on the map its tags name; the globals and Hall of Fame loots whose records
   (../halloffame/data/records.json) link a place by its place_id; and the known mineral finds (data/minerals.json), one
   group per source. A map with areas is drawn again framed on them. Lists below give the areas, every place against the
   builds that list it, the records by place and the mineral finds by source. Sources are ../items/sources.json's. A
   mistake in the data stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");
const {context, esc, load: loadJSON} = require("../items/provenance");

const ROOT = __dirname;
const SITE = path.join(ROOT, "..");
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "maps");
const APP = /<div id="app"><\/div>/;
const FILES = /<!--files-->/;
const SIDES = ["west", "south", "east", "north"];
// The builds whose tables list places, newest first, as the data's listings name them.
const BUILDS = ["9.3.5", "9.2.2", "5.4"];
const KINDS = ["settlement", "teleporter", "area", "point"];
const HALL_KINDS = {global: "global", hof: "Hall of Fame", silent: "silent global"};

function stop(message) {
  console.error(message);
  process.exit(1);
}

const load = (file) => loadJSON(file, stop);
const problems = [];
const P = context(SITE, stop, problems);
const {maps, areas, places} = load(path.join(ROOT, "data", "maps.json"));
const mapById = new Map(maps.map((m) => [m.id, m]));
const placeById = new Map(places.map((p) => [p.id, p]));
const records = P.hall.records;

const inside = (m, x, y) => m && x >= m.west && x <= m.east && y >= m.south && y <= m.north;
function checkSources(list, at) {
  if (!list || !list.length) problems.push(`${at}: names no source`);
  for (const [source] of list || []) {
    if (!P.sources[source]) problems.push(`${at}: source ${JSON.stringify(source)} is not in sources.json`);
  }
}
for (const [n, m] of maps.entries()) {
  const at = `data/maps.json, map ${n + 1} (${m.name})`;
  if (!m.id || !m.name || !m.image || !fs.existsSync(path.join(ROOT, m.image))) problems.push(`${at}: needs an id, a name and a picture beside this file`);
  if (!SIDES.every((s) => Number.isFinite(m[s])) || m.west >= m.east || m.south >= m.north) problems.push(`${at}: its frame needs west < east and south < north`);
  // Older pictures of the map, each over its own frame, shown for the builds it names or when chosen.
  for (const [k, pic] of (m.pictures || []).entries()) {
    const pat = `${at}, picture ${k + 1} (${pic.id})`;
    if (!pic.id || !pic.label || !pic.picture || !pic.image || !fs.existsSync(path.join(ROOT, pic.image))) problems.push(`${pat}: needs an id, a label, a description and a picture beside this file`);
    if (!SIDES.every((s) => Number.isFinite(pic[s])) || pic.west >= pic.east || pic.south >= pic.north) problems.push(`${pat}: its frame needs west < east and south < north`);
    if (pic.media && !P.pictures.has(pic.media)) problems.push(`${pat}: Media picture ${pic.media} is not in media.json`);
    if (!Array.isArray(pic.builds) || pic.builds.some((b) => !BUILDS.includes(b))) problems.push(`${pat}: builds should name builds of ${BUILDS.join(", ")}`);
  }
}
// A map's pictures: its own first, then the older ones; each names the builds it is shown for.
const picturesOf = (m) => [{id: "own", label: m.label || "The map", image: m.image, west: m.west, south: m.south, east: m.east, north: m.north,
  picture: m.picture, builds: m.builds || BUILDS}, ...(m.pictures || [])];
const ids = new Set();
for (const [n, a] of areas.entries()) {
  const at = `data/maps.json, area ${n + 1} (${a.name || a.id})`;
  const m = mapById.get(a.map);
  if (!a.id || ids.has(a.id)) problems.push(`${at}: needs an id no other area has`);
  ids.add(a.id);
  if (!m) problems.push(`${at}: names map ${JSON.stringify(a.map)}, which the data does not hold`);
  if (!SIDES.every((s) => Number.isFinite(a[s])) || a.west >= a.east || a.south >= a.north) {
    problems.push(`${at}: its rectangle needs west < east and south < north`);
  } else if (m && !(inside(m, a.west, a.south) && inside(m, a.east, a.north))) {
    problems.push(`${at}: its rectangle runs outside its map's frame`);
  }
  checkSources(a.sources, at);
}
const placeIds = new Set();
for (const [n, p] of places.entries()) {
  const at = `data/maps.json, place ${n + 1} (${p.name})`;
  const m = mapById.get(p.map);
  if (!p.id || placeIds.has(p.id)) problems.push(`${at}: needs an id no other place has`);
  placeIds.add(p.id);
  if (!m) problems.push(`${at}: names map ${JSON.stringify(p.map)}, which the data does not hold`);
  if (!inside(m, p.lon, p.lat)) problems.push(`${at}: its position is outside its map's frame`);
  if (!p.listed || !p.listed.length) problems.push(`${at}: no build lists it`);
  for (const e of p.listed || []) {
    if (!BUILDS.includes(e.client) || !KINDS.includes(e.kind)) problems.push(`${at}: a listing names build ${JSON.stringify(e.client)} or kind ${JSON.stringify(e.kind)}, which this page does not know`);
    if (!inside(m, e.lon, e.lat)) problems.push(`${at}: build ${e.client} lists it outside its map's frame`);
    checkSources(e.sources, `${at}, build ${e.client}`);
  }
}
for (const r of records) {
  if (r.place_id && !placeById.has(r.place_id)) problems.push(`halloffame/data/records.json: a record names place ${JSON.stringify(r.place_id)}, which maps.json does not hold`);
}

// The known mineral finds, one group per source, each find [longitude, latitude, item ids...]; the items are the Items
// page's, linked by id.
const MINERALS = path.join(ROOT, "data", "minerals.json");
const minerals = fs.existsSync(MINERALS) ? load(MINERALS).groups : [];
// The revival areas and the zones their terminals served (data/revival.json), drawn as a layer of their own.
const REVIVAL = path.join(ROOT, "data", "revival.json");
const revivalData = fs.existsSync(REVIVAL) ? load(REVIVAL) : {areas: []};
const revival = revivalData.areas;
if (revival.length) checkSources(revivalData.sources, "data/revival.json");
const revivalIds = new Set();
for (const [n, r] of revival.entries()) {
  const at = `data/revival.json, area ${n + 1} (${r.id})`;
  const m = mapById.get(r.map);
  if (!r.id || revivalIds.has(r.id)) problems.push(`${at}: needs an id no other area has`);
  revivalIds.add(r.id);
  if (!m) problems.push(`${at}: names map ${JSON.stringify(r.map)}, which the data does not hold`);
  if (!Array.isArray(r.box) || r.box.length !== 4 || !(r.box[0] < r.box[2] && r.box[1] < r.box[3])) problems.push(`${at}: needs a box [west, south, east, north]`);
  for (const z of r.zones || []) {
    if (!z.id || revivalIds.has(z.id)) problems.push(`${at}: zone ${JSON.stringify(z.id)} needs an id no other has`);
    revivalIds.add(z.id);
    if (!Array.isArray(z.polygon) || z.polygon.length < 3 || z.polygon.some((c) => !m || !inside(m, c[0], c[1]))) problems.push(`${at}: zone ${z.id} needs three or more corners inside its map's frame`);
  }
}
const itemNames = new Map();
for (const file of fs.readdirSync(path.join(SITE, "items", "data")).filter((f) => f.endsWith(".json"))) {
  for (const item of load(path.join(SITE, "items", "data", file)).items || []) itemNames.set(item.id, item.name);
}
const groupIds = new Set();
for (const [n, g] of minerals.entries()) {
  const at = `data/minerals.json, group ${n + 1} (${g.name || g.id})`;
  const m = mapById.get(g.map);
  if (!g.id || groupIds.has(g.id)) problems.push(`${at}: needs an id no other group has`);
  groupIds.add(g.id);
  if (!m) problems.push(`${at}: names map ${JSON.stringify(g.map)}, which the data does not hold`);
  checkSources(g.sources, at);
  if (!Array.isArray(g.finds) || !g.finds.length) problems.push(`${at}: holds no finds`);
  for (const f of g.finds || []) {
    if (!Array.isArray(f) || f.length < 3 || !inside(m, f[0], f[1])) problems.push(`${at}: find ${JSON.stringify(f)} needs a position inside its map's frame and an item`);
    for (const id of f.slice(2)) {
      if (!itemNames.has(id)) problems.push(`${at}: names item ${JSON.stringify(id)}, which the Items data does not hold`);
    }
  }
}
if (problems.length) {
  stop(`${problems.length} problem(s) in the Maps data. Nothing was written.\n  ${problems.slice(0, 50).join("\n  ")}`);
}

// A source's citation: a Wayback capture by its day, or a client record or slot by its reference.
function sourcesHTML(list) {
  return list.map(([source, ref]) => {
    const name = esc(P.sources[source].name);
    const day = /^https:\/\/web\.archive\.org\/web\/(\d{4})(\d\d)(\d\d)/.exec(ref);
    if (P.pictures.has(ref)) return `<span class="e">${name}, picture <a href="../media/${esc(ref)}/">${esc(ref)}</a></span>`;
    return day ? `<span class="e">${name}, captured <a href="${esc(ref)}" target="_blank" rel="noopener">${day[1]}-${day[2]}-${day[3]}</a></span>`
      : `<span class="e">${name}, ${/^slot /.test(ref) ? esc(ref) : `record ${esc(ref)}`}</span>`;
  }).join("");
}
const label = (a) => a.name || "Unnamed area";
const km2 = (a) => ((a.east - a.west) * (a.north - a.south) / 1e6).toFixed(2);
const metres = (n) => Math.round(n).toLocaleString("en");

// The Media pictures with known coordinates, each on the map whose id its tags (or the tags they imply) name, at
// the coordinates Media gives, which are the game's readout. One that names no map, or several, or falls outside its
// map's frame is listed apart, with why, and the page is drawn anyway: a gap in Media's tags is Media's to fix.
const media = load(path.join(SITE, "media", "media.json"));
const tagLabel = (slug) => (media.tags[slug] || {}).label || slug;
function onMaps(slug, seen = new Set()) {
  if (mapById.has(slug)) return [slug];
  if (seen.has(slug)) return [];
  seen.add(slug);
  return ((media.tags[slug] || {}).broader || []).flatMap((b) => onMaps(b, seen));
}
const picturesOn = new Map(maps.map((m) => [m.id, []]));
const unplaced = [];
for (const image of media.images.filter((i) => i.coordinates)) {
  const tags = [...new Set([...(image.tags || []), ...(image.implied || [])])];
  const on = [...new Set(tags.filter((t) => mapById.has(t)))];
  const {x, y} = image.coordinates;
  const places = (image.tags || []).filter((t) => !mapById.has(t) && onMaps(t).length);
  const picture = {image, x, y, places};
  if (on.length !== 1) {
    unplaced.push({...picture, why: on.length ? `its tags name ${on.map((t) => tagLabel(t)).join(" and ")}` : "its tags name no continent the page has a map of"});
  } else if (!inside(mapById.get(on[0]), x, y)) {
    unplaced.push({...picture, why: `its coordinates fall outside ${mapById.get(on[0]).name}'s map`});
  } else {
    picturesOn.get(on[0]).push(picture);
  }
}
const pictureWhen = (image) => image.date_text || (image.vu_text ? `VU ${image.vu_text}` : "");
const thumb = (image) => `<a class="m-thumb" href="../media/${esc(image.id)}/"><img src="../media/thumbs/${esc(image.master)}.jpg" alt="" loading="lazy"></a>`;

// The records that name each place, newest first.
const hallAt = new Map();
for (const r of records) {
  if (r.place_id) hallAt.set(r.place_id, [...(hallAt.get(r.place_id) || []), r]);
}
const when = (r) => r.day || r.year_from || r.before || "";
const itemName = (id) => itemNames.get(id) || id;
const findItems = (f) => f.slice(2).map(itemName).join(" or ");
// A group's finds counted by what they hold, most first.
function findCounts(g) {
  const counts = new Map();
  for (const f of g.finds) counts.set(f.slice(2).join(" "), (counts.get(f.slice(2).join(" ")) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// One view of a map, in a viewBox of the game's coordinates with north up: its picture, then the three layers.
function viewSVG(m, box, title, mapAreas, mapPlaces) {
  const y = (lat) => m.north - lat;
  // Sizes in metres that read alike at any frame: a share of the view's width.
  const unit = (box.east - box.west) / 1000;
  const rects = mapAreas.map((a) => `<a href="#${esc(a.id)}" class="m-area" data-id="${esc(a.id)}" data-type="${esc(a.type)}">`
    + `<rect x="${a.west}" y="${y(a.north)}" width="${a.east - a.west}" height="${a.north - a.south}"><title>${esc(label(a))}, ${esc(a.type)}</title></rect></a>`).join("");
  const marks = mapPlaces.flatMap((p) => p.listed.filter((e, n, all) => all.findIndex((o) => o.client === e.client) === n).map((e) => {
    const r = (e.kind === "teleporter" || p.listed.some((o) => o.client === e.client && o.kind === "teleporter") ? 5 : 3.5) * unit;
    const printed = e.name === p.name ? "" : ` (printed ${e.name})`;
    return `<a href="#place-${esc(p.id)}" class="m-place" data-id="place-${esc(p.id)}" data-client="${esc(e.client)}" data-kind="${esc(p.listed.some((o) => o.client === e.client && o.kind === "teleporter") ? "teleporter" : e.kind)}">`
      + `<circle cx="${e.lon}" cy="${y(e.lat)}" r="${r}"><title>${esc(p.name)}${esc(printed)}: ${esc(p.listed.filter((o) => o.client === e.client).map((o) => o.kind).join(" and "))}, VU ${esc(e.client)}, ${metres(e.lon)}, ${metres(e.lat)}</title></circle></a>`;
  })).join("");
  const hall = mapPlaces.filter((p) => hallAt.has(p.id)).map((p) => {
    const list = hallAt.get(p.id);
    const r = (6 + 4 * Math.sqrt(list.length)) * unit;
    const counts = Object.keys(HALL_KINDS).map((k) => [k, list.filter((x) => x.kind === k).length]).filter(([, n]) => n);
    return `<a class="m-hall" data-id="hall-${esc(p.id)}" data-kinds="${esc(counts.map(([k]) => k).join(" "))}">`
      + `<circle cx="${p.lon}" cy="${y(p.lat)}" r="${r}"><title>${esc(p.name)}: ${esc(counts.map(([k, n]) => `${n} ${HALL_KINDS[k]}${n === 1 ? "" : "s"}`).join(", "))}</title></circle></a>`;
  }).join("");
  // Mineral finds: each find of one mineral a dot, whatever its source; a site a source names with several ores
  // a diamond, larger.
  const dot = 2.2 * unit;
  const mins = minerals.filter((g) => g.map === m.id).map((g) => {
    if (g.finds.length > 20) {
      // Each find a dot, each with its own tip naming what it holds and where.
      return findCounts(g).map(([key, n]) => {
        const items = key.split(" ");
        const dots = g.finds.filter((f) => f.slice(2).join(" ") === key)
          .map((f) => `<circle cx="${f[0]}" cy="${y(f[1])}" r="${dot.toFixed(1)}"><title>${esc(items.map(itemName).join(" or "))}, ${metres(f[0])}, ${metres(f[1])}</title></circle>`).join("");
        return `<g class="m-min" data-id="min-${esc(g.id)}" data-item="${esc(items[0])}" aria-label="${esc(items.map(itemName).join(" or "))}: ${n} finds, ${esc(g.name)}">${dots}</g>`;
      }).join("");
    }
    const r = 9 * unit;
    return g.finds.map((f) => f.length === 3
      ? `<g class="m-min" data-id="min-${esc(g.id)}" data-item="${esc(f[2])}" aria-label="${esc(itemName(f[2]))}: ${esc(g.name)}">`
        + `<circle cx="${f[0]}" cy="${y(f[1])}" r="${dot.toFixed(1)}"><title>${esc(g.name)}: ${esc(findItems(f))}, ${metres(f[0])}, ${metres(f[1])}</title></circle></g>`
      : `<a href="#min-${esc(g.id)}" class="m-min m-min-named" data-id="min-${esc(g.id)}" data-item="several">`
      + `<path d="M${f[0]} ${y(f[1]) - r}l${r} ${r}l${-r} ${r}l${-r} ${-r}z"><title>${esc(g.name)}: ${esc(f.slice(2).map(itemName).join(", "))}, ${metres(f[0])}, ${metres(f[1])}</title></path></a>`).join("");
  }).join("");
  const revs = revival.filter((r) => r.map === m.id).map((r, n) => {
    const [w, s, e, north] = r.box;
    return `<g class="m-rev" data-area="${esc(r.id)}">`
      + (r.zones || []).map((z, k) => `<polygon class="m-rev-zone" points="${z.polygon.map(([x, yy]) => `${x},${y(yy)}`).join(" ")}"><title>Revival zone ${n + 1}.${k + 1}, served by one terminal, PE WikiCharts 2006</title></polygon>`).join("")
      + `<rect class="m-rev-area" x="${w}" y="${y(north)}" width="${e - w}" height="${north - s}"><title>Revival area ${n + 1}, PE WikiCharts 2006: ${metres(w)} to ${metres(e)}, ${metres(s)} to ${metres(north)}</title></rect></g>`;
  }).join("");
  const side = 7 * unit;
  const pics = picturesOn.get(m.id).map((p) => `<a href="../media/${esc(p.image.id)}/" class="m-pic" data-id="pic-${esc(p.image.id)}">`
    + `<rect x="${p.x - side / 2}" y="${y(p.y) - side / 2}" width="${side}" height="${side}"><title>Picture ${esc(p.image.id)}${p.places.length ? `, ${esc(p.places.map(tagLabel).join(", "))}` : ""}: ${esc(p.image.coordinates_text || `${p.x}, ${p.y}`)}${pictureWhen(p.image) ? `, ${esc(pictureWhen(p.image))}` : ""}</title></rect></a>`).join("");
  return `<figure class="m-view"><svg viewBox="${box.west} ${y(box.north)} ${box.east - box.west} ${box.north - box.south}" role="img" aria-label="${esc(title)}">`
    + picturesOf(m).map((pic, n) => `<image class="m-picture${n ? " m-picture-off" : ""}" data-picture="${esc(pic.id)}" href="${esc(pic.image)}" x="${pic.west}" y="${y(pic.north)}" width="${pic.east - pic.west}" height="${pic.north - pic.south}" preserveAspectRatio="none"/>`).join("")
    + `<g class="m-layer" data-layer="revival">${revs}</g><g class="m-layer" data-layer="areas">${rects}</g><g class="m-layer" data-layer="places">${marks}</g><g class="m-layer" data-layer="pictures">${pics}</g><g class="m-layer" data-layer="hall">${hall}</g><g class="m-layer" data-layer="minerals">${mins}</g></svg>`
    + `</figure>`;
}

function areasTable(list) {
  const rows = list.map((a) => `<tr id="${esc(a.id)}" data-id="${esc(a.id)}"><td>${esc(label(a))}</td><td>${esc(a.type)}</td>`
    + `<td class="n">${metres(a.west)} to ${metres(a.east)}</td><td class="n">${metres(a.south)} to ${metres(a.north)}</td><td class="n">${km2(a)} km²</td>`
    + `<td class="q">${P.mark(sourcesHTML(a.sources))}</td></tr>`).join("");
  return `<div class="m-scroll"><table class="m-table"><thead><tr><th>Area</th><th>Type</th><th class="n">Longitude</th><th class="n">Latitude</th><th class="n">Size</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// Every place against each build: where that build put it, the name it printed where that differs, its sources.
function placesTable(list) {
  const cell = (p, client) => {
    const own = p.listed.filter((e) => e.client === client);
    if (!own.length) return `<td class="m-none"></td>`;
    const e = own[0];
    const moved = client !== BUILDS[0] && p.listed.find((o) => o.client === BUILDS.find((b) => p.listed.some((x) => x.client === b)));
    const shift = moved && moved.client !== client ? Math.round(Math.hypot(e.lon - moved.lon, e.lat - moved.lat)) : 0;
    return `<td><span class="m-pos">${metres(e.lon)}, ${metres(e.lat)}</span>${e.name === p.name ? "" : ` <span class="m-printed">“${esc(e.name)}”</span>`}`
      + `${shift ? ` <span class="m-moved">${shift} m from VU ${esc(moved.client)}</span>` : ""} ${P.mark(sourcesHTML(own.flatMap((o) => o.sources)))}</td>`;
  };
  const rows = list.map((p) => `<tr id="place-${esc(p.id)}" data-id="place-${esc(p.id)}"><td>${esc(p.name)}</td><td>${esc(p.kinds.join(", "))}</td>${BUILDS.map((b) => cell(p, b)).join("")}</tr>`).join("");
  return `<div class="m-scroll"><table class="m-table m-places"><thead><tr><th>Place</th><th>Kind</th>${BUILDS.map((b) => `<th>VU ${esc(b)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}


// The mineral finds by source: what each holds and how many, its note and its source.
function mineralsTable(list) {
  if (!list.length) return "";
  const rows = list.map((g) => {
    const held = findCounts(g).map(([key, n]) => `${key.split(" ").map((id) => `<a href="../items/#${esc(id)}">${esc(itemName(id))}</a>`).join(g.finds.length > 1 ? " or " : ", ")}${g.finds.length > 1 ? ` ${n}` : ""}`).join("; ");
    const at = g.finds.length === 1 ? `${metres(g.finds[0][0])}, ${metres(g.finds[0][1])}` : `${g.finds.length.toLocaleString("en")} finds`;
    return `<tr id="min-${esc(g.id)}" data-id="min-${esc(g.id)}"><td>${esc(g.name)}</td><td class="m-pos">${at}</td><td class="m-held">${held}</td>`
      + `<td class="m-basis">${esc(g.note || "")}</td><td class="q">${P.mark(sourcesHTML(g.sources))}</td></tr>`;
  }).join("");
  return `<div class="m-scroll"><table class="m-table m-mins"><thead><tr><th>Source</th><th>Where</th><th>What</th><th>Note</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// A map's choice of picture, beside the continent's, shown while its continent is.
const pictureChoice = (m) => (m.pictures && m.pictures.length ? `<label class="m-picture-choice${m === maps[0] ? "" : " m-map-off"}" data-for="map-${esc(m.id)}">Map <select class="fsel" data-picture>${picturesOf(m).map((pic) => `<option value="${esc(pic.id)}" data-builds="${esc(pic.builds.join(" "))}">${esc(pic.label)}</option>`).join("")}</select></label>` : "");

// The builds whose tables list a place on a map, newest first, and the choice of them beside the continent's.
const buildsOf = (m) => BUILDS.filter((b) => places.some((p) => p.map === m.id && p.listed.some((e) => e.client === b)));
const buildChoice = (m) => `<label class="m-build-choice${m === maps[0] ? "" : " m-map-off"}" data-for="map-${esc(m.id)}">Places as listed by <select class="fsel" data-build>${buildsOf(m).map((b) => `<option value="${esc(b)}">VU ${esc(b)}</option>`).join("")}</select></label>`;

// The lists under a map, each folded in a details element titled with what it holds.
function folded(list) {
  return `<div class="m-lists">${list.map(([title, html]) => `<details><summary>${esc(title)}</summary>${html}</details>`).join("")}</div>`;
}

function mapHTML(m) {
  const mapAreas = areas.filter((a) => a.map === m.id);
  const mapPlaces = places.filter((p) => p.map === m.id);
  const builds = buildsOf(m);
  const hall = mapPlaces.reduce((n, p) => n + (hallAt.get(p.id) || []).length, 0);
  const pictures = picturesOn.get(m.id);
  const mapMinerals = minerals.filter((g) => g.map === m.id);
  const finds = mapMinerals.reduce((n, g) => n + g.finds.length, 0);
  const layers = [mapAreas.length ? ["areas", "Land areas"] : null, ["places", "Places"], pictures.length ? ["pictures", "Pictures"] : null,
    hall ? ["hall", "Globals and Hall of Fame"] : null, finds ? ["minerals", "Minerals"] : null,
    revival.some((r) => r.map === m.id) ? ["revival", "Revival zones"] : null].filter(Boolean);
  return `<section class="m-map${m === maps[0] ? "" : " m-map-off"}" id="map-${esc(m.id)}" data-build="${esc(builds[0])}">`
    + `<div class="m-controls">${layers.map(([k, t]) => `<label><input type="checkbox" data-layer="${k}" checked> ${esc(t)}</label>`).join("")}`
    + `</div>`
    + `<div class="m-views">${viewSVG(m, m, `The whole of ${m.name}`, mapAreas, mapPlaces)}</div>`
    + folded([mapAreas.length ? [`Areas (${mapAreas.length})`, areasTable(mapAreas)] : null,
      [`Places, as each build lists them (${mapPlaces.length})`, placesTable(mapPlaces)],
      mapMinerals.length ? [`Mineral finds (${finds.toLocaleString("en")} from ${mapMinerals.length} sources)`, mineralsTable(mapMinerals)] : null].filter(Boolean))
    + `</section>`;
}

const body = `<p class="m-continent"><label>Continent <select class="fsel" data-continent>${maps.map((m) => `<option value="map-${esc(m.id)}">${esc(m.name)}</option>`).join("")}</select></label>${maps.map((m) => pictureChoice(m) + buildChoice(m)).join("")}</p>
${maps.map(mapHTML).join("\n")}`;

const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
if (!APP.test(template) || !FILES.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into and one <!--files--> for the data links");
}
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, "data"), {recursive: true});
fs.writeFileSync(path.join(OUT, "index.html"), template.replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`)
  .replace(FILES, () => `<a href="data/maps.json">maps.json</a> and <a href="data/minerals.json">minerals.json</a> and <a href="data/revival.json">revival.json</a>, with <a href="../halloffame/data/records.json">records.json</a> (Hall of Fame) and <a href="../items/sources.json">sources.json</a>.`));
for (const name of ["maps.js", "maps.css", ...maps.flatMap((m) => picturesOf(m).map((pic) => pic.image))]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
fs.copyFileSync(path.join(ROOT, "data", "maps.json"), path.join(OUT, "data", "maps.json"));
if (fs.existsSync(MINERALS)) fs.copyFileSync(MINERALS, path.join(OUT, "data", "minerals.json"));
if (fs.existsSync(REVIVAL)) fs.copyFileSync(REVIVAL, path.join(OUT, "data", "revival.json"));
console.log(`Drew ${maps.length} maps, ${areas.length} areas, ${places.length} places and ${[...hallAt.values()].flat().length} records at a place; ${[...picturesOn.values()].flat().length} pictures on a map, ${unplaced.length} with coordinates and no map; ${minerals.reduce((n, g) => n + g.finds.length, 0)} mineral finds in ${minerals.length} groups, into ${OUT}`);
