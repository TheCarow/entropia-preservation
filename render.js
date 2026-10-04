/* Entropia Archive: writes the published site into a folder: Home (index.html), and the Clients page
   (clients/index.html) with the whole version list drawn into it.

   GitHub runs this on every push to main (.github/workflows/pages.yml), so nothing is run by hand. The list is drawn
   by draw.js, the same code that draws it in a local preview, so the two cannot disagree. The published page
   then reads in full without JavaScript, and web archives and search engines keep all of it: every version, file,
   picture and release note. The stylesheet goes inside the page too, so the page shows styled without waiting for a
   second file, and an archived copy is complete in one file. The published page loads only site.js, which adds the
   filters and panels; draw.js and the data files are not needed to show it. A mistake in the data stops the
   publish, and the last good version stays up.

   To see the published form locally: node render.js <folder>, then serve that folder. */
"use strict";
const fs = require("fs");
const path = require("path");
const draw = require("./draw.js");

const ROOT = __dirname;
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "_site"));
const FILES = ["site.css", "site.js", "versions.json", "notes.md"];
const FOLDERS = ["images"];
const PLACEHOLDER = /<div id="app"[^>]*>[\s\S]*?<\/div>/g;
const STYLESHEET = /<link rel="stylesheet" href="(\.\.\/)?site\.css(\?v=\d+)?">/g;
const DRAWER = /<script src="(\.\.\/)?draw\.js(\?v=\d+)?" defer><\/script>\n?/g;

function stop(message) {
  console.error(message);
  process.exit(1);
}

if (OUT === ROOT || ROOT.startsWith(OUT + path.sep)) {
  stop(`refusing to write into ${OUT}: it holds the site's own files`);
}

const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");
const json = read("versions.json");
const notes = read("notes.md").replace(/\r\n?/g, "\n");
let m;
try {
  m = draw.build(JSON.parse(json), notes, draw.scan(json));
} catch (error) {
  stop(`versions.json could not be read, at ${error.message}. Nothing was published.`);
}
for (const image of m.images) {
  if (!fs.existsSync(path.join(ROOT, image))) {
    m.problems.push({file: "versions.json", text: `image "${image}" is not in the folder`});
  }
}
if (m.problems.length) {
  stop(`${m.problems.length} problem(s) in the page's data. Nothing was published.\n`
    + m.problems.map((p) => `  ${p.file}${p.line ? `, line ${p.line}` : ""}: ${p.text}`).join("\n"));
}

const page = read("clients/index.html");
const found = page.match(PLACEHOLDER) || [];
if (found.length !== 1) {
  stop(`clients/index.html should hold one <div id="app">...</div> to draw the list into; it holds ${found.length}`);
}
const home = read("index.html");
for (const [name, html] of [["index.html", home], ["clients/index.html", page]]) {
  const links = html.match(STYLESHEET) || [];
  if (links.length !== 1) {
    stop(`${name} should link site.css once, to put it inside the page; it links it ${links.length} times`);
  }
}
const css = read("site.css").replace(/\r\n?/g, "\n").trimEnd();
if (/<\/style/i.test(css)) {
  stop("site.css contains </style, which would end the stylesheet early inside the page");
}
const drawers = page.match(DRAWER) || [];
if (drawers.length !== 1) {
  stop(`clients/index.html should load draw.js once, to leave it out of the published page; it loads it ${drawers.length} times`);
}
const styled = (html) => html.replace(STYLESHEET, () => `<style>\n${css}\n</style>`);
draw.setRoot("../");
const drawn = styled(page)
  .replace(DRAWER, "")
  .replace(PLACEHOLDER, () => `<div id="app" data-rendered="1">\n${draw.appHTML(m)}\n</div>`);

fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
for (const name of FILES) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
fs.writeFileSync(path.join(OUT, "index.html"), styled(home));
fs.mkdirSync(path.join(OUT, "clients"));
fs.writeFileSync(path.join(OUT, "clients", "index.html"), drawn);
let saved = 0;
for (const folder of FOLDERS) {
  saved += copyPictures(path.join(ROOT, folder), path.join(OUT, folder));
}
console.log(`Drew ${m.rows.length} rows into clients/index.html and wrote the site to ${OUT}; `
  + `left ${Math.round(saved / 1024)} KB of hidden picture data out`);

// Photoshop saves its edit history, print settings and a small preview inside every picture: in a JPEG, the APP1
// (Exif, XMP) and APP13 segments, and in a PNG, text chunks. They show nowhere and were 44% of the thumbnails' weight
// on 2026-09-29, so the published copies leave them out. The picture data itself is copied byte for byte, so not a
// pixel changes, and the originals in the folder keep everything. An Exif segment that turns the picture is kept.
function copyPictures(from, to) {
  fs.mkdirSync(to, {recursive: true});
  let saved = 0;
  for (const entry of fs.readdirSync(from, {withFileTypes: true})) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      saved += copyPictures(source, target);
      continue;
    }
    const bytes = fs.readFileSync(source);
    const lean = /\.jpe?g$/i.test(entry.name) ? leanJpeg(bytes) : /\.png$/i.test(entry.name) ? leanPng(bytes) : bytes;
    fs.writeFileSync(target, lean);
    saved += bytes.length - lean.length;
  }
  return saved;
}

function leanJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return bytes;
  }
  const kept = [bytes.subarray(0, 2)];
  let at = 2;
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1];
    if (marker === 0xda) {
      break;
    }
    const end = at + 2 + bytes.readUInt16BE(at + 2);
    const segment = bytes.subarray(at, end);
    const exif = marker === 0xe1 && segment.subarray(4, 10).toString("latin1") === "Exif\0\0";
    const metadata = marker === 0xe1 || marker === 0xec || marker === 0xed || marker === 0xfe;
    if (!metadata || (exif && turns(segment.subarray(10)))) {
      kept.push(segment);
    }
    at = end;
  }
  if (bytes[at] !== 0xff || bytes[at + 1] !== 0xda) {
    return bytes;
  }
  kept.push(bytes.subarray(at));
  return Buffer.concat(kept);
}

// Whether an Exif block sets an orientation other than upright, which a browser applies when it draws the picture.
function turns(tiff) {
  const little = tiff.subarray(0, 2).toString("latin1") === "II";
  const u16 = (i) => (little ? tiff.readUInt16LE(i) : tiff.readUInt16BE(i));
  const u32 = (i) => (little ? tiff.readUInt32LE(i) : tiff.readUInt32BE(i));
  try {
    const ifd = u32(4);
    for (let k = 0; k < u16(ifd); k += 1) {
      const entry = ifd + 2 + k * 12;
      if (u16(entry) === 0x0112) {
        return u16(entry + 8) !== 1;
      }
    }
  } catch (error) {
    return true;
  }
  return false;
}

function leanPng(bytes) {
  if (bytes.subarray(1, 4).toString("latin1") !== "PNG") {
    return bytes;
  }
  const kept = [bytes.subarray(0, 8)];
  let at = 8;
  while (at + 12 <= bytes.length) {
    const end = at + 12 + bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString("latin1");
    if (!["tEXt", "zTXt", "iTXt"].includes(type)) {
      kept.push(bytes.subarray(at, end));
    }
    at = end;
  }
  return at === bytes.length ? Buffer.concat(kept) : bytes;
}
