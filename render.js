/* Entropia Archive: writes the published site into a folder, with the whole version list drawn into index.html.

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
const FILES = ["index.html", "site.js", "versions.json", "notes.md"];
const FOLDERS = ["images"];
const PLACEHOLDER = /<div id="app">[\s\S]*?<\/div>/g;
const STYLESHEET = /<link rel="stylesheet" href="site\.css(\?v=\d+)?">/g;
const DRAWER = /<script src="draw\.js(\?v=\d+)?" defer><\/script>\n?/g;

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

const page = read("index.html");
const found = page.match(PLACEHOLDER) || [];
if (found.length !== 1) {
  stop(`index.html should hold one <div id="app">...</div> to draw the list into; it holds ${found.length}`);
}
const links = page.match(STYLESHEET) || [];
if (links.length !== 1) {
  stop(`index.html should link site.css once, to put it inside the page; it links it ${links.length} times`);
}
const css = read("site.css").replace(/\r\n?/g, "\n").trimEnd();
if (/<\/style/i.test(css)) {
  stop("site.css contains </style, which would end the stylesheet early inside the page");
}
const drawers = page.match(DRAWER) || [];
if (drawers.length !== 1) {
  stop(`index.html should load draw.js once, to leave it out of the published page; it loads it ${drawers.length} times`);
}
const drawn = page
  .replace(DRAWER, "")
  .replace(STYLESHEET, () => `<style>\n${css}\n</style>`)
  .replace(PLACEHOLDER, () => `<div id="app" data-rendered="1">\n${draw.appHTML(m)}\n</div>`);

fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});
for (const name of FILES) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
fs.writeFileSync(path.join(OUT, "index.html"), drawn);
for (const folder of FOLDERS) {
  fs.cpSync(path.join(ROOT, folder), path.join(OUT, folder), {recursive: true});
}
console.log(`Drew ${m.rows.length} rows into index.html and wrote the site to ${OUT}`);
