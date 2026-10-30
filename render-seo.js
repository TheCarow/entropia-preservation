/* Entropia Archive: node render-seo.js [folder] finishes the built site for search engines and link previews (default:
   _site beside this file). Every page gets its canonical address, and an og:image: a media page its own picture, any
   other the logo. sitemap.xml lists every page, and robots.txt points to it. It runs last, so it covers what was really
   built. A folder with no home page, or a page with no <head>, stops it, as a publish missing its pages should stop. */
"use strict";
const fs = require("fs");
const path = require("path");

const SITE = "https://entropia-archive.com";
const LOGO = `${SITE}/images/plcd.png`;
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "_site"));

function stop(message) {
  console.error(`${message} Nothing more was written.`);
  process.exit(1);
}

// The folders holding an index.html, as addresses: "" for the home page, "media/abc/" for a page under it.
function pages(folder, address) {
  const found = [];
  for (const entry of fs.readdirSync(folder, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      found.push(...pages(path.join(folder, entry.name), `${address}${entry.name}/`));
    } else if (entry.name === "index.html") {
      found.push(address);
    }
  }
  return found;
}

// Each picture's image for a preview, by its page's id: its master, or its thumbnail where a preview cannot show a BMP.
function previews() {
  const images = JSON.parse(fs.readFileSync(path.join(__dirname, "media", "media.json"), "utf8")).images;
  return new Map(images.map((image) => {
    const master = image.variants.find((v) => v.id === image.master);
    return [image.id, /\.bmp$/i.test(master.file) ? `thumbs/${master.id}.jpg` : master.file];
  }));
}

if (!fs.existsSync(path.join(OUT, "index.html"))) {
  stop(`${OUT} has no home page.`);
}
const addresses = pages(OUT, "").sort();
const pictures = previews();
for (const address of addresses) {
  const file = path.join(OUT, address, "index.html");
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes("</head>")) {
    stop(`${address || "the home page"} has no <head>.`);
  }
  if (html.includes('rel="canonical"')) {
    continue;
  }
  const url = `${SITE}/${encodeURI(address)}`;
  const picture = pictures.get((address.match(/^media\/([^/]+)\/$/) || [])[1]);
  const image = picture ? `${SITE}/media/${encodeURI(picture)}` : LOGO;
  const tags = `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${image}">\n`;
  fs.writeFileSync(file, html.replace("</head>", () => `${tags}</head>`));
}
const lines = addresses.map((address) => `<url><loc>${SITE}/${encodeURI(address).replace(/&/g, "&amp;")}</loc></url>`);
fs.writeFileSync(path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Gave ${addresses.length} pages their canonical address and preview image, listed them in ${path.join(OUT, "sitemap.xml")}, and wrote robots.txt`);
