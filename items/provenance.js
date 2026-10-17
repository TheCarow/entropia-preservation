/* Shared by render-items.js and render-creatures.js: the versions, sources, captures and fields the data cites, the
   checks on citations and stats, and how a value is drawn with where it comes from. */
"use strict";
const fs = require("fs");
const path = require("path");

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function load(file, stop) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return stop(`${file} could not be read: ${error.message}. Nothing was written.`);
  }
}

// Everything a page needs to read citations: problems found are pushed onto `problems`.
function context(site, stop, problems) {
  const versions = load(path.join(site, "versions.json"), stop).versions;
  // The two-part versions in release order; a day's VU is the last released on or before it.
  const VUS = Object.keys(versions).filter((k) => /^\d+\.\d+$/.test(k) && versions[k].date)
    .sort((a, b) => versions[a].date.localeCompare(versions[b].date));
  const RANK = new Map(VUS.map((v, n) => [v, n]));
  const vuOn = (day) => VUS.filter((v) => versions[v].date <= day).pop();
  const table = load(path.join(site, "items", "sources.json"), stop);
  const sources = table.sources || {};
  const KIND = new Map((table.precedence || []).map((k, n) => [k, n]));
  for (const [key, source] of Object.entries(sources)) {
    if (/[–—]/.test(JSON.stringify(source))) problems.push(`sources.json: ${key} uses an en or em dash`);
    if (!KIND.has(source.kind)) problems.push(`sources.json: ${key}'s kind ${JSON.stringify(source.kind)} is not one of its precedence`);
  }
  // Each Wayback capture is listed once in captures.json, by its timestamp and page, under the host Wayback filed it
  // by; its address is https://web.archive.org/web/<timestamp>/<host>/<page> and its day its timestamp's.
  const CAPTURE = /^(\d{4})(\d\d)(\d\d)\d{6}\//;
  const captures = {};
  for (const [host, keys] of Object.entries(load(path.join(site, "items", "captures.json"), stop).captures || {})) {
    if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/.test(host)) problems.push(`captures.json: ${host} is not a host`);
    for (const key of keys) {
      if (!CAPTURE.test(key) || captures[key]) problems.push(`captures.json: ${key} is not a capture key, or is listed twice`);
      captures[key] = `https://web.archive.org/web/${key.slice(0, 14)}/${host}/${key.slice(15)}`;
    }
  }
  const captureDay = (key) => key.replace(CAPTURE, "$1-$2-$3").slice(0, 10);
  const fieldTable = load(path.join(site, "items", "fields.json"), stop);
  const fields = fieldTable.fields || {};
  // The fields an item category, the creatures or their maturities always list, in order (fields.json's shown).
  const shown = fieldTable.shown || {};
  const fieldOrder = new Map(Object.keys(fields).map((f, n) => [f, n]));
  // The Archive's Media pictures, which a citation of the game's own window names: its page is ../media/<id>/.
  const media = load(path.join(site, "media", "media.json"), stop);
  const pictures = new Map((media.images || []).map((m) => [m.id, m]));
  // Media's tags by their label with case, spaces and punctuation set aside, each with how many pictures carry it.
  const tagKey = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const tagged = new Map();
  for (const picture of pictures.values()) {
    for (const slug of new Set([...(picture.tags || []), ...(picture.implied || [])])) tagged.set(slug, (tagged.get(slug) || 0) + 1);
  }
  const tagsByLabel = new Map(Object.entries(media.tags || {}).filter(([slug]) => tagged.has(slug)).map(([slug, t]) => [tagKey(t.label), slug]));
  // A link to Media filtered by the tag one of `names` gives (else one of `fallback`), with its picture count; none where
  // no tag with pictures matches.
  function mediaLink(names, fallback = []) {
    const slug = names.map((n) => tagsByLabel.get(tagKey(n))).find(Boolean) || fallback.map((n) => tagsByLabel.get(tagKey(n))).find(Boolean);
    return slug ? `<p class="i-media"><a href="../media/?tags=${esc(slug)}">Pictures in Media (${tagged.get(slug)})</a></p>` : "";
  }

  // The VUs a picture shows, [first, last]: those its record states, else those of its days, a picture dated only "on
  // or before" a day being of that day's VU; null for an undated picture.
  function pictureVus(id) {
    const picture = pictures.get(id);
    const stated = ["start", "end"].map((end) => ((picture.vu || {})[end] || "").match(/^\d+\.\d+/));
    if (stated[0] && RANK.has(stated[0][0])) {
      return [stated[0][0], (stated[1] || stated[0])[0]];
    }
    const [first, last] = picture.date_keys || [null, null];
    return last ? [vuOn(first || last), vuOn(last)] : null;
  }
  const pictureDay = (id) => (pictures.get(id).date_keys || [])[1] || (pictures.get(id).date_keys || [])[0];

  // The VUs a citation covers, [first, last]: its source's own VU, the VUs it states, those of the picture it names, or
  // those of its captures' days.
  function citationVus(c) {
    if (typeof c === "string") {
      const vu = sources[c] && sources[c].vu;
      return vu ? [vu, vu] : null;
    }
    if (c.media) {
      return pictureVus(c.media);
    }
    if (c.vus) {
      const stated = [...c.vus].sort((a, b) => RANK.get(a) - RANK.get(b));
      return [stated[0], stated[stated.length - 1]];
    }
    return c.first ? [vuOn(captureDay(c.first)), vuOn(captureDay(c.last))] : null;
  }

  function checkCitation(c, at) {
    if (typeof c === "string") {
      if (!sources[c]) problems.push(`${at}: source ${JSON.stringify(c)} is not in sources.json`);
      return;
    }
    if (!c || !sources[c.source]) {
      problems.push(`${at}: source ${JSON.stringify(c && c.source)} is not in sources.json`);
      return;
    }
    if (c.media !== undefined) {
      if (!pictures.has(c.media) || !pictureVus(c.media)) problems.push(`${at}: picture ${JSON.stringify(c.media)} is not a dated picture in media.json`);
    } else if (c.vus !== undefined) {
      if (!Array.isArray(c.vus) || !c.vus.length || c.vus.some((v) => !RANK.has(v))) problems.push(`${at}: a citation's vus should be versions in versions.json`);
      if (c.capture !== undefined && !captures[c.capture]) problems.push(`${at}: capture ${JSON.stringify(c.capture)} is not in captures.json`);
      if (c.as !== undefined && (!Array.isArray(c.as) || c.as.some((a) => typeof a !== "string"))) problems.push(`${at}: a citation's as should be a list of names`);
    } else if (!c.first || !captures[c.first] || !captures[c.last] || captureDay(c.last) < captureDay(c.first) || !vuOn(captureDay(c.first))) {
      problems.push(`${at}: a dated citation needs its first and last captures, in order, within the versions`);
    }
  }

  function checkValue(field, value, at) {
    const f = fields[field];
    const ok = {
      number: () => typeof value === "number" && Number.isFinite(value),
      text: () => typeof value === "string" && value.trim() !== "",
      bool: () => typeof value === "boolean",
      skills: () => Array.isArray(value) && value.every((s) => s && typeof s.name === "string" && typeof s.hidden === "boolean"),
      recipe: () => Array.isArray(value) && value.length > 0 && value.every((m) => m && typeof m.item === "string" && typeof m.amount === "number"),
      items: () => Array.isArray(value) && value.length > 0 && value.every((id) => typeof id === "string"),
      range: () => Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number") && value[0] <= value[1],
    }[f.type];
    if (!ok || !ok()) problems.push(`${at}: ${field} ${JSON.stringify(value)} is not a ${f.type}`);
  }

  // A stats object: its fields are fields.json's, used where fields.json says, each value of the field's type.
  function checkStats(stats, scope, at) {
    for (const [field, entries] of Object.entries(stats || {})) {
      if (!fields[field]) {
        problems.push(`${at}: ${field} is not a field in fields.json`);
        continue;
      }
      if (!fields[field].for.includes(scope)) problems.push(`${at}: ${field} is not a field fields.json gives ${scope}`);
      if (["recipe", "items"].includes(fields[field].type)) recipes.push([at, entries]);
      for (const entry of entries) {
        if (!Array.isArray(entry.sources) || !entry.sources.length) problems.push(`${at}: a ${field} value cites no source`);
        checkValue(field, entry.value, at);
        for (const c of entry.sources || []) checkCitation(c, at);
      }
    }
  }

  // Recipes name items: the page that draws them says how an item is linked, and checks the ids exist.
  const recipes = [];
  let itemLink = (id) => esc(id);
  const setItemLink = (fn) => {
    itemLink = fn;
  };

  function widest(pairs) {
    const known = pairs.filter(Boolean);
    if (!known.length) {
      return null;
    }
    return {first: known.map((p) => p[0]).sort((a, b) => RANK.get(a) - RANK.get(b))[0],
      last: known.map((p) => p[1]).sort((a, b) => RANK.get(b) - RANK.get(a))[0]};
  }

  // Every VU a citation covers, in order: the ones it states, or each from its first VU to its last.
  function vusOf(c) {
    if (c && c.vus) {
      return [...c.vus].sort((a, b) => RANK.get(a) - RANK.get(b));
    }
    const span = citationVus(c);
    return span ? VUS.slice(RANK.get(span[0]), RANK.get(span[1]) + 1) : [];
  }

  // A list of VUs as runs: "6.1 to 6.4, 7.2".
  function compact(vus) {
    const ranks = [...new Set(vus.map((v) => RANK.get(v)))].sort((a, b) => a - b);
    const runs = [];
    for (const r of ranks) {
      const last = runs[runs.length - 1];
      if (last && r === last[1] + 1) {
        last[1] = r;
      } else {
        runs.push([r, r]);
      }
    }
    return runs.map(([a, b]) => (a === b ? VUS[a] : `${VUS[a]} to ${VUS[b]}`)).join(", ");
  }

  const kindOf = (c) => sources[typeof c === "string" ? c : c.source].kind;
  // An entry's place in the precedence: its best-ranked source's kind.
  const tierOf = (citations) => Math.min(...citations.map((c) => KIND.get(kindOf(c))));

  // Where a value comes from, in words: each source once, an entry of its own (a line in the tip), with every VU its
  // citations give it for, the days of its captures when the pointer rests on it, and a link to each picture that
  // shows it.
  function provenance(citations) {
    const bySource = new Map();
    for (const c of citations) {
      const key = typeof c === "string" ? c : c.source;
      bySource.set(key, [...(bySource.get(key) || []), c]);
    }
    const pictureLink = (id, text) => `<a href="../media/${esc(id)}/" title="${esc(`Picture dated ${pictures.get(id).date_text}`)}">${text}</a>`;
    return [...bySource].map(([key, cited]) => {
      const shown = cited.filter((c) => c.media);
      const name = shown.length === 1 ? pictureLink(shown[0].media, esc(sources[key].name))
        : `${esc(sources[key].name)}${shown.length ? ` (${shown.map((c, n) => pictureLink(c.media, n + 1)).join(", ")})` : ""}`;
      if (cited.every((c) => typeof c === "string")) {
        return `<span class="e">${name}</span>`;
      }
      const when = `${name}, VU ${esc(compact(cited.flatMap(vusOf)))}`;
      const days = cited.filter((c) => c.first).flatMap((c) => [captureDay(c.first), captureDay(c.last)]).sort();
      if (!days.length) {
        return `<span class="e">${when}</span>`;
      }
      const captured = days[0] === days[days.length - 1] ? days[0] : `${days[0]} to ${days[days.length - 1]}`;
      return `<span class="e" title="Captured ${captured}">${when}</span>`;
    }).join("");
  }

  function format(field, value) {
    const f = fields[field];
    const unit = f.unit ? ` ${f.unit}` : "";
    if (f.type === "number") {
      return esc(`${value}${unit === " %" ? "%" : unit}`);
    }
    if (f.type === "bool") {
      return value ? "Yes" : "No";
    }
    if (f.type === "skills") {
      return value.map((s) => esc(s.hidden ? `${s.name} (hidden)` : s.name)).join("<br>");
    }
    if (f.type === "recipe") {
      return value.map((m) => `${esc(m.amount)} ${itemLink(m.item)}`).join(", ");
    }
    if (f.type === "items") {
      return value.map((id) => itemLink(id)).join("<br>");
    }
    if (f.type === "range") {
      return esc(`${value[0] === value[1] ? value[0] : `${value[0]} to ${value[1]}`}${unit}`);
    }
    return esc(String(value));
  }

  // A value's sources behind a question mark beside it, shown while the pointer rests on it or it has the focus; kept
  // short, since every value has one, and labelled for screen readers by the page's script.
  const mark = (html) => (html ? `<span class="src" tabindex="0">?<span>${html}</span></span>` : "");

  // A stats table in three columns: the field, the question mark the value's sources sit behind, in a narrow column of
  // its own, and the value; one body per field, one row per value it had. Each row
  // carries the VUs it covers and its place in the precedence, for the page's script to show the one for a chosen
  // VU; without the script every row shows. Each field's body carries the field, and a field of a group in fields.json
  // (a weapon's damage by type) its group, which the script reads together. The fields fields.json's shown names for
  // the scope come first, in its order; the script adds those nothing gives a value for. `first` are rows drawn the
  // same way ahead of the fields, each {label, entries: [{html, sources}]} (an item's description); `head` and `last`
  // are bodies of fixed rows before and after them, which the script leaves alone (a maturity's name, the creatures that
  // dropped an item), in the same columns.
  function statsHTML(stats, scope, {head = "", first = [], last = ""} = {}) {
    const listed = shown[scope] || [];
    const place = (f) => (listed.includes(f) ? listed.indexOf(f) : listed.length + fieldOrder.get(f));
    const keys = Object.keys(fields).filter((f) => stats && stats[f]).sort((a, b) => place(a) - place(b));
    const rows = [...first, ...keys.map((field) => ({
      field, label: fields[field].label, group: fields[field].group,
      entries: stats[field].map((entry) => ({html: format(field, entry.value), sources: entry.sources})),
    }))];
    const bodies = rows.map(({field, label, group, entries}) => {
      const lines = entries.map((entry) => {
        const w = widest(entry.sources.map(citationVus));
        return {entry, a: w ? RANK.get(w.first) : -1, b: w ? RANK.get(w.last) : -1, t: tierOf(entry.sources), n: entry.sources.length};
      }).sort((x, y) => y.b - x.b || x.t - y.t || y.n - x.n);
      const tags = `${field ? ` data-field="${esc(field)}"` : ""}${group ? ` data-group="${esc(group)}"` : ""}`;
      return `<tbody${tags}>${lines.map((l) => `<tr class="sv" data-a="${l.a}" data-b="${l.b}" data-t="${l.t}" data-n="${l.n}"><th scope="row">${esc(label)}</th><td class="q">${mark(provenance(l.entry.sources))}</td><td class="v">${l.entry.html}</td></tr>`).join("")}</tbody>`;
    });
    if (head) {
      bodies.unshift(`<tbody class="fixed head">${head}</tbody>`);
    }
    if (last) {
      bodies.push(`<tbody class="fixed">${last}</tbody>`);
    }
    // A scope with fields it always lists gets its table even with nothing known, for the script to fill.
    return bodies.length || listed.length ? `<table class="i-stats" data-scope="${esc(scope)}">${bodies.join("")}</table><p class="i-mixed" hidden></p>` : "";
  }

  // The fields in fields.json's order, each [key, label, group, scopes], and the ones each scope lists: what a page's
  // script needs to add the rows nothing gives a value for. Written into the page as JSON.
  const fieldsJSON = () => JSON.stringify({
    fields: Object.entries(fields).map(([key, f]) => [key, f.label, f.group || null, f.for]), shown,
  }).replace(/</g, "\\u003c");

  // The globals and Hall of Fame loots players recorded (halloffame/data/records.json, the Hall of Fame page's data):
  // a record names the creature or item it is listed under, and its row gives the day, the loot's value, the player,
  // what kind of record it was and the player's note, with its sources and captures behind its question mark.
  const hallFile = path.join(site, "halloffame", "data", "records.json");
  const hall = fs.existsSync(hallFile) ? load(hallFile, stop) : {records: [], captures: []};
  const KIND_NAMES = {global: "global", hof: "Hall of Fame", silent: "silent global"};
  for (const [n, r] of hall.records.entries()) {
    for (const [source, c] of r.sources || []) {
      if (!sources[source] || (typeof c === "string" ? !pictures.has(c) : !hall.captures[c])) problems.push(`halloffame/data/records.json, record ${n + 1}: source ${JSON.stringify(source)}, capture or picture ${JSON.stringify(c)} is unknown`);
    }
    if (!KIND_NAMES[r.kind]) problems.push(`halloffame/data/records.json, record ${n + 1}: kind ${JSON.stringify(r.kind)} is not one of ${Object.keys(KIND_NAMES).join(", ")}`);
  }
  // A record's sources: each site with the captures it was read from, or the pictures that show it.
  function hallSources(r) {
    const bySource = new Map();
    for (const [source, c] of r.sources) bySource.set(source, [...(bySource.get(source) || []), c]);
    return [...bySource].map(([source, caps]) => {
      if (typeof caps[0] === "string") {
        return `<span class="e">${esc(sources[source].name)}: ${caps.map((id) => `<a href="../media/${esc(id)}/">picture ${esc(id)}</a>`).join(", ")}</span>`;
      }
      return `<span class="e">${esc(sources[source].name)}, captured ${caps.map((c) => {
        const url = hall.captures[c];
        const m = url.match(/\/web\/(\d{4})(\d\d)(\d\d)/);
        return `<a href="${esc(url)}" target="_blank" rel="noopener">${m[1]}-${m[2]}-${m[3]}</a>`;
      }).join(", ")}</span>`;
    }).join("");
  }
  // When a record was looted, as a reader sees it: its day, else the bounds its pictures give, else nothing.
  const hallDay = (r) => r.day || (r.after && r.before ? `${r.after} to ${r.before}` : r.before ? `by ${r.before}` : r.after ? `from ${r.after}` : "");
  // The VUs a record can be of, [first, last], either null where its dating is open at that end: its day's, else
  // those a picture that shows it states, else those of its bounds.
  function hallVus(r) {
    if (r.day) {
      return [vuOn(r.day), vuOn(r.day)];
    }
    for (const [, id] of r.sources.filter(([, c]) => typeof c === "string")) {
      const stated = ["start", "end"].map((end) => ((pictures.get(id).vu || {})[end] || "").match(/^\d+\.\d+/));
      if (stated[0] && RANK.has(stated[0][0])) {
        return [stated[0][0], (stated[1] || stated[0])[0]];
      }
    }
    return r.after || r.before ? [r.after ? vuOn(r.after) || null : null, r.before ? vuOn(r.before) || null : null] : null;
  }
  const hallVuText = (vus) => (!vus ? "" : vus[0] && vus[0] === vus[1] ? vus[0] : vus[0] && vus[1] ? `${vus[0]} to ${vus[1]}`
    : vus[1] ? `${vus[1]} or earlier` : vus[0] ? `${vus[0]} or later` : "");
  // Where a record falls in time, newest first: [0, day] for one dated to the day, to a range, or to the VUs its
  // picture states (by the last's release), [1, day] for one only bounded at one end, [2, ""] for one undated.
  function hallWhen(r) {
    const vus = hallVus(r);
    const day = r.day || (r.after && r.before ? r.before : null) || (vus && vus[0] && vus[1] ? versions[vus[1]].date : null);
    return day ? [0, day] : r.before || r.after ? [1, r.before || r.after] : [2, ""];
  }
  function hallRows(records, label) {
    return records.map((r, n) => {
      const where = label(r);
      return `<tr><th scope="row">${n ? "" : "Hall of Fame"}</th><td class="q">${mark(hallSources(r))}</td>`
        + `<td class="v">${esc(hallDay(r) || "undated")}${r.time ? ` ${esc(r.time)}` : ""}: ${esc(r.value)} PED, ${esc(r.player || "a name not read")}${where ? `, ${where}` : ""} (${esc(KIND_NAMES[r.kind])})`
        + `${r.note ? ` \u201c${esc(r.note)}\u201d` : ""}</td></tr>`;
    }).join("");
  }

  return {VUS, RANK, vuOn, sources, captures, captureDay, pictures, pictureDay, fields, citationVus, vusOf, checkCitation,
    checkStats, widest, compact, statsHTML, fieldsJSON, provenance, mark, mediaLink, format, tierOf, recipes, setItemLink, esc,
    hall, hallRows, hallSources, hallDay, hallVus, hallVuText, hallWhen, KIND_NAMES};
}

module.exports = {context, esc, load};
