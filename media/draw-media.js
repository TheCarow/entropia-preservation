/* Entropia Archive media: draws the gallery and each picture's page from media.json, for render-media.js.
   media.json carries every date reading and VU place already worked out, so nothing here knows a date rule. */
"use strict";

const FORMATS = {jpg: "JPEG", jpeg: "JPEG", png: "PNG", gif: "GIF", bmp: "BMP", webp: "WebP"};

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"}[c]));
const slug = (text) => String(text).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const size = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const year = (day) => (day ? Number(day.slice(0, 4)) : null);
const options = (values) => values.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join("");
const link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
// The sites a video plays from, each with its key for media.js, which swaps in the site's player, and its page.
const VIDEO_SITES = {
  "YouTube": {key: "youtube", name: "YouTube", page: (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`},
  "Internet Archive": {key: "archive", name: "the Internet Archive", page: (id) => `https://archive.org/details/${encodeURIComponent(id)}`},
};
const watchURL = (video) => VIDEO_SITES[video.site].page(video.id);
const minutes = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
// An entry's type comes from its fields, not from a tag: a document or a video, and a picture otherwise.
const typeOf = (image) => (image.document ? "document" : image.video ? "video" : "picture");
const pages = (doc) => (doc.pages ? `${doc.pages} ${doc.pages === 1 ? "page" : "pages"}` : "");
const SITES = {"archive.org": "the Internet Archive", "web.archive.org": "the Wayback Machine"};

// Where a document is read: its online address, or else the first place its PDF was found that has one. The archive
// keeps its own copy of the PDF but does not link it, so that readers do not draw on the site's bandwidth.
function readAt(doc) {
  const url = doc.online || ((doc.copy.sources || []).find((s) => s.url) || {}).url;
  if (!url) {
    return null;
  }
  const host = new URL(url).hostname.replace(/^www\./, "");
  return {url, site: SITES[host] || host};
}

function thumbSize(variant, box) {
  const scale = Math.min(1, box / Math.max(variant.width, variant.height));
  return [Math.max(1, Math.round(variant.width * scale)), Math.max(1, Math.round(variant.height * scale))];
}

// By the date's earlier bound, then its later one; undated last, ties in media.json's order.
function compare(a, b) {
  const x = a.image.date_keys;
  const y = b.image.date_keys;
  if (!x || !y) {
    return (!x - !y) || a.index - b.index;
  }
  const order = (p, q) => (p === q ? 0 : p === null ? 1 : q === null ? -1 : p < q ? -1 : 1);
  return order(x[0] ?? x[1], y[0] ?? y[1]) || order(x[1] ?? x[0], y[1] ?? y[0]) || a.index - b.index;
}

// sites: the media names the Sites page gives its sites (sites/sites.json). A site whose pictures are credited to each
// poster, "Entropia Pioneers forum (nergal)", is one choice in the Source filter under that name, so a site's link from
// the Sites page shows all its pictures. Each picture's own page still names the poster.
function build(data, sites = []) {
  const grouped = (name) => sites.find((site) => name === site || name.startsWith(`${site} (`)) || name;
  const tags = data.tags || {};
  const label = (s) => (tags[s] ? tags[s].label : s);
  const broader = (s) => (tags[s] && tags[s].broader) || [];
  // The broader tags of the given ones, nearest first.
  const above = (slugs) => {
    const found = [];
    for (const queue = [...slugs]; queue.length;) {
      for (const parent of broader(queue.shift())) {
        if (!slugs.includes(parent) && !found.includes(parent)) {
          found.push(parent);
          queue.push(parent);
        }
      }
    }
    return found;
  };
  const places = new Set(Object.keys(tags).filter((s) => s === "calypso" || above([s]).includes("calypso")));
  const problems = [];
  const pictures = data.images.map((image, index) => {
    const master = image.variants.find((v) => v.id === image.master);
    if (!master) {
      problems.push(`image ${image.id}: its master ${image.master} is not one of its copies`);
    }
    const best = master || image.variants[0];
    const direct = image.tags || [];
    const where = direct.filter((s) => places.has(s)).map(label).join(", ");
    const sources = new Set(image.variants.flatMap((v) => v.originals.flatMap((o) => (o.sources || []).map((s) => s.name))));
    const heading = (image.document && image.document.title) || where || (image.video && image.video.title) || best.originals[0].name;
    return {image, index, master: best, direct, where, heading,
            tags: [...direct, ...(image.implied || [])], sources: [...new Set([...sources].map(grouped))]};
  }).sort(compare);
  return {data, tags, label, broader, above, problems, pictures, contributors: new Set(data.contributors || [])};
}

/* ---------- the gallery ---------- */

// Every tag in use, for the tag search: alphabetical, each with its broader tags.
function tagList(m) {
  return [...new Set(m.pictures.flatMap((p) => p.tags))]
    .map((s) => ({s, l: m.label(s), p: m.above([s]).map(m.label).join(", ")}))
    .sort((a, b) => a.l.localeCompare(b.l, "en", {sensitivity: "base"}));
}

function filtersHTML(m) {
  const years = [...new Set(m.pictures.flatMap((p) => (p.image.date_keys || []).filter(Boolean).map(year)))]
    .sort((a, b) => a - b).map((y) => [String(y), String(y)]);
  // x.y versions only; a "to" version reaches through its patches, up to the next x.y.
  const series = (m.data.versions || []).filter(([name, place]) => /^\d+\.\d+$/.test(name) && place !== null);
  const vuOptions = (ends) => series.map(([name, place], n) => {
    const at = ends ? (n + 1 < series.length ? series[n + 1][1] - 0.001 : 1e9) : place;
    return `<option value="${esc(name)}" data-place="${at}">${esc(name)}</option>`;
  }).join("");
  const all = [...new Set(m.pictures.flatMap((p) => p.sources))].sort((a, b) => a.localeCompare(b));
  const group = (title, names) => `<optgroup label="${title}">${options(names.map((s) => [slug(s), s]))}</optgroup>`;
  const sources = group("Found on", all.filter((s) => !m.contributors.has(s))) + group("Shared by", all.filter((s) => m.contributors.has(s)));
  const tags = JSON.stringify(tagList(m)).replace(/</g, "\\u003c");
  return `<div class="filters" role="search">
<div class="tag-search">
<label for="tag-input">Tags</label>
<span class="tag-chips"></span>
<span class="tag-box"><input id="tag-input" class="ftext" type="text" autocomplete="off" spellcheck="false" placeholder="Add a tag" title="Click a suggestion to require it, or press without to leave it out. Start with - to leave a tag out." role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="tag-suggest"><ul id="tag-suggest" class="suggest" role="listbox" hidden></ul></span>
</div>
<script type="application/json" id="tag-list">${tags}</script>
<label>Show <select class="fsel" data-filter="type"><option value="">Everything</option><option value="picture">Pictures</option><option value="video">Videos</option><option value="document">Documents</option></select></label>
<label>Filter by <select class="fsel" id="range-kind"><option value="year">Year</option><option value="vu">VU</option></select></label>
<span class="range" data-range="year"><select class="fsel" data-filter="from" aria-label="From year"><option value="">any</option>${options(years)}</select>
to <select class="fsel" data-filter="to" aria-label="To year"><option value="">any</option>${options(years)}</select></span>
<span class="range" data-range="vu" hidden><select class="fsel" data-filter="vufrom" aria-label="From VU"><option value="">any</option>${vuOptions(false)}</select>
to <select class="fsel" data-filter="vuto" aria-label="To VU"><option value="">any</option>${vuOptions(true)}</select></span>
<label>Source <select class="fsel" data-filter="source"><option value="">Anyone</option>${sources}</select></label>
<span class="spacer"></span>
<button class="fclear" type="button" hidden>Clear filters</button>
</div>`;
}

// "72 of 412 entries": how many this page shows, of those the filters let through. Without media.js every entry
// shows; with it, media.js keeps the line current and names the type the Show filter picks.
function entries(found, all) {
  return `${found.toLocaleString("en-US")} of ${all.toLocaleString("en-US")} ${all === 1 ? "entry" : "entries"}`;
}

function card(p) {
  const [w, h] = thumbSize(p.master, 360);
  const keys = p.image.date_keys;
  const vu = p.image.vu_keys;
  const data = [
    `data-type="${typeOf(p.image)}"`,
    `data-tags="${esc(p.tags.join(" "))}"`,
    `data-source="${esc(p.sources.map(slug).join(" "))}"`,
    keys ? `data-from="${year(keys[0]) ?? ""}" data-to="${year(keys[1]) ?? ""}"` : "",
    vu && !vu.includes(null) ? `data-vu="${vu.join(" ")}"` : "",
  ].filter(Boolean).join(" ");
  const alt = [p.where, p.image.date_text].filter(Boolean).join(", ") || p.heading;
  const date = p.image.date_short ? esc(p.image.date_short) : `<span class="undated">undated</span>`;
  const vuText = p.image.vu_text ? ` <span>${esc(p.image.vu_text)}</span>` : "";
  // A video's card is its poster frame with a play mark, a document's its first page marked PDF; the video or the
  // PDF itself is on its page.
  const video = p.image.video ? `<span class="play" title="Video${p.image.video.duration ? `, ${minutes(p.image.video.duration)}` : ""}"></span>` : "";
  const doc = p.image.document ? `<span class="doc" title="${esc(pages(p.image.document) || "Document")}">PDF</span>` : "";
  const kind = p.image.video ? " is-video" : p.image.document ? " is-doc" : "";
  return `<li class="pic" id="p-${esc(p.image.id)}" ${data}><a class="shot${kind}" href="${esc(p.image.id)}/"><img src="thumbs/${esc(p.master.id)}.jpg" width="${w}" height="${h}" loading="lazy" alt="${esc(p.image.document ? p.heading : alt)}">${video}${doc}</a>
<div class="pic-line">${date}${vuText}</div>${p.where ? `<div class="pic-place">${esc(p.where)}</div>` : ""}</li>`;
}

function galleryHTML(m) {
  return `${filtersHTML(m)}
<p class="shown" aria-live="polite">${entries(m.pictures.length, m.pictures.length)}</p>
<ul class="gallery">
${m.pictures.map(card).join("\n")}
</ul>
<p class="nomatch" hidden>Nothing matches these filters.</p>
<nav class="pager" aria-label="Pages"></nav>`;
}

/* ---------- one picture ---------- */

// A site cited for both a page and the file shows once, with a link for each.
function originalHTML(m, original) {
  const sites = new Map();
  const shared = [];
  for (const source of original.sources || []) {
    if (!source.url && m.contributors.has(source.name)) {
      shared.push(source.name);
      continue;
    }
    const urls = sites.get(source.name) || [];
    if (source.url && !urls.includes(source.url)) {
      urls.push(source.url);
    }
    sites.set(source.name, urls);
  }
  const kind = (url) => {
    const bare = url.split(/[?#]/)[0];
    return /\.(jpe?g|png|gif|bmp|webp)$/i.test(bare) ? "file" : /\.zip$/i.test(bare) ? "zip" : /\.pdf$/i.test(bare) ? "PDF" : "page";
  };
  const found = [...sites].map(([name, urls]) => {
    if (urls.length < 2) {
      return urls.length ? link(urls[0], name) : esc(name);
    }
    const kinds = urls.map(kind);
    const total = {};
    const seen = {};
    kinds.forEach((k) => { total[k] = (total[k] || 0) + 1; });
    const labels = kinds.map((k) => (total[k] > 1 ? `${k} ${(seen[k] = (seen[k] || 0) + 1)}` : k));
    return `${esc(name)} (${urls.map((u, n) => link(u, labels[n])).join(", ")})`;
  });
  const parts = [];
  if (found.length) {
    parts.push(`from ${found.join(", ")}`);
  }
  if (shared.length) {
    parts.push(`shared by ${shared.map(esc).join(", ")}`);
  }
  if (original.archive) {
    parts.push(`in ${esc(original.archive)}, dated ${esc(original.archive_date)}`);
  }
  return `<li><span class="fname">${esc(original.name)}</span>${parts.length ? ` <span class="where">${parts.join("; ")}</span>` : ""}</li>`;
}

function copyHTML(m, p, variant) {
  const ext = variant.file.split(".").pop().toLowerCase();
  const [w, h] = thumbSize(variant, 120);
  const facts = [`${variant.width} × ${variant.height}`, FORMATS[ext] || ext.toUpperCase(), size(variant.bytes)];
  if (variant.frames) {
    facts.push(`${variant.frames} frames`);
  }
  const marks = [...(variant.alterations || []), ...(variant.native ? ["full size"] : [])];
  return `<div class="card copy">
<a class="copy-thumb" href="../${esc(variant.file)}"><img src="../thumbs/${esc(variant.id)}.jpg" width="${w}" height="${h}" loading="lazy" alt=""></a>
<div>
<div class="card-head"><span class="flabel">${esc(facts.join(", "))}</span>${marks.length ? `<span class="muted">${esc(marks.join(", "))}</span>` : ""}${variant.id === p.image.master ? `<span class="badge">Best copy</span>` : ""}</div>
<ul class="found">${variant.originals.map((o) => originalHTML(m, o)).join("")}</ul>
<div class="card-meta"><a href="../${esc(variant.file)}" download>Original file</a><span class="meta">SHA-256 <code>${esc(variant.sha256.slice(0, 16))}</code></span></div>
</div>
</div>`;
}

function regionsHTML(m, p) {
  return (p.image.regions || []).map((r) => {
    const [x, y, w, h] = r.box.map((n) => `${(n * 100).toFixed(2)}%`);
    return `<div class="region" style="left:${x};top:${y};width:${w};height:${h}"><span>${esc(r.tags.map(m.label).join(", "))}</span></div>`;
  }).join("");
}

function tagsHTML(m, p) {
  if (!p.direct.length) {
    return "";
  }
  const linked = p.direct.map((s) => `<a href="../?tags=${esc(s)}">${esc(m.label(s))}</a>`).join(", ");
  const broader = m.above(p.direct).map(m.label);
  return `<dt>Tags</dt><dd>${linked}${broader.length ? ` <span class="muted">(${esc(broader.join(", "))})</span>` : ""}</dd>`;
}

function imageHTML(m, position) {
  const p = m.pictures[position];
  const before = m.pictures[position - 1];
  const after = m.pictures[position + 1];
  const image = p.image;
  const copies = [p.master, ...image.variants.filter((v) => v !== p.master)];
  const date = image.date_text
    ? `<dt>Date</dt><dd>${esc(image.date_text)}${image.dating_basis ? `<div class="meta">Dating basis: ${esc(image.dating_basis)}</div>` : ""}</dd>`
    : `<dt>Date</dt><dd class="undated">unknown</dd>`;
  const vu = image.vu_text
    ? `<dt>Version</dt><dd>${image.vu_link ? `<a href="../../clients/#vu-${esc(image.vu_link)}">${esc(image.vu_text)}</a>` : esc(image.vu_text)}</dd>`
    : "";
  // The archive's own copy plays in the browser's player, fetched only once started (preload="none"). Without one,
  // the player of the site the video is on is swapped in when the poster is started (media.js). Either way nothing is
  // fetched before then.
  const video = image.video;
  const copy = video && video.copy;
  const site = video && VIDEO_SITES[video.site];
  const poster = `<img src="../${esc(p.master.file)}" width="${p.master.width}" height="${p.master.height}" alt="${esc(p.heading)}">`;
  let viewer;
  if (copy) {
    const [w, h] = copy.width && copy.height ? [copy.width, copy.height] : [p.master.width, p.master.height];
    viewer = `<figure class="viewer"><video class="video-copy" controls preload="none" playsinline poster="../${esc(p.master.file)}" width="${w}" height="${h}"><source src="../${esc(copy.file)}" type="${esc(copy.type)}"><a href="../${esc(copy.file)}">Download the video</a></video>
<figcaption class="video-note">The archive's own copy${site ? `; also ${link(watchURL(video), `on ${site.name}`)}` : ""}.</figcaption></figure>`;
  } else if (image.document) {
    // A document's picture is its first page, which opens the document where it is read.
    const read = readAt(image.document);
    const page = read ? `<a class="frame doc-open" href="${esc(read.url)}" target="_blank" rel="noopener">${poster}</a>` : `<div class="frame">${poster}</div>`;
    const note = [read && link(read.url, `Read it on ${read.site}`), pages(image.document)].filter(Boolean).join(", ");
    viewer = `<figure class="viewer">${page}
<figcaption class="video-note">The first page.${note ? ` ${note}.` : ""}</figcaption></figure>`;
  } else if (site) {
    viewer = `<figure class="viewer"><div class="frame video-frame" data-${site.key}="${esc(video.id)}"><a class="video-start" href="${esc(watchURL(video))}" target="_blank" rel="noopener" aria-label="Play ${esc(video.title || "the video")}">${poster}<span class="play"></span></a></div>
<figcaption class="video-note">Plays from ${site.name} when started; nothing is loaded from ${site.name} until then.</figcaption></figure>`;
  } else {
    viewer = `<figure class="viewer"><div class="frame">${poster}${regionsHTML(m, p)}</div></figure>`;
  }
  const copyFacts = copy
    ? `<div class="meta">Archived copy: <a href="../${esc(copy.file)}" download>${esc(copy.name || copy.file.split("/").pop())}</a>, ${esc((copy.type || "").replace("video/", "").toUpperCase())}${copy.width ? `, ${copy.width} × ${copy.height}` : ""}, ${size(copy.bytes)}${copy.source ? `; ${esc(copy.source)}` : ""}</div>`
    : "";
  const videoFacts = video
    ? `<dt>Video</dt><dd>${site ? link(watchURL(video), video.title || `On ${site.name}`) : esc(video.title || "Video")}<div class="meta">${[video.channel && `by ${esc(video.channel)}${site ? ` on ${site.name}` : ""}`, video.duration && minutes(video.duration), video.uploaded && `uploaded ${esc(video.uploaded)}`].filter(Boolean).join(", ")}</div>${copyFacts}</dd>`
    : "";
  const doc = image.document;
  // Where the PDF was found, one name per site; a site's Wayback captures are told apart by their year.
  const docFound = doc ? [...(doc.copy.sources || []).reduce((sites, s) => sites.set(s.name, [...(sites.get(s.name) || []), s.url].filter(Boolean)), new Map())]
    .map(([name, urls]) => (urls.length < 2 ? (urls.length ? link(urls[0], name) : esc(name))
      : `${esc(name)} (${urls.map((u, n) => link(u, (/web\.archive\.org\/web\/(\d{4})/.exec(u) || [])[1] || `copy ${n + 1}`)).join(", ")})`))
    .join(", ") : "";
  const docRead = doc && readAt(doc);
  const docFacts = doc
    ? `<dt>Document</dt><dd>${docRead ? link(docRead.url, doc.title) : esc(doc.title)}<div class="meta">${[doc.publisher && `published by ${esc(doc.publisher)}`, doc.issued && esc(doc.issued), pages(doc)].filter(Boolean).join(", ")}</div><div class="meta">Archived copy: ${esc(doc.copy.name || doc.copy.file.split("/").pop())}, PDF, ${size(doc.copy.bytes)}${doc.copy.made ? `, made ${esc(doc.copy.made)}` : ""}${docFound ? `; found at ${docFound}` : ""}</div></dd>`
    : "";
  const where = image.coordinates_text
    ? `<dt>Coordinates</dt><dd>${esc(image.coordinates_text)}${image.coordinates_basis ? `<div class="meta">Coordinates basis: ${esc(image.coordinates_basis)}</div>` : ""}</dd>`
    : "";
  return `<div class="crumbs"><a class="back" href="../#p-${esc(image.id)}">Back</a><nav class="pic-nav">${before ? `<a rel="prev" href="../${esc(before.image.id)}/">Previous</a>` : ""}${after ? `<a rel="next" href="../${esc(after.image.id)}/">Next</a>` : ""}</nav></div>
<h2 class="pic-title">${esc(p.heading)}</h2>
${viewer}
<dl class="facts">${videoFacts}${docFacts}${date}${vu}${where}${tagsHTML(m, p)}</dl>
<section class="copies"><h3>${copies.length > 1 ? `${copies.length} copies` : "The copy"} found</h3>
${copies.map((v) => copyHTML(m, p, v)).join("\n")}
</section>`;
}

function imageTitle(p) {
  return `${p.heading}${p.image.date_short ? `, ${p.image.date_short}` : ""}`;
}

module.exports = {build, galleryHTML, imageHTML, imageTitle};
