# The Project Entropia Preservation Project

## Files

| File | What it is |
|---|---|
| `versions.json` | Every version and every client file. Edited by hand. |
| `notes.md` | The release notes' text, one `## VU <version>` section per version. Edited by hand. |
| `images/discs/` | Pictures of the discs that client files were found on. |

### A version

A version is named by its number: `"4.3"`, `"5.7.1"`, or `"7.4.X"` for the unnumbered mini-updates
after 7.4. The order in the file doesn't matter, because the page sorts the versions itself. An `X`
comes after the numbered versions of its series. The name is also the version's link, `#vu-4.3`.
Renaming a version changes its link, and its `## VU` heading in `notes.md` has to be renamed to match.

| Field | What it holds |
|---|---|
| `date` | The release date as `YYYY-MM-DD`, or `YYYY-MM` or `YYYY` when that's all that is known. A shorter date is shown as approximate. Without a date, the page shows the date of the version's earliest file, marked as such. |
| `title` | `"PE"` or `"EU"`. Without one, the version takes the title of the nearest version that has one. |
| `engine` | For example `"NetImmerse 4.1.0.12"`. It must start with NetImmerse, Gamebryo or CryENGINE2, which decides the section of the page the version appears in. Without one, the version takes the engine of the nearest version that has one. |
| `changes` | The important changes, shown in the row: `["Auction", "Mindforce"]`. |
| `sources` | Where the release notes survive. See [Source ranking](#source-ranking). |
| `note` | Shown above the notes. |
| `note_until_transcribed` | Shown only while `notes.md` has no text for the version. Use it for anything that stops being true once the notes are in, such as "the notes are in the first source below". |
| `transcribed_from` | The sources the text in `notes.md` was transcribed from, shown under the notes as "Transcribed from …". |
| `client_status` | `"preserved"`, `"partial"` or `"lost"`. Set it only to override what the files say. 7.7 uses it, because its one preserved file is an installer with no data files. |
| `sort_after` | Only for a version whose name isn't a number: the version it comes after. `"COT Patch 2"` comes after `"3.4"`. |

A version's client status comes from its files: preserved if any of its files is preserved, partial if
none is but one is partial, and lost otherwise. A version with no files counts as lost.

A version gets a Changes button if it has any of the release-note fields (`sources`, `note`,
`note_until_transcribed`, `transcribed_from`) or text in `notes.md`.

### A file

| Field | What it holds |
|---|---|
| `version` | The version the file belongs to. If this names a version, the file is listed under that version. A partial name such as `"7.X"`, or no `version` at all, lists the file under Other client files instead. A plain number that isn't a version is reported as a mistake, since it is probably a typo. |
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
| `label` | What the source is: a disc, a site, or an FTP address. |
| `url` | The source's link. |
| `available` | `true` if the file can still be had there, shown as "Found on". `false` if it once could, shown as "Once on". |
| `image` | A picture of the disc, such as `"images/discs/czech-level-109-dvd.jpg"`. |
| `evidence` | What shows that the file was there: a list of `{"label": …, "url": …}` entries. A source with evidence but no `label` is shown as "Known from". |
| `note` | Shown under the source. |
| `preservation_needed` | Kept for the record, but not shown on the page. |

The file is laid out with each source on a single line, so adding or removing a source changes one
line. Any valid JSON works.

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

- `index.html#vu-5.7` for VU 5.7
- `#vu-7.4.x` for the unnumbered mini-updates after VU 7.4
- `#vu-cot-patch-2` for the unnumbered 2002 patches

`#vu-5.7`, `#5.7`, and `#vu-4` (for `#vu-4.0`) all work. A link to a version that has no release notes
opens its files instead, and a link to a version the filters hide clears the filters first. The `#` at
the end of each row is that row's link. Files under Other client files have links too, such as
`#file-entropia-universe-exe`.

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
