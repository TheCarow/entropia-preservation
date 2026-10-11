/* Entropia Archive media: node render-media.js [folder] writes the gallery and one page per picture, drawn by
   draw-media.js, into <folder>/media/ (default: _out beside this file), with media.js, media.css and media.json.
   Thumbnails come from thumbs.py and the pictures from files/. A mistake in media.json, or a picture missing from
   files/, stops it before writing. */
"use strict";
const fs = require("fs");
const path = require("path");
const draw = require("./draw-media.js");

const ROOT = __dirname;
const OUT = path.join(path.resolve(process.argv[2] || path.join(ROOT, "_out")), "media");
const APP = /<div id="app"><\/div>/;

function stop(message) {
  console.error(message);
  process.exit(1);
}

const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");
// The Sites page's media names, which the Source filter groups posters under (draw-media.js build).
let siteNames;
try {
  siteNames = JSON.parse(read(path.join("..", "sites", "sites.json"))).sites.flatMap((s) => s.media || []);
} catch (error) {
  stop(`sites/sites.json could not be read: ${error.message}. Nothing was written.`);
}
let m;
try {
  m = draw.build(JSON.parse(read("media.json")), siteNames);
} catch (error) {
  stop(`media.json could not be read: ${error.message}. Nothing was written.`);
}
for (const p of m.pictures) {
  for (const variant of p.image.variants) {
    const file = path.join(ROOT, variant.file);
    if (!fs.existsSync(file) || fs.statSync(file).size !== variant.bytes) {
      m.problems.push(`image ${p.image.id}: ${variant.file} is missing or not ${variant.bytes} bytes`);
    }
  }
}
if (m.problems.length) {
  stop(`${m.problems.length} problem(s) in media.json. Nothing was written.\n  ${m.problems.join("\n  ")}`);
}
const template = read("index.html");
if (!APP.test(template)) {
  stop("index.html should hold one <div id=\"app\"></div> to draw into");
}

function page(root, title, description, body) {
  const fill = {root, title, description};
  return template
    .replace(/\{\{(\w+)\}\}/g, (all, key) => (key in fill ? fill[key].replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") : all))
    .replace(APP, () => `<div id="app" data-rendered="1">\n${body}\n</div>`);
}

for (const entry of fs.existsSync(OUT) ? fs.readdirSync(OUT, {withFileTypes: true}) : []) {
  if (entry.name !== "thumbs") {
    fs.rmSync(path.join(OUT, entry.name), {recursive: true, force: true});
  }
}
fs.mkdirSync(OUT, {recursive: true});
const description = "Pictures of Project Entropia and early Entropia Universe: every copy found, where it was found, and when it was taken.";
fs.writeFileSync(path.join(OUT, "index.html"), page("../", "Media | Entropia Archive", description, draw.galleryHTML(m)));
m.pictures.forEach((p, position) => {
  const folder = path.join(OUT, p.image.id);
  fs.mkdirSync(folder);
  const title = draw.imageTitle(p);
  fs.writeFileSync(path.join(folder, "index.html"), page("../../", `${title} | Entropia Archive`,
    `${title}: a picture of Project Entropia, with every copy found and where it was found.`, draw.imageHTML(m, position)));
});
for (const name of ["media.js", "media.css", "media.json"]) {
  fs.copyFileSync(path.join(ROOT, name), path.join(OUT, name));
}
console.log(`Drew the gallery and ${m.pictures.length} picture pages into ${OUT}`);
