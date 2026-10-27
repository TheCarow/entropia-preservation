# Entropia Archive

## Files

| File | What it is |
|---|---|
| `index.html` | Home: the introduction, and links to the other pages. |
| `clients/index.html` | The Clients page, the version list, drawn from the data below. |
| `media/` | The Media pages. `files/` holds the pictures and `media.json` their data, both written by the private editor (`media.json` on every save, one picture per line). A video is a picture whose `video` field names it, on YouTube, on the Internet Archive or as a file the archive keeps (`files/<id>.mp4` or `.webm`, beside the pictures): its card carries a play mark. Its page plays the archive's own copy with the browser's player, fetched only once started, or, without one, shows the poster frame and swaps in the site's player (youtube-nocookie.com, or archive.org's embedded player) only when a visitor starts it, so the site asks nothing of either until then. A document (a magazine issue or guide) is a picture of its first page whose `document` field holds the PDF the archive keeps (`files/<id>.pdf`) and, in `online`, where it is read online (an Internet Archive item): its card is marked PDF and its page sends a reader there, or without one to the first place the PDF was found that has an address. The archive's own copy is kept but not linked, so that readers do not draw on the site's bandwidth. An entry's type (picture, video or document) comes from those fields, not from a tag, and the gallery's Show filter selects by it (`?type=document`). `draw-media.js` draws the gallery and one page per picture, `render-media.js` writes them, `media.js` adds the gallery's filters and pages, `media.css` styles them and `thumbs.py` makes the thumbnails. |
| `articles/` | The Articles page. `articles.json` lists the press releases, articles and magazines, edited by hand; `render-articles.js` draws them into the page, `articles.js` adds its filters and `articles.css` styles it. |
| `sites/` | The Sites page. `sites.json` lists MindArk's sites, the players' and the tools players made (see [A site or tool](#a-site-or-tool)), edited by hand; `render-sites.js` draws them into the page, `sites.js` adds its filters and `sites.css` styles it. The media names it gives its sites also group the media page's Source filter. |
| `items/` | The Items page. `data/<category>.json` holds one file per category (armor, weapons and so on), one item per line; `icons/` the items' icons and `icons.json` each picture's description; `fields.json` the fields an item's or creature's stats can hold; `sets.json` the armour sets; `captures.json` the Wayback captures the facts were read from; and `sources.json` the sources the facts cite, with their kinds and precedence (see [An item](#an-item)). `render-items.js` draws them into the page, `items.js` adds its filters and picks each value for a chosen VU, and `items.css` styles it; `provenance.js` holds what the Items and Creatures pages share: reading citations, checking stats, and drawing a value with where it comes from. |
| `creatures/` | The Creatures page. `data/creatures.json` holds the creatures, their details and what they dropped (see [A creature](#a-creature)); `render-creatures.js` draws them into the page, `creatures.js` adds its filters and `creatures.css` styles it. |
| `skills/` | The Skills page. `data/skills.json` holds the skills and `data/ranks.json` the 5.4 client's rank ladder (see [A skill](#a-skill)); `render-skills.js` draws them into the page, `skills.js` adds its filters and popups and `skills.css` styles it. |
| `auction/` | The Auction page. `data/items/<item id>.json` holds every auction players recorded of one item and the markups the price sites printed for it, `charts/` PE Auction's own charts and `data/houses.json` the listings of the auction houses players ran (see [An auction record](#an-auction-record)); `render-auction.js` draws the list and the houses, `auction.js` adds its filters and the popup with each item's chart and records, and `auction.css` styles it. |
| `halloffame/` | The Hall of Fame page. `data/records.json` holds every global and Hall of Fame loot players recorded (see [A Hall of Fame record](#a-hall-of-fame-record)); `render-halloffame.js` draws them into one table, `halloffame.js` adds its filters and `halloffame.css` styles it. |
| `maps/` | The Maps page. `data/maps.json` is the Archive's own map database (see [A map](#a-map)): each map's frame, the areas drawn on it and its places; `data/minerals.json` holds the known mineral finds; `data/revival.json` the revival areas and zones of 2006; `amethera.png` and `eudoria.jpg` are the pictures, `render-maps.js` draws the page, `maps.js` adds its layers and `maps.css` styles it. |
| `societies/` | The Societies page. `data/societies.json` holds every society the sources name (see [A society](#a-society)); `render-societies.js` draws them into one list, `societies.js` adds its filters and `societies.css` styles it. |
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

| Field | What it holds |
|---|---|
| `id` | The entry's link on the page, `sites/#pe-auction`: lowercase letters, digits and hyphens. |
| `name` | The site's or tool's name. |
| `maker` | Optional: who made it, shown as "by …". |
| `by` | `"mindark"` or `"players"`, for the Made by filter. |
| `kind` | One of Company, Official site, Forum, News, Wiki, Market, Web tool, Program, Spreadsheet, Guide, Society, Fan page, Blog, Tribute. Web tool, Program and Spreadsheet count as tools in the page's Show filter; the rest are sites. |
| `from`, `to` | The years it ran, such as `"2001"`. `to` is `null` while it runs on or when its end is unknown; `from` is `null` only for a present-day tribute. |
| `approx` | `true` when the years come from the Wayback Machine's first and last captures; the page then writes "c. 2001". A tool's years are usually its forum announcements, so `false`. |
| `status` | `"archived"` (the Wayback Machine kept it; for a program or spreadsheet, its download), `"partial"` (it kept a page or a few; for a program, its site but not the download), `"lost"` (never captured) or `"live"`. |
| `addresses` | Every address the site or tool used, without `http://`. |
| `summary` | What it was, in a sentence or two. |
| `note` | Optional, shown under the summary. |
| `links` | `{"label": …, "url": …}` entries: the archived copy (or a tool's announcement) first, which the name links to. An address starting `../` links to another page of this site, such as `../clients/`. |
| `media` | The site's source names as the media archive records them, such as `["Entropia Pioneers forum"]`. A picture counts for the site when one of its sources has that name, or that name with a poster in brackets after it; the page shows the count with a link to those pictures. |
| `evidence` | For a lost or partial entry, the pages that show it existed, as `{"label": …, "url": …}`; shown as "Known from". A lost site needs at least one. |

### An item

`items/data/<category>.json` holds one category's items, one per line: `{"category": "Armor", "items": [...]}`. The
categories are fixed in `render-items.js` (`CATEGORIES`), which also sets the order the page shows them in. Every fact
about an item names its source, a key of `items/sources.json`, so an item can gather facts from several sources. The
facts come from PE Auction (`"pea"`), written by `items.py` in the private editor's `peauction/` folder; from the VU 5.4
client's items (`"client-5.4"`), written by the editor's `tools/client_items.py`; from the VU 4.2 client's ARMOR BOOK of
armour blueprints (`"client-5.1"`), written by `tools/client_armour_book.py`; from the VU 9.1.5, 9.2.2 and 9.3.5 clients'
item names (`"client-9.1.5"` and so on), written by `tools/client9_items.py` for items the page already lists, never
adding one; from 15 player-run sites of 2002 to 2009 (`"entropia-loot"`, `"pe-wikicharts"`, `"pe-player"`,
`"perc"`, `"pe-database"` and the rest, each described in `sources.json`), written by `items.py` in the editor's
`sites/<site>/` folders from the Archive's Wayback copies of those sites; and from the game's own item and creature windows in
Media's dated screenshots (`"item-window"`), read by eye into the editor's `screenshots/armour.json` and
`screenshots/creatures.json` and written by `screenshots/items.py`, which also gives creature maturities their Health
Level, Damage Potential, Attack Range and attribute ranges. Each tool replaces only its own source's facts
when rerun, so none undoes another, and an item keeps its name and type once written; the editor's
`tools/importall.py` runs them all in the fixed order that makes a rerun give the same files.

The player sites are imported without review: a name they print is matched to an item by fixed rules (the private
editor's `tools/itemmatch.py`), and one that matches none becomes an item of its own, named as printed and typed
Unsorted. Which source gave each value is in its citations, and the page names it beside the value.

Nothing is stored twice. A fact several sources give is stored once with the sources that give it; a fact that
follows from another is not stored at all (a day's VU, a key's class and index, a weapon's damage per second); and
what many items share is stored once where they all point (a picture's description, an armour set's colours, a
Wayback capture, an unused reason, a field's label and unit). Loot is stored on the creature that dropped it
(`creatures/data/creatures.json`, see [A creature](#a-creature)), and an item's row lists the creatures that dropped it,
with the VUs each was recorded in, from there. The private editor's `tools/itemdata.py` holds this layout for every
tool that writes it.

A **citation** names who says a fact, in one of four ways: a source's key, such as `"client-9.1.5"`, for a source that
gives one VU for everything it says (its `vu` in `sources.json`); `{"source": "pea", "first", "last"}`, the first and
last Wayback captures that show the fact, whose VU is the one current when Wayback recorded it, not necessarily when
the fact was new; `{"source": "entropia-loot", "vus": [...], "capture"}`, for a source that states the VUs itself,
with the capture that shows them and, in `as`, the names it printed where it spelled the item otherwise; or
`{"source": "item-window", "media": <picture id>}`, a dated picture in Media (`media/media.json`) of the game's own
window, whose VU is the one its record states, or else that of the latest day it can date from, and which the page
links to. A
**capture** is a key of `captures.json`, the capture's timestamp and page, such as
`20060614131751/catlisting.php?id=74`. `captures.json` lists each key once under the host spelling Wayback filed it by,
and its address is `https://web.archive.org/web/<timestamp>/<host>/<page>`. A capture's day is its timestamp's, and a
day's VU is the last two-part version released on or before it, so neither is stored beside a capture.

Each source in `sources.json` has a `kind`, and its `precedence` ranks the kinds for a field two sources give
differently in one VU: `"game"` (the game's own windows, in dated screenshots), then `"official"` (MindArk's own
word), then `"player"` (what players recorded of the live game), then
`"client"` (a client's files, which name what the game could hold, not what was in circulation), then `"owner"` (the
owner's judgements and inferences). Among sources of one kind, the value more sources give wins.

The page holds no armour that originated on or after VU 9.0 and no foot guard (foot guards came with VU 9.0): the
owner removed them on 2026-10-20, every armour piece the page dated from VU 9.0 on except those a blueprint on sale
before VU 9.0 makes, with the blueprints that make only such pieces, and with them the Reaper and Necromancer armour
and the Lich and Spectre armour, which no player source shows before VU 9 though the 5.4 client names it. The
private editor's `tools/removed_items.json` lists them, and no import makes them again.

| Field | What it holds |
|---|---|
| `id` | The item's link on the page, `items/#opal`: lowercase letters, digits and hyphens, unique across every category. |
| `name` | The item's name. |
| `type` | Its kind within the category, such as `Carbines`; the page's Type filter. |
| `names` | Every name it went by, `{"name", "sources": [citation, ...]}`. The page shows one: the one it carried last, or, with a VU chosen in the Seen in filter, the one it carried then. Spellings differing only in case are one name. |
| `also` | Optional: other spellings, kept for search and not shown: those no source dates, and those of an item the owner joined into this one as the same item (each "Uncolored" piece of clothing and its blueprint, which some sources printed without the word, joined 2026-10-17 under the name the 5.4 client gives, or else the one PE Auction gives; and 97 items PE Auction listed twice, under spellings such as "Heavy Duty Core" and "Heavy-duty Core" or under a name the first listing had carried), which every import then matches to this item. |
| `descriptions` | Each description text, `{"text", "sources": [citation, ...]}`, a text several clients give alike stored once. The page shows the one the VU 5.4 client gives, and any text the game's own item window showed in a dated screenshot (source `"item-window"`, which cites the picture where it shows a client's text word for word), as the first row of its stats, labelled Description, with their sources; where they differ, the Seen in filter picks one as it does any value. |
| `records` | Anything else a source says of the item, one record per kind of fact, `{...fields, "sources": [citation, ...]}`: a client's `key` (the same key from 5.4 and the VU 9 clients is one record; its class and index are its two halves), the 5.4 client's `category` and `category_basis` or its `inventory_tab`, the armour book's `level`, PE Auction's item `ids`, the `categories` it printed and the `capture` of its item page. |
| `stats` | What sources say of its use, field by field: `{field: [{"value", "sources": [citation, ...]}]}`, one entry per value the field had. `fields.json` defines each field once (its label, its unit, the type of its value and which categories use it; protection, durability and damage are a field per damage type, as the game's item window listed them, read together as one reading per source, so a type a later reading left out is not shown beside it; and, under shown, the fields every armour piece, weapon, creature or maturity lists, "unknown" where nothing gives a value), so a value is stored in the field's unit whatever its source printed, and nothing that follows from other values is kept (a weapon's damage per second, its cost per shot). A click on the item's row opens a popup showing each field's value, its sources and VUs behind a question mark beside it; with a VU chosen in the Seen in filter it shows the value recorded in that VU, or, failing that, the nearest VU's, marked as such. A blueprint's Makes (`product`) lists the item ids it makes, from a source that names its product or, failing that, inferred from the blueprint's name (source `"blueprint-name"`, both genders of an armour or clothing piece), and a recipe's materials are stored in id order, so one recipe from two sources is stored once; the popup of an item a blueprint makes lists that blueprint as Made with. The popup ends with a link to the item's pictures in Media, the tag of its name or its armour set's. Without scripts every value shows, each with its source. A piece of an armour set also shows the set's stats as its own (see [An armour set](#an-armour-set)). |
| `seen` | Dated and inferred sightings. PE Auction's: `{"source", "first_capture", "last_capture", "vus"}`, with `first` or `last` only where the sighting's day is not its capture's (an auction that ended before the capture that listed it), and `vus` every VU it was seen in. An inferred one (source `"set"`: one piece of an armour set seen in a VU puts the set's other pieces there too) has `first_vu`, `last_vu`, `vus` and the items it rests on in `basis`. A client naming the item is its sighting in that client's VU and is not stored again. The page shows the span from the earliest VU any source gives to the latest, and the Seen in filter counts every VU between. |
| `tt` | Its TT value as it changed: `{"ped": "23.00", "capture", "source"}`, one entry per change, read off the capture on its day, or `{"ped", "media", "source"}`, read off a dated picture of the game's window that printed the maximum; in day order whichever source gave it. The page shows the latest. |
| `unused` | Optional: the item was never in use in the game, named by one of the owner's reasons in `sources.json` (`"food"`, `"injection"`, `"injection-ingredient"`, `"not-in-use"`), each with its text and day. The page keeps it but hides it and leaves it out of every count; `items/?unused=1` shows such items too, and nothing on the page links there. The private editor's `tools/client_items.py` sets it for the 5.4 client's food, injections and their ingredients and Paint Bottle Orange, unless another source saw the item in the game. |
| `icon` | Optional: its inventory icons, a list with at most one picture per VU, oldest VU first, as an item's other facts are per VU. Each is the file in `icons/`, or `{"file", "shared_from", "assigned"}`. `shared_from` names the item whose picture it borrows (an Adjusted, Improved, Modified or Unique armour piece wore its regular piece's icon, a Castorian EnBlade the 5.4 client does not name the nearest plain blade's); `assigned`, `{"source": "owner", "date", "basis"}`, says the owner chose the picture where the client stores several for the item's class. `icons.json` describes each picture once, `{"source", "vu", ...}` with how it was made, `vu` being the VU it shows the item in; a picture drawn in an armour set's colours names the set as its `look` and the colours' VU as `colours`, and the colours are the set's own in `sets.json` for that VU (see [An armour set](#an-armour-set)). The page shows the picture of the chosen VU, the latest at or before it, and none where every picture is of a later VU, a picture being of its own VU and not an earlier one's; with no VU chosen, the latest. A reconstruction's note names its VU ("This is a modern reconstruction for VU 5.4."). On 2026-10-27, by the owner's direction, the armour and clothing pictures and the pictures a client stores were dated 5.4, and the weapon pictures drawn from the 9.1.5 client's files 5.6. A picture a client stores is named `texture-<texture>_client_<key>.png`, one file per texture whichever items wear it, and one drawn since `<name>_reconstructed_<year>.png`, so a drawing is never taken for a historical picture; `render-items.js` refuses a picture named neither way or with no VU of `versions.json`, a picture no item wears, an item naming a picture `icons.json` lacks and an item with two pictures for one VU. The page fits the icon into a square box beside the name, which every row keeps, icon or not. |
| `look` | Optional, armour, clothing, weapons and items with an icon table: how the Archive reproduces the piece, per VU, `[{"vu", "class", "detail", "mask", "channels", "basis"}]`: the model's class, the detail sheet (0, 1) and colour mask (5, 6, 7) in the class's texture table, the channels its set's colours take, and why, a fit to dated pictures or the owner's direction. The basis may be left out where the piece rests on what its set's colours for that VU rest on: it then shares their basis. The record holds what the Archive dictates where the game's server chose; the VU is blank for a set 5.4 does not list. The page does not show it. An Adjusted, Improved, Modified or Unique piece takes its regular piece's look. The private editor's `tools/itemicons.py` writes it when it draws a set. A clothing item's channels take its own `colours`, and its look shares their basis where it has none of its own; petest's Clothing Editor writes both. A clothing item's mask may be any entry from 5 to 15, and `"painted": false` draws that entry as it is rather than as a colour mask (the Jolly Christmas shirt's and pants' entry 15 is red and white art). A weapon's look is `[{"vu", "class", "model", "variant", "basis"}]`: the class whose model table and texture lists it takes, one model of that table, the variant its texture lists are read at, and why, which it always gives; petest's Weapon Editor writes it. Any other item whose class picks its icon from a table (`classes.json`'s icon `"kind": "table"`) may have a look of `[{"vu", "variant", "basis"}]`: the entry of that table the game shows, the variant 5.4's server sent with the item and lost; `render-items.js` refuses one past the table's end. |
| `colours` | Optional, clothing only: the colour each channel of the item's colour mask is painted, per VU, `[{"vu", "red", "green", "blue", "basis"}]`, as `#RRGGBB`, the shape of an armour set's colours (see [An armour set](#an-armour-set)), since a garment belongs to no set. The server held a garment's colours, so the record holds what the Archive dictates; `render-items.js` refuses colours that are not `#RRGGBB` or lack a basis. The page does not show them. |

### An armour set

`items/sets.json` holds the stats every piece of an armour set has alike, once for the set rather than on each piece:
`{"sets": {<id>: {"name", "pieces": [<item id>, ...], "stats": {...}, "colours": {...}}}}`, the stats laid out as an item's
(protection by damage type, durability, how it was obtained), the pieces the ids of its items in `data/armor.json`, both
genders. Each piece's row shows the set's stats among its own (weight, TT value, markup), as a weapon's row shows its
stats. `colours`, where a set has them, is a list per VU, `[{"vu", "red", "green", "blue", "basis"}]`: the colour each channel
of the armour's mask is painted to reproduce the set in that VU, as `#RRGGBB`, and where the colours come from (the VU
blank for a set 5.4 does not list). They are the Archive's record
of how its icons were drawn, and the page does not show them; each icon drawn in them names the set as its `look`, and
their VU as `colours`, in `icons.json`. No import touches them, and the private editor's `tools/itemicons.py` writes them when it draws a set.
`render-items.js` refuses a piece that is not an armour item or that two sets claim, colours that are not three
`#RRGGBB` with a basis per VU, an icon whose look names a set without colours for its VU, and a piece's `look` that
lacks any of its fields, a basis excepted where its set's colours for that VU have one.

### A creature

`creatures/data/creatures.json` holds the creatures, one per line, laid out as items are and citing the same sources,
captures and fields (`items/sources.json`, `items/captures.json`, `items/fields.json`). `render-creatures.js` draws them
into the Creatures page, `creatures.js` adds its filters and `creatures.css` styles it.

| Field | What it holds |
|---|---|
| `id` | The creature's link on the page, `creatures/#atrox`: lowercase letters, digits and hyphens. |
| `name` | Its name. |
| `names` | Every name it went by, `{"name", "sources": [citation, ...]}`, as for an item, including a site's own spelling where it was matched to the creature spelled alike ("Areneatrox" for Araneatrox). |
| `stats` | Its details field by field (class, damage types, movement, speed, combat), as an item's stats, shown the same way. |
| `maturities` | Optional: `{"name", "sources", "stats"}` for each maturity a source names, cited by the sources that name it, with its own stats (health, damage, damage per hit, speed, attribute ranges) laid out as the creature's. A generation however written ("Generation 03", "Gen. 03") is one maturity. The page lists each with its sources and stats, picked by VU as the creature's are. |
| `locations` | Optional: where it was seen, each `{"continent", "lon", "lat"}` or `{"x", "y", "z"}`, with `label`, the name the source gave the place or the creature there, `found`, the day it was found where the source says, and `sources`. The page lists them under Seen at. |
| `loot` | What it dropped: `{"item": <item id>, "frequency"?, "sources": [citation, ...]}`, each item once, citing the VUs it was recorded in or the captures that showed it. The page lists it by the Items page's categories, each item linking to its row with, where the source gave one, how often it dropped, and its sources and VUs behind a question mark; with a VU chosen, items not recorded in that VU are dimmed. |

### A skill

`skills/data/skills.json` holds the skills, one per line, laid out as items are and citing the same sources, captures
and fields: every skill the VU 5.4 client names (its string tables' skills, class 390) and what PE WikiCharts' skill
pages say of each, a skill the client lacks being one of its own. `skills/data/ranks.json` holds the 5.4 client's rank
ladder, each band of skill points `{"rank", "from", "to"}`, the rank the client shows for points from `from` up to
`to`. The private editor's `tools/skills.py` writes both whole. `render-skills.js` draws them into the Skills page,
`skills.js` adds its filters and popups and `skills.css` styles it.

| Field | What it holds |
|---|---|
| `id` | The skill's link on the page, `skills/#aim`: lowercase letters, digits and hyphens. |
| `name` | Its name. |
| `names`, `descriptions`, `records` | As for an item: its names, its descriptions (the client's and PE WikiCharts' article text, picked by VU on the page) and its client key. |
| `stats` | Its category, whether it is hidden, whether it affects health, its requirements, and the activities that train it (`activities`, each `{"name", "hidden"}`), as an item's stats. |
| `icon` | Where the client had one: the picture the VU 5.4 skills window drew on its row, `{"file", "texture", "sources"}`, the file in `skills/icons/` (`texture-<texture>_client_5.4.png`) and the source `"skill-window-5.4"`. 114 skills have one: the 113 the 5.4 client names and Health. |

The page shows, beside a skill's own facts, the items whose "skills gained" list names it and its implant, both taken
from the Items data, and below the list the rank ladder, one row per rank with the points each of its ten grades starts at.

### An auction record

`auction/data/items/<item id>.json` holds every auction the harvests recorded of one item of the Items page: PE
Auction's sales and auctions that ended without a bid (`"pea"`, 2005 to 2009), PE Player's sales (`"pe-player"`, 2004
to 2006) and Irken Invaders' (`"irken-invaders"`, 2008), each as the site printed it; the markups the price sites
printed for it, capture by capture (PE Auction's category pages and front page, `"mytwopecs"` and
`"chipping-optimizer"`); and PE Auction's own charts of its sales. The private editor's
`tools/auction.py` writes the folder whole, matching items as the imports did. A sale two sites recorded is one sale:
the same quantity, TT value and bid at times no more than three hours apart, each site's time kept. Nothing that
follows from the rest is stored: a sale's markup is its bid over its TT value, its VU that of its day.

| Field | What it holds |
|---|---|
| `item` | The item's id on the Items page, the file's name. |
| `markup` | How PE Auction printed the item's markup, and so the page: `"%"`, the bid as a share of the TT value (a stackable), or `"TT+"`, the bid less it. |
| `sources` | The sources its records cite, keys of `items/sources.json`; a record names one by its place in this list. |
| `captures` | The Wayback captures its records were read from, as addresses; a record names one by its place in this list. |
| `sold` | Each sale, oldest first: `[quantity, TT value, winning bid, bids, seen]`. |
| `unsold` | Each auction that ended without a bid: `[quantity, TT value, starting bid, seen]`. |
| `readings` | Each markup a price site printed: `[source, kind, value, first capture, last capture]`, `kind` `"%"` or `"TT+"` as the site printed it, a run of captures that printed the same markup being one reading. |
| `charts` | PE Auction's own charts of the item's sales: `[chart type, capture, file]`, the file in `auction/charts/` under the name it was kept by, the chart type the `dtype` its address named. |

`seen` lists each site that recorded the auction, `[source, time, capture]`, the time as the site printed it on its own
clock (Irken Invaders' ran about an hour ahead of PE Auction's), with a fourth element `1` where PE Auction showed the
row greyed out. The page lists each item with an auction, its sale count, the days its sales span and its last sale;
an item's popup draws the markup of every sale over time, with each month's median, and lists every record, newest
first, with its sources and captures behind a question mark, the readings as a line per site on the chart and a table
of their own, and PE Auction's charts. The Items page links an item with auctions to it.

`auction/data/houses.json` holds the auction houses players ran outside the game, shown below the list: PE Auction's
FREEAuction (`freeauction`, each sighting of a listing `[captured, type, title, TT value, current bid, bids, buyout,
time left, capture]`, 2006 to 2008) and PERC's peBay (`pebay`, each listing of 20 April 2005 with its list page's
title, price, time left and payment method and, where Wayback kept its sale page, the seller, current bid and bidder,
whether the reserve was met and the items in the sale with their TT values). `captures` lists the Wayback captures both
cite by place.

### A Hall of Fame record

`halloffame/data/records.json` holds every global and Hall of Fame loot players recorded: PE Player's list of its users'
Hall of Fame loots (`"pe-player"`, 2003 and 2004), Nirfu's list of his own (`"nirfu"`, 2006 and 2007), Eunalysis' 20
latest globals (`"eunalysis"`, 2008) and Entropia Loot's last five globals on each creature, tracked by Eunalysis
(`"entropia-loot"`, 2008), each as the site printed it, the entries the game's own Hall of Fame window listed in the
Archive's Media pictures (`"hof-window"`), and the globals its chat window printed in them (`"chat-screenshot"`, 2003 to
2009). The private editor's `tools/halloffame.py` writes it
whole. A record several captures, sites or pictures printed alike is one record. `captures` lists the Wayback captures
the records cite by place.

| Field | What it holds |
|---|---|
| `day`, `time` | When, as printed. `day_from: "capture"` marks a day Eunalysis did not print (its capture's); `year_from: "capture"` a year Entropia Loot did not print (its capture's, or the year before for a later day). A global only pictures show has its picture's day where Media dates it to the day; else `after` and `before` give the bounds Media gives, and a picture Media cannot date leaves it with neither. |
| `player` | The player, or the team, as printed; empty where the site printed none. `team: true` marks a team; `cut: true` a name the chat window cut off at its edge, `unread: true` one printed in glyphs that cannot be read (left empty). |
| `target` | What was killed, mined or made, as printed; `as` lists an earlier printing where the site changed it. Empty where a source named only the loot. |
| `loot` | What the target dropped, where a source named it: Nirfu's note after a creature's name, the item a silent global from a hunt dropped, or what the chat says each member of a team received. |
| `creature`, `maturity`, `item` | The creature (and maturity) or the item it names, on the Creatures or Items page. |
| `value` | The loot's value in PED. |
| `kind` | `"global"`, `"hof"` (recorded in the Hall of Fame) or `"silent"` (Nirfu's silent global, worth one but not announced). `all_time_high: true` marks a loot the chat called an all-time high or the Hall of Fame window listed among them. |
| `society`, `ranks` | What the Hall of Fame window printed: the player's society, and each list it showed the entry in with its place, `[list, place]`. |
| `activity` | `"hunting"`, `"mining"` or `"crafting"`, where the source says or what it names shows it. |
| `how`, `place`, `share`, `sold`, `note` | What a source added: Nirfu's mark (C crafting, P a private hunt, T a team hunt), where, his share of a team's loot or the sale price, and a player's note. |
| `place_id` | Where it happened, as a place of the Maps page's data (`maps/data/maps.json`, see [A map](#a-map)), when the place a source printed names one; `place` keeps it as printed. A source that gives a position itself would add it here the same way, as a place. |
| `sources` | Each source and capture, `[source, capture]`, the capture by its place in `captures`; for `"hof-window"` and `"chat-screenshot"` the picture by its Media id, `[source, "<id>"]`. |

The Hall of Fame page lists every record, newest first, with filters by kind, activity, source, year and words; an
address naming a creature (`?c=<id>`) or an item (`?i=<id>`) shows its records alone. The Creatures and Items pages
link each creature and item with records there and list its Hall of Fame loots.

### A society

`societies/data/societies.json` holds every society the archive's sources name: the game's own Hall of Fame window in
the Archive's pictures (`"hof-window"`, each player listed with the society the window printed), PE WikiCharts
(`"pe-wikicharts"`, its chart of societies, each society's page and each avatar's page) and Entropia Loot's list of
society websites (`"entropia-loot"`). The private editor's `tools/societies.py` writes it whole. A society is one name,
its case, spacing and punctuation aside; "Freelancer", the Hall of Fame window's word for a player in no society, is
not one. `captures` lists the Wayback captures the facts cite by place.

| Field | What it holds |
|---|---|
| `id`, `name`, `as` | Its address on the page (`#<id>`), the name the sources print most, and the other ways they print it. |
| `founded`, `founder`, `leader`, `skill_rank`, `people_rank` | What PE WikiCharts says, each value with its sources and the days it was seen. |
| `websites` | Each home page a source gives, with its sources and the days it was seen. |
| `land` | Each land area PE WikiCharts says it owned: deed, land, type, taxes, continent, position and size. |
| `members` | Each player seen in it, with the days seen, the society rank where PE WikiCharts gives one, and the sources. |
| `site` | Its entry on the Sites page, where it has one. |
| `sources`, `seen` | Every source that names it, each source's first and last capture (or every picture), and the first and last day seen. |

A fact's `sources` are `[source, capture]`, the capture by its place in `captures`, or `[source, "<id>"]` for a picture.
The Societies page lists every society; each opens to its facts, its members and its land, and links its Hall of Fame
records. The Hall of Fame page links a record's society here.

### A map

`maps/data/maps.json` is the Archive's own map database. Everything in it is in the game's own coordinates, the
longitude and latitude its readout printed, in metres (on Amethera the client's world position plus 32,768 on both
axes). The private editor's `tools/maps.py` seeds it from the clients' own tables and adds only what it does not hold,
so an entry written or corrected by hand stays.

| Part | What it holds |
|---|---|
| `maps` | Each map: `id`, `name`, its picture (`image`), the frame the picture covers (`west`, `south`, `east`, `north`) and what the picture is (`picture`). Eudoria's is the 9.x clients' own map, texture 437871, over the frame their map window gives it; Amethera's is its ground as the 9.x clients grow it from their control texture 429259, since they ship no picture of it. |
| `areas` | Each area as a rectangle: `id`, `map`, `name`, `type` (`"Land Area"`, `"LA area"`), `west`, `south`, `east`, `north`, and `sources`. Amethera's 66 land areas are the boxes of the 9.3.5 client's map table (`"map-table-9.3.5"`, by record id), named by PE WikiCharts' Locations page (`"pe-wikicharts"`, by capture). |
| `places` | Each named place: `id`, `map`, `name`, `kinds` (`"settlement"`, `"teleporter"`, `"area"`, `"point"`), the position it is drawn at (`lon`, `lat`, its newest build's), and `listed`: one entry per client build and kind that lists it, `{"client", "kind", "name", "lon", "lat", "sources"}`, with the name as that build printed it. The builds are 5.4 (`"location-table-5.4"`, Eudoria's 32 teleporters, by slot), 9.2.2 (`"map-table-9.2.2"`, a cache, so a place missing from it was not necessarily gone) and 9.3.5 (`"map-table-9.3.5"`). |

A fact's `sources` are `[source, reference]`: a Wayback capture's address, a client record's id, a slot, or a Media
picture's id. The Maps page draws each map with five layers, the areas, the places as the chosen build listed them, the
Media pictures with known `coordinates` (on the map whose continent their tags, or the tags those imply, name; one that
names none is listed apart until it is tagged), the globals and Hall of Fame loots whose record's `place_id` names a
place, and the mineral finds, and lists them below.

`maps/data/minerals.json` holds the known mineral finds, written by petest's `Tools/resourcesites.py archive`: `groups`, one per source, each with `id`, `map`, `name`, `sources`, a
`note` and `finds`, each find `[longitude, latitude, item ids...]` in the game's metres, the ids the Items page's, two
or more where the source cannot tell them apart or names several ores at a place. The groups today are the scatter map
of mineral finds, one find per marker as placed by eye in the editor's `tools/scatteredit.py` and still in
progress (`"mining-scatter-map"`, Media hh3bqzvk), the four claim deeds in dated
screenshots that name their resource (`"item-window"`, by picture) and The Golden Ingots' East Scylla Mountains and
Minopolis (`"golden-ingots"`, Media mr7jye9g). The page draws a group of many finds as small circles, one per find, and
a group of a few as diamonds.

`maps/data/revival.json` holds Eudoria's revival areas and the zone each revival terminal served, as PE WikiCharts'
Locations map drew them with its Lines option in late 2006 (Media vvsgpk3w), written by the editor's
`tools/revival.py` from lines traced there by hand: `areas`, each with `id`, `map`, a `box` `[west, south, east, north]`
and `zones`, each zone an `id`, a `centre` and a `polygon` of `[longitude, latitude]` corners, in the game's metres. The
site never named what the lines show; reading them as revival areas and terminal zones is the Archive's (the areas
match the site's own revival area records, and most zones hold one teleporter or outpost). The page draws it as a
layer, the areas dashed and each zone outlined.

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
