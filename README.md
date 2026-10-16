# Entropia Archive

## Files

| File | What it is |
|---|---|
| `index.html` | Home: the introduction, and links to the other pages. |
| `clients/index.html` | The Clients page, the version list, drawn from the data below. |
| `media/` | The Media pages. `files/` holds the pictures and `media.json` their data, both written by the private editor (`media.json` on every save, one picture per line). A video is a picture whose `video` field names it, on YouTube, on the Internet Archive or as a file the archive keeps (`files/<id>.mp4` or `.webm`, beside the pictures): its card carries a play mark. Its page plays the archive's own copy with the browser's player, fetched only once started, or, without one, shows the poster frame and swaps in the site's player (youtube-nocookie.com, or archive.org's embedded player) only when a visitor starts it, so the site asks nothing of either until then. A document (a magazine issue or guide) is a picture of its first page whose `document` field holds the PDF the archive keeps (`files/<id>.pdf`) and, in `online`, where it is read online (an Internet Archive item): its card is marked PDF and its page sends a reader there, or without one to the first place the PDF was found that has an address. The archive's own copy is kept but not linked, so that readers do not draw on the site's bandwidth. An entry's type (picture, video or document) comes from those fields, not from a tag, and the gallery's Show filter selects by it (`?type=document`). `draw-media.js` draws the gallery and one page per picture, `render-media.js` writes them, `media.js` adds the gallery's filters and pages, `media.css` styles them and `thumbs.py` makes the thumbnails. |
| `articles/` | The Articles page. `articles.json` lists the press releases, articles and magazines, edited by hand; `render-articles.js` draws them into the page, `articles.js` adds its filters and `articles.css` styles it. |
| `sites/` | The Sites & Tools page. `sites.json` lists MindArk's sites, the players' and the tools players made (see [A site or tool](#a-site-or-tool)), edited by hand; `render-sites.js` draws them into the page, `sites.js` adds its filters and `sites.css` styles it. The media names it gives its sites also group the media page's Source filter. |
| `items/` | The Items page. `data/<category>.json` holds one file per category (armor, weapons and so on), one item per line; `icons/` the items' icons and `icons.json` each picture's description; `captures.json` the Wayback captures the facts were read from; and `sources.json` the sources the facts cite (see [An item](#an-item)). `render-items.js` draws them into the page, `items.js` adds its filters and `items.css` styles it. |
| `versions.json` | Every version and every client file. Edited by hand. |
| `notes.md` | The release notes' text, one `## VU <version>` section per version. Edited by hand. |
| `images/discs/` | Pictures of the discs that client files were found on. |
| `draw.js` | Reads and checks the data and draws the page. `render.js` uses it when publishing, and a local preview uses it in the browser. |
| `site.js` | The page at work: the filters, their place in the address, and the panels. The published page loads only this. |
| `render.js` | Draws the version list into `clients/index.html` when the site is published. GitHub runs it. |
| `.github/workflows/pages.yml` | Tells GitHub to publish the site through `render.js` on every push. |

### A version

A version is named by its number: `"4.3"`, `"5.7.1"`, or `"7.4.X"` for the unnumbered mini-updates
after 7.4. The order in the file doesn't matter, because the page sorts the versions itself. An `X`
comes after the numbered versions of its series. The name is also the version's link, `#vu-4.3`.
Renaming a version changes its link, and its `## VU` heading in `notes.md` has to be renamed to match.

| Field | What it holds |
|---|---|
| `date` | The release date as `YYYY-MM-DD`, or `YYYY-MM` or `YYYY` when that's all that is known. A shorter date is shown as approximate. Without a date, the page shows the date of the version's earliest file, marked as such. |
| `title` | `"PE"` or `"EU"`, which decides the section the version appears in: Project Entropia or Entropia Universe. Without one, the version takes the title of the nearest version that has one. |
| `engine` | `"NetImmerse"`, `"Gamebryo"` or `"CryENGINE2"`, shown in the Engine column. The data gives only the name for now. A version may follow it, as in `"NetImmerse 4.1.0.12"`, and would show as hover text. Without an engine, the version takes the engine of the nearest version that has one, and the hover text says so. |
| `changes` | The important changes, shown in the row: `["Auction", "Mindforce"]`. |
| `sources` | Where the release notes survive. See [Source ranking](#source-ranking). |
| `note` | Shown above the notes. |
| `note_until_transcribed` | Shown only while `notes.md` has no text for the version. Use it for anything that stops being true once the notes are in, such as "the notes are in the first source below". |
| `transcribed_from` | The sources the text in `notes.md` was transcribed from, shown under the notes as "Transcribed from …". |
| `client_status` | `"preserved"`, `"partial"` or `"lost"`. Set it only to override what the files say. 7.7 and 5.1 use it, because each one's only preserved file is an installer without the full game data. |
| `sort_after` | Only for a version whose name isn't a number: the version it comes after. `"COT Patch 2"` comes after `"3.4"`. |

A version's client status comes from its files: preserved if any of its files is preserved, partial if
none is but one is partial, and lost otherwise. A version with no files counts as lost.

A version gets a Changes button if it has any of the release-note fields (`sources`, `note`,
`note_until_transcribed`, `transcribed_from`) or text in `notes.md`.

### A file

| Field | What it holds |
|---|---|
| `version` | The version the file belongs to. If this names a version, the file is listed under that version. A partial name such as `"7.X"`, or no `version` at all, gives the file a row of its own in the list: after the versions of that series (`"7.X"` after the last 7.x version), by its `date` when it has no version, or at the very end when it has neither. A plain number that isn't a version is reported as a mistake, since it is probably a typo. |
| `version_estimated` | `true` when `version` is a best guess. The file is then shown as "4.3 (est)". |
| `label` | How to describe the file's version where the number alone would mislead, such as `"Patch 3.6 to 3.8"`. |
| `name` | The file name. |
| `bytes` | The size in bytes, as a plain number. The page works out the size in MB from it. |
| `size_mb` | Use this only when the byte count isn't known, for example `"~84"`. |
| `date` | The file's date. |
| `data_ini` | The version recorded in the client's `data.ini`. |
| `status` | `"preserved"`, `"partial"` or `"lost"`. |
| `note` | Shown under the file. |
| `sources` | Where the file is, or once was. See below. |

As research narrows down a file's version, update its `version` field. It might go from nothing, to
`"7.X"`, to `"7.6"` with `"version_estimated": true`, and finally to `"7.6"`. The file's entry itself
never has to move.

Each source of a file has these fields:

| Field | What it holds |
|---|---|
| `label` | What the source is: a disc, a site, or an FTP address. A copy on Google Drive is labelled `"Unknown Google Drive: <file name>"`. |
| `physical` | `true` when the source is physical media: a cover disc, a promotional disc or a boxed copy. An online copy of a disc, such as an Archive.org item, is not. The Source filter's "Physical media" option lists only the files that have such a source. |
| `url` | The source's link. |
| `available` | `true` if the file can still be had there, shown as "Found on". `false` if it once could, shown as "Once on". |
| `image` | A picture of the disc, such as `"images/discs/czech-level-109-dvd.jpg"`. |
| `evidence` | What shows that the file was there: a list of `{"label": …, "url": …}` entries. A source with evidence but no `label` is shown as "Known from". |
| `note` | Shown under the source. |
| `preservation_needed` | Kept for the record, but not shown on the page. |

The file is laid out with each source on a single line, so adding or removing a source changes one
line. Any valid JSON works.

### A site or tool

`sites/sites.json` holds one site or tool per line. The page puts MindArk's sites first, then the players' sites and
tools grouped by the year they began, and a present-day tribute (no `from`) at the end.

Nothing is stored twice. A fact several sources give is stored once with the sources that give it; a fact that
follows from another is not stored at all (a day's VU, a key's class and index); and what many items share is stored
once where they all point (a picture's description, an armour set's colours, a Wayback capture, an unused reason).
The private editor's `tools/itemdata.py` holds this layout for every tool that writes it.

A **citation** names who says a fact: a source's key, such as `"client-9.1.5"`, for a source that gives one VU for
everything it says (its `vu` in `sources.json`), or `{"source": "pea", "first", "last"}`, the first and last Wayback
captures that show the fact. A **capture** is a key of `captures.json`, the capture's timestamp and page, such as
`20060614131751/catlisting.php?id=74`. `captures.json` lists each key once under the host spelling Wayback filed it by,
and its address is `https://web.archive.org/web/<timestamp>/<host>/<page>`. A capture's day is its timestamp's, and a
day's VU is the last two-part version released on or before it, so neither is stored beside a capture.

| Field | What it holds |
|---|---|
| `id` | The item's link on the page, `items/#opal`: lowercase letters, digits and hyphens, unique across every category. |
| `name` | The item's name. |
| `type` | Its kind within the category, such as `Carbines`; the page's Type filter. |
| `names` | Every name it went by, `{"name", "sources": [citation, ...]}`. The page shows one: the one it carried last, or, with a VU chosen in the Seen in filter, the one it carried then. Spellings differing only in case are one name. |
| `also` | Optional: other spellings no source dates; kept for search, not shown. |
| `descriptions` | Each description text, `{"text", "sources": [citation, ...]}`, a text several clients give alike stored once. The page shows the one the VU 5.4 client gives, as flavour text. |
| `records` | Anything else a source says of the item, one record per kind of fact, `{...fields, "sources": [citation, ...]}`: a client's `key` (the same key from 5.4 and the VU 9 clients is one record; its class and index are its two halves), the 5.4 client's `category` and `category_basis` or its `inventory_tab`, the armour book's `level`, PE Auction's item `ids`, the `categories` it printed and the `capture` of its item page. |
| `seen` | Dated and inferred sightings. PE Auction's: `{"source", "first_capture", "last_capture", "vus"}`, with `first` or `last` only where the sighting's day is not its capture's (an auction that ended before the capture that listed it), and `vus` every VU it was seen in. An inferred one (source `"set"`: one piece of an armour set seen in a VU puts the set's other pieces there too) has `first_vu`, `last_vu`, `vus` and the items it rests on in `basis`. A client naming the item is its sighting in that client's VU and is not stored again. The page shows the span from the earliest VU any source gives to the latest, and the Seen in filter counts every VU between. |
| `tt` | Its TT value as it changed: `{"ped": "23.00", "capture", "source"}`, one entry per change, read off the capture on its day. The page shows the latest. |
| `unused` | Optional: the item was never in use in the game, named by one of the owner's reasons in `sources.json` (`"food"`, `"injection"`, `"injection-ingredient"`, `"not-in-use"`), each with its text and day. The page keeps it but hides it and leaves it out of every count; `items/?unused=1` shows such items too, and nothing on the page links there. The private editor's `tools/client_items.py` sets it for the 5.4 client's food, injections and their ingredients and Paint Bottle Orange, unless another source saw the item in the game. |
| `icon` | Optional: its inventory icon, the file in `icons/`, or `{"file", "shared_from", "assigned"}`. `shared_from` names the item whose picture it borrows (an Adjusted, Improved, Modified or Unique armour piece wore its regular piece's icon, a Castorian EnBlade the 5.4 client does not name the nearest plain blade's); `assigned`, `{"source": "owner", "date", "basis"}`, says the owner chose the picture where the client stores several for the item's class. `icons.json` describes each picture once, `{"source", ...}` with how it was made, and each armour set's colours once under `looks`: the colours its red, green and blue masks were painted with and where they come from. A picture a client stores is named `texture-<texture>_client_<key>.png`, one file per texture whichever items wear it, and one drawn since `<name>_reconstructed_<year>.png`, so a drawing is never taken for a historical picture; `render-items.js` refuses a picture named neither way, a picture no item wears and an item naming a picture `icons.json` lacks. The page fits the icon into a square box beside the name, which every row keeps, icon or not. |

## Publishing

Pushing to `main` publishes the site. GitHub runs `render.js`, then makes the media thumbnails, runs
`render-media.js`, copies the pictures across byte for byte and runs `render-articles.js`, `render-sites.js` and `render-items.js`. `render.js` draws the whole version list into
`clients/index.html` and puts `site.css` inside it and Home, so the published pages read in full without JavaScript and web archives
keep every version, file, picture and release note. The published pictures leave out the hidden data Photoshop
saves in them (edit history, print settings, a preview), which is nearly half their weight; the pictures in the
folder keep it. Nothing needs running by hand.

A mistake in `versions.json`, `notes.md`, `articles.json`, `sites.json` or the items data, or a picture that isn't in the folder, stops the publish, and the last
good version stays up. The Publish run on the repository's Actions tab lists what is wrong. A local preview draws the
page in the browser from the data and lists any mistakes at its top, as before. `node render.js <folder>` writes the
published form into a folder of your choosing.

## `notes.md`

One section per version, headed `## VU <version>`, where `<version>` is the version's name from
`versions.json`. The sections use a small subset of Markdown:

- paragraphs, one line per line
- `**bold**` and `_italics_`
- `[links](url)`
- bullet and numbered lists, one level deep
- `>` quotes
- `--` separators

## Linking to a version

Every version has the id `vu-<version>`, so a link scrolls to that version and opens its release notes:

- `clients/#vu-5.7` for VU 5.7
- `#vu-7.4.x` for the unnumbered mini-updates after VU 7.4
- `#vu-cot-patch-2` for the unnumbered 2002 patches

`#vu-5.7`, `#5.7`, and `#vu-4` (for `#vu-4.0`) all work. A link to a version that has no release notes
opens its files instead, and a link to a version the filters hide clears the filters first. Adding
`-files` or `-notes` opens that panel instead: `#vu-5.4-files`. The `#` at the end of each row is that
row's link. Files on rows of their own have links too, such as `#file-entropia-universe-exe`.

The filters are in the address as well, so a filtered list can be shared: `clients/?status=lost&source=physical`.
The parameters are `from` and `to` (years), `title` (`pe` or `eu`), `status` (`preserved`, `partial` or `lost`),
`engine` (`netimmerse`, `gamebryo` or `cryengine2`) and `source` (`physical`). Only the filters that are set appear,
and the address changes as they are chosen. A link can carry both, as in `?status=lost#vu-6.1`; if the filters hide
that version, they are cleared first, as above. Links from before 2026-09-29 say `client=` for the status filter,
and still work. Links from before Clients had a page of its own point to the site's root, and Home sends any that
carries a version, a file or a filter on to `clients/`.

## Source ranking

1. **Official**: MindArk's own website, read through the Wayback Machine.
2. **MindArk staff**: posted by a MindArk employee on a forum.
3. **News bot**: the forum's news bot, which reposted MindArk's notices the day they appeared.
4. **Contemporary copy**: copied at the time by a fan site, download portal or player.
5. **Later compilation**: wikis, archives and later reposts. Entropia Museum is here: its early
   entries republish forum threads.

Every source must have a `url`. A source without one is not shown, because a name with no page is
not something a reader can check. Text in `notes.md` for a version with no linked source is reported
as a mistake. A source that only mentions a version, such as a download page or a news item naming
it, carries `"names_only": true`. It is listed, but it does not count as holding the notes.

A version with no text in `notes.md` says so in its Changes panel. If one of its sources holds the
notes, the panel says "Not transcribed yet". If none does, because every source is a name with no
page, a preview, a wiki compilation or a player's observations, the panel says that no surviving copy
has been found.

## Copyright

Project Entropia, Entropia Universe and their release notes are the work of MindArk PE AB. This is
an independent preservation project, not affiliated with MindArk.
