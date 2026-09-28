/* Entropia Archive: this page, drawn in the browser from versions.json and notes.md.

   Nothing is built beforehand. Edit versions.json or notes.md, reload, and the page shows the change. The data
   holds only what research establishes, and the rest is worked out here: a version's client status from its
   files, a missing date from its earliest file, a title or an engine from the nearest version that gives one,
   the order of the versions and every count. A mistake in the data is listed at the top of the page, with its
   line, instead of being shown quietly wrong. */
(function () {
  "use strict";

  const TIER_NAMES = {1: "Official", 2: "MindArk staff", 3: "News bot", 4: "Contemporary copy", 5: "Later compilation"};
  const TIER_HELP = {
    1: "MindArk's own website, read through the Wayback Machine.",
    2: "Posted by a MindArk employee on a forum.",
    3: "The forum's news bot, which reposted MindArk's notices the day they appeared.",
    4: "Copied at the time by a fan site, download portal or player.",
    5: "Compiled later: wikis, archives, later reposts.",
  };
  const TITLE_NAME = {PE: "Project Entropia", EU: "Entropia Universe"};
  const FAMILIES = ["NetImmerse", "Gamebryo", "CryENGINE2"];
  const STATUSES = ["preserved", "partial", "lost"];
  const RANK = {lost: 1, partial: 2, preserved: 3};
  const BADGE = {preserved: "Preserved", partial: "Partial", lost: "Lost"};
  const FIELDS = {
    top: ["versions", "files"],
    version: ["date", "title", "engine", "changes", "client_status", "sort_after", "note", "note_until_transcribed",
      "transcribed_from", "sources"],
    noteSource: ["tier", "label", "url", "date", "preview", "names_only", "from_sheet"],
    origin: ["label", "url"],
    file: ["version", "version_estimated", "label", "name", "bytes", "size_mb", "date", "data_ini", "status", "note",
      "sources"],
    fileSource: ["label", "url", "available", "image", "evidence", "note", "preservation_needed"],
    evidence: ["label", "url"],
  };
  const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
  const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const NUMBER = /^\d+(\.\d+)*$/;
  const SERIES = /^\d+(\.(\d+|[Xx]))*$/;
  const FILE_DATE_WHY = "The date of the client file; no release date is recorded";
  const CHEVRON = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 1.5l3.5 3.5-3.5 3.5"></path></svg>';

  const isObject = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const isText = (x) => typeof x === "string";

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
  }

  function count(n, one, many) {
    return `${n} ${n === 1 ? one : many || one + "s"}`;
  }

  function safeUrl(url) {
    return /^(https?:|ftp:|mailto:|#|[\w./-]+$|[\w.-]+\/)/i.test(url) && !/^\s*javascript:/i.test(url);
  }

  function link(url, text, className) {
    if (!safeUrl(url)) {
      return esc(text);
    }
    const cls = className ? ` class="${className}"` : "";
    return `<a href="${esc(url)}" target="_blank" rel="noopener"${cls}>${esc(text)}</a>`;
  }

  // ------------------------------------------------------------------------------------------ reading versions.json

  /* JSON.parse keeps the last of two equal keys without a word, and each browser says where a mistake is in its own
     way, if at all. This walks the text as JSON.parse does, to find both, and notes the line every value starts on
     so that a problem can name it. */
  function scan(text) {
    const starts = [0];
    for (let k = 0; k < text.length; k += 1) {
      if (text.charCodeAt(k) === 10) {
        starts.push(k + 1);
      }
    }
    const lineOf = (pos) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= pos) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      return lo + 1;
    };
    const lines = new Map();
    const twice = [];
    let i = 0;
    const fail = (message) => {
      const line = lineOf(i);
      throw new SyntaxError(`line ${line}, column ${i - starts[line - 1] + 1}: ${message}`);
    };
    const space = () => {
      while (i < text.length && " \t\r\n".includes(text[i])) {
        i += 1;
      }
    };
    const string = () => {
      const from = i;
      i += 1;
      for (;;) {
        if (i >= text.length) {
          fail('a text runs to the end of the file; a closing " is missing');
        }
        const c = text[i];
        if (c === '"') {
          i += 1;
          return JSON.parse(text.slice(from, i));
        }
        if (c === "\\") {
          if (i + 1 < text.length && '"\\/bfnrt'.includes(text[i + 1])) {
            i += 2;
            continue;
          }
          if (text[i + 1] === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
            i += 6;
            continue;
          }
          fail("a backslash that starts no escape; write \\\\ for a backslash");
        }
        if (c < " ") {
          fail(c === "\n" ? 'a line break inside a text; a closing " may be missing' : "a control character inside a text");
        }
        i += 1;
      }
    };
    const value = (path) => {
      space();
      lines.set(JSON.stringify(path), lineOf(i));
      const c = text[i];
      if (c === "{") {
        object(path);
        return;
      }
      if (c === "[") {
        array(path);
        return;
      }
      if (c === '"') {
        string();
        return;
      }
      const m = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 64));
      if (!m) {
        fail(c === undefined ? "the file ends before the data does"
          : `unexpected ${JSON.stringify(c)}${c === "'" ? "; JSON texts take double quotes" : ""}`);
      }
      i += m[0].length;
    };
    const object = (path) => {
      i += 1;
      space();
      if (text[i] === "}") {
        i += 1;
        return;
      }
      const seen = new Map();
      for (;;) {
        space();
        if (text[i] !== '"') {
          fail(text[i] === "}" ? "a comma before }; remove it" : 'expected a "name" in double quotes');
        }
        const line = lineOf(i);
        const key = string();
        if (seen.has(key)) {
          twice.push({path, key, lines: [seen.get(key), line]});
        } else {
          seen.set(key, line);
        }
        space();
        if (text[i] !== ":") {
          fail("expected : after a name");
        }
        i += 1;
        value(path.concat(key));
        space();
        if (text[i] === ",") {
          i += 1;
          continue;
        }
        if (text[i] === "}") {
          i += 1;
          return;
        }
        fail("expected , or }; a comma may be missing at the end of the line before");
      }
    };
    const array = (path) => {
      i += 1;
      space();
      if (text[i] === "]") {
        i += 1;
        return;
      }
      for (let n = 0; ; n += 1) {
        value(path.concat(n));
        space();
        if (text[i] === ",") {
          i += 1;
          space();
          if (text[i] === "]") {
            fail("a comma before ]; remove it");
          }
          continue;
        }
        if (text[i] === "]") {
          i += 1;
          return;
        }
        fail("expected , or ]; a comma may be missing at the end of the line before");
      }
    };
    value([]);
    space();
    if (i < text.length) {
      fail("more text after the end of the data");
    }
    return {lines, twice};
  }

  // ------------------------------------------------------------------------------------------ the notes' Markdown

  function inline(text) {
    let out = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) =>
      safeUrl(url) ? `<a href="${url.replace(/"/g, "%22")}">${label}</a>` : m);
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(?<![A-Za-z0-9_])_(?=\S)(.+?)(?<=\S)_(?![A-Za-z0-9_])/g, "<em>$1</em>");
    return out;
  }

  /* The small Markdown subset notes.md uses: paragraphs (one line per line), bold, italics, links, bullet and
     numbered lists one level deep, `>` quotes and `--` separators. */
  function markdown(body) {
    const blocks = [];
    let current = null;
    for (const raw of body.split("\n")) {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) {
        current = null;
        continue;
      }
      if (line.trim() === "--" || line.trim() === "---") {
        blocks.push(["hr"]);
        current = null;
        continue;
      }
      const item = /^(\s*)(?:([-*])|(\d+)\.)\s+(.*)$/.exec(line);
      if (item) {
        const entry = [item[3] ? "ol" : "ul", item[1].length >= 2 ? 1 : 0, item[4]];
        if (current && current[0] === "list") {
          current[1].push(entry);
        } else {
          current = ["list", [entry]];
          blocks.push(current);
        }
        continue;
      }
      const quote = /^>\s?(.*)$/.exec(line);
      if (quote) {
        if (current && current[0] === "quote") {
          current[1].push(quote[1]);
        } else {
          current = ["quote", [quote[1]]];
          blocks.push(current);
        }
        continue;
      }
      if (current && current[0] === "list" && (raw.startsWith("  ") || raw.startsWith("\t"))) {
        const last = current[1][current[1].length - 1];
        last[2] = last[2] + "\n" + line.trim();
        continue;
      }
      if (current && current[0] === "para") {
        current[1].push(line.trim());
      } else {
        current = ["para", [line.trim()]];
        blocks.push(current);
      }
    }

    const out = [];
    for (const block of blocks) {
      if (block[0] === "hr") {
        out.push("<hr>");
      } else if (block[0] === "para") {
        out.push(`<p>${block[1].map(inline).join("<br>")}</p>`);
      } else if (block[0] === "quote") {
        out.push(`<blockquote>${block[1].map(inline).join("<br>")}</blockquote>`);
      } else {
        const items = block[1];
        const top = items[0][0];
        out.push(`<${top}>`);
        let itemOpen = false;
        let nested = null;
        for (const [kind, level, raw] of items) {
          const text = raw.split("\n").map(inline).join("<br>");
          if (level === 0) {
            if (nested) {
              out.push(`</${nested}>`);
              nested = null;
            }
            if (itemOpen) {
              out.push("</li>");
            }
            out.push("<li>" + text);
            itemOpen = true;
          } else {
            if (!itemOpen) {
              out.push("<li>");
              itemOpen = true;
            }
            if (!nested) {
              out.push(`<${kind}>`);
              nested = kind;
            }
            out.push(`<li>${text}</li>`);
          }
        }
        if (nested) {
          out.push(`</${nested}>`);
        }
        if (itemOpen) {
          out.push("</li>");
        }
        out.push(`</${top}>`);
      }
    }
    return out.join("\n");
  }

  /* Whether a source carries the notes themselves: a reachable page that is not a preview, a wiki or archive
     compilation, or a player's observations. */
  function holdsNotes(source) {
    const url = source.url || "";
    if (!url || source.preview || source.names_only) {
      return false;
    }
    if (/entropiamuseum|entropiadirectory|pe-wiki/.test(url)) {
      return false;
    }
    return !(source.tier === 5 && !String(source.label).includes("repost") && !url.includes("entropiaplanets.com/wiki"));
  }

  // ------------------------------------------------------------------------------------------ the data, checked

  function versionOf(heading) {
    const version = heading.trim();
    return /^\d+$/.test(version) ? version + ".0" : version;
  }

  function anchorOf(version) {
    return "vu-" + version.toLowerCase().replace(/\s+/g, "-");
  }

  function slug(text) {
    return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function familyOf(engine) {
    return FAMILIES.find((family) => engine.startsWith(family)) || null;
  }

  function sortKey(version) {
    return SERIES.test(version) ? version.split(".").map((p) => (/^x$/i.test(p) ? 98 : Number(p))) : null;
  }

  function compareKeys(a, b) {
    for (let k = 0; k < Math.min(a.length, b.length); k += 1) {
      if (a[k] !== b[k]) {
        return a[k] - b[k];
      }
    }
    return a.length - b.length;
  }

  function sourceOrder(sources) {
    const key = (s) => [s.tier, s.preview ? 1 : 0, s.date || "9999"];
    return sources.map((s, k) => [key(s), k, s]).sort((a, b) => {
      for (let j = 0; j < 3; j += 1) {
        if (a[0][j] !== b[0][j]) {
          return a[0][j] < b[0][j] ? -1 : 1;
        }
      }
      return a[1] - b[1];
    }).map((x) => x[2]);
  }

  /* Everything the page shows, worked out from the two files, and the list of what in them it could not use. */
  function build(data, notesText, scanned) {
    const problems = [];
    const lines = scanned ? scanned.lines : new Map();
    const flag = (path, what, message) => {
      problems.push({file: "versions.json", line: lines.get(JSON.stringify(path)), text: `${what}: ${message}`});
    };
    const unknown = (obj, kind, path, what) => {
      for (const key of Object.keys(obj)) {
        if (!FIELDS[kind].includes(key)) {
          flag(path.concat(key), what, `unknown field "${key}"`);
        }
      }
    };
    const checkDate = (value, path, what) => {
      if (value !== undefined && !(isText(value) && DATE.test(value))) {
        flag(path, what, `date ${JSON.stringify(value)} is not YYYY, YYYY-MM or YYYY-MM-DD`);
        return "";
      }
      return value || "";
    };
    const checkText = (value, path, what, name) => {
      if (value !== undefined && !isText(value)) {
        flag(path, what, `${name} must be a text in double quotes`);
        return "";
      }
      return value || "";
    };
    const checkFlag = (value, path, what, name) => {
      if (value !== undefined && typeof value !== "boolean") {
        flag(path, what, `${name} must be true or false`);
        return false;
      }
      return value === true;
    };

    if (scanned) {
      for (const d of scanned.twice) {
        const what = d.path.length === 1 && d.path[0] === "versions" ? `version ${d.key}` : `"${d.key}"`;
        problems.push({file: "versions.json", line: d.lines[1],
          text: `${what} is entered twice, at lines ${d.lines[0]} and ${d.lines[1]}; only the second is shown`});
      }
    }
    if (!isObject(data)) {
      flag([], "the file", "it must be one object { } holding versions and files");
      data = {};
    }
    unknown(data, "top", [], "the file");
    if (!isObject(data.versions)) {
      flag(["versions"], "versions", "missing, or not an object { }");
    }
    if (data.files !== undefined && !Array.isArray(data.files)) {
      flag(["files"], "files", "not a list [ ]");
    }

    // ---- versions
    const versions = new Map();
    for (const [v, o] of Object.entries(isObject(data.versions) ? data.versions : {})) {
      const path = ["versions", v];
      const what = `version ${v}`;
      if (!isObject(o)) {
        flag(path, what, "not an object { }");
        versions.set(v, {raw: {}});
        continue;
      }
      unknown(o, "version", path, what);
      const clean = {raw: o};
      clean.date = checkDate(o.date, path.concat("date"), what);
      clean.title = null;
      if (o.title !== undefined) {
        if (o.title in TITLE_NAME) {
          clean.title = o.title;
        } else {
          flag(path.concat("title"), what, `title ${JSON.stringify(o.title)} is not "PE" or "EU"`);
        }
      }
      clean.engine = "";
      if (o.engine !== undefined) {
        if (isText(o.engine) && familyOf(o.engine)) {
          clean.engine = o.engine;
        } else {
          flag(path.concat("engine"), what, `engine ${JSON.stringify(o.engine)} does not start with NetImmerse, Gamebryo or CryENGINE2`);
        }
      }
      clean.changes = [];
      if (o.changes !== undefined) {
        if (Array.isArray(o.changes) && o.changes.every(isText)) {
          clean.changes = o.changes;
        } else {
          flag(path.concat("changes"), what, 'changes must be a list of texts: ["…", "…"]');
        }
      }
      clean.status = null;
      if (o.client_status !== undefined) {
        if (STATUSES.includes(o.client_status)) {
          clean.status = o.client_status;
        } else {
          flag(path.concat("client_status"), what, `client_status ${JSON.stringify(o.client_status)} is not "preserved", "partial" or "lost"`);
        }
      }
      clean.after = null;
      if (o.sort_after !== undefined) {
        if (isText(o.sort_after) && Object.prototype.hasOwnProperty.call(data.versions, o.sort_after)) {
          clean.after = o.sort_after;
        } else {
          flag(path.concat("sort_after"), what, `sort_after names ${JSON.stringify(o.sort_after)}, which is not a version`);
        }
      }
      clean.note = checkText(o.note, path.concat("note"), what, "note");
      clean.untilTranscribed = checkText(o.note_until_transcribed, path.concat("note_until_transcribed"), what, "note_until_transcribed");
      clean.origins = [];
      if (o.transcribed_from !== undefined) {
        if (!Array.isArray(o.transcribed_from)) {
          flag(path.concat("transcribed_from"), what, "transcribed_from must be a list [ ]");
        } else {
          o.transcribed_from.forEach((t, n) => {
            const at = path.concat("transcribed_from", n);
            if (!isObject(t) || !isText(t.label) || !isText(t.url)) {
              flag(at, what, `transcribed_from item ${n + 1} needs a "label" and a "url"`);
              return;
            }
            unknown(t, "origin", at, what);
            clean.origins.push(t);
          });
        }
      }
      clean.sources = [];
      if (o.sources !== undefined) {
        if (!Array.isArray(o.sources)) {
          flag(path.concat("sources"), what, "sources must be a list [ ]");
        } else {
          o.sources.forEach((s, n) => {
            const at = path.concat("sources", n);
            const which = `${what}, release-note source ${n + 1}`;
            if (!isObject(s)) {
              flag(at, which, "not an object { }");
              return;
            }
            unknown(s, "noteSource", at, which);
            if (![1, 2, 3, 4, 5].includes(s.tier)) {
              flag(at.concat("tier"), which, `tier ${JSON.stringify(s.tier)} is not a number from 1 to 5`);
              return;
            }
            if (!isText(s.label) || !s.label) {
              flag(at, which, 'it needs a "label"');
              return;
            }
            checkText(s.url, at.concat("url"), which, "url");
            checkDate(s.date, at.concat("date"), which);
            for (const name of ["preview", "names_only", "from_sheet"]) {
              checkFlag(s[name], at.concat(name), which, name);
            }
            clean.sources.push(s);
          });
        }
      }
      clean.onSite = ["sources", "note", "note_until_transcribed", "transcribed_from"].some((k) => k in o);
      if (clean.after === null && !SERIES.test(v)) {
        flag(path, what, "a name that is not a version number needs sort_after, the version it follows");
      }
      versions.set(v, clean);
    }
    const followed = new Map();
    for (const [v, o] of versions) {
      if (o.after !== null) {
        if (followed.has(o.after)) {
          flag(["versions", v, "sort_after"], `version ${v}`,
            `version ${followed.get(o.after)} also sorts after ${o.after}; make one of them follow the other`);
        }
        followed.set(o.after, v);
      }
    }

    // ---- the order: numbers in numeric order, an X after the numbered versions of its series, and a named
    //      version straight after the one its sort_after names
    const named = [...versions].filter(([, o]) => o.after !== null).map(([v, o]) => [v, o.after]);
    const numbered = [...versions.keys()].filter((v) => versions.get(v).after === null && sortKey(v));
    const unplaced = [...versions.keys()].filter((v) => versions.get(v).after === null && !sortKey(v));
    const order = numbered.sort((a, b) => compareKeys(sortKey(a), sortKey(b)));
    let pending = named;
    while (pending.length) {
      const ready = pending.filter(([, after]) => order.includes(after));
      if (!ready.length) {
        for (const [v] of pending) {
          flag(["versions", v, "sort_after"], `version ${v}`, "its sort_after goes round in a circle");
          unplaced.push(v);
        }
        break;
      }
      for (const [v, after] of ready) {
        order.splice(order.indexOf(after) + 1, 0, v);
      }
      pending = pending.filter((p) => !ready.includes(p));
    }
    order.push(...unplaced);

    // ---- notes.md
    const notes = new Map();
    const heads = [...notesText.matchAll(/^## VU (.*)$/gm)];
    heads.forEach((m, k) => {
      const version = versionOf(m[1]);
      const line = notesText.slice(0, m.index).split("\n").length;
      const end = k + 1 < heads.length ? heads[k + 1].index : notesText.length;
      const body = notesText.slice(m.index + m[0].length + 1, end).trim();
      if (!versions.has(version)) {
        problems.push({file: "notes.md", line,
          text: `"## VU ${m[1]}" names no version in versions.json, so its text is not shown`});
        return;
      }
      if (notes.has(version)) {
        problems.push({file: "notes.md", line,
          text: `VU ${version} has a second section (the first is at line ${notes.get(version).line}); only the second is shown`});
      }
      notes.set(version, {body, line});
    });

    // ---- files
    const files = [];
    (Array.isArray(data.files) ? data.files : []).forEach((f, n) => {
      const path = ["files", n];
      if (!isObject(f)) {
        flag(path, `file ${n + 1}`, "not an object { }");
        return;
      }
      const what = isText(f.name) && f.name ? `file ${f.name}` : isText(f.label) && f.label ? `file ${f.label}`
        : `file ${n + 1}${isText(f.version) && f.version ? ` (version ${f.version})` : ""}`;
      unknown(f, "file", path, what);
      const version = checkText(f.version, path.concat("version"), what, "version");
      if (NUMBER.test(version) && !versions.has(version)) {
        flag(path.concat("version"), what, `version "${version}" is not in versions; add it there, or correct the number`);
      }
      const status = STATUSES.includes(f.status) ? f.status : "lost";
      if (!STATUSES.includes(f.status)) {
        flag(path.concat("status"), what, `status ${JSON.stringify(f.status)} is not "preserved", "partial" or "lost"`);
      }
      let bytes = null;
      if (f.bytes !== undefined) {
        if (Number.isInteger(f.bytes) && f.bytes >= 0) {
          bytes = f.bytes;
        } else {
          flag(path.concat("bytes"), what, "bytes must be a whole number, with no quotes or commas");
        }
      }
      const estimated = checkFlag(f.version_estimated, path.concat("version_estimated"), what, "version_estimated");
      const file = {
        n,
        version,
        key: versions.has(version) ? version : null,
        label: checkText(f.label, path.concat("label"), what, "label"),
        estimated,
        name: checkText(f.name, path.concat("name"), what, "name"),
        size: bytes !== null ? `${(bytes / 1048576).toFixed(1)} MB`
          : f.size_mb !== undefined ? `${checkText(f.size_mb, path.concat("size_mb"), what, "size_mb")} MB` : "",
        bytes: bytes !== null ? `${bytes.toLocaleString("en-US")} bytes` : "",
        date: checkDate(f.date, path.concat("date"), what),
        dataIni: checkText(f.data_ini, path.concat("data_ini"), what, "data_ini"),
        status,
        note: checkText(f.note, path.concat("note"), what, "note"),
        sources: [],
      };
      if (file.size === " MB") {
        file.size = "";
      }
      if (!Array.isArray(f.sources)) {
        flag(path.concat("sources"), what, "sources must be a list [ ]");
      } else {
        f.sources.forEach((s, m) => {
          const at = path.concat("sources", m);
          const which = `${what}, source ${m + 1}`;
          if (!isObject(s)) {
            flag(at, which, "not an object { }");
            return;
          }
          unknown(s, "fileSource", at, which);
          const source = {
            label: checkText(s.label, at.concat("label"), which, "label"),
            url: checkText(s.url, at.concat("url"), which, "url"),
            available: checkFlag(s.available, at.concat("available"), which, "available"),
            image: checkText(s.image, at.concat("image"), which, "image"),
            note: checkText(s.note, at.concat("note"), which, "note"),
            evidence: [],
          };
          if (typeof s.available !== "boolean") {
            flag(at, which, "available must be true or false");
          }
          if (s.evidence !== undefined) {
            if (!Array.isArray(s.evidence)) {
              flag(at.concat("evidence"), which, "evidence must be a list [ ]");
            } else {
              s.evidence.forEach((e, k) => {
                const place = at.concat("evidence", k);
                if (!isObject(e) || !isText(e.label) || !e.label) {
                  flag(place, which, `evidence ${k + 1} needs a "label"`);
                  return;
                }
                unknown(e, "evidence", place, which);
                source.evidence.push({label: e.label, url: isText(e.url) ? e.url : ""});
              });
            }
          }
          if (!source.label && !source.evidence.length) {
            flag(at, which, "a source needs a label, evidence or both");
            return;
          }
          file.sources.push(source);
        });
      }
      files.push(file);
    });

    // ---- one entry per version
    const entries = order.map((v, index) => {
      const o = versions.get(v);
      const own = files.filter((f) => f.key === v);
      const note = notes.get(v);
      const body = note ? note.body : "";
      const e = {v, index, anchor: anchorOf(v), major: /^\d+\.\d+$/.test(v), engine: o.engine || "",
        changes: o.changes || [], files: own, body, hasText: body !== ""};
      if (o.date) {
        e.date = o.date;
        e.approx = !FULL_DATE.test(o.date);
        e.why = "";
      } else {
        e.date = own.map((f) => f.date).filter(Boolean).sort()[0] || "";
        e.approx = e.date !== "";
        e.why = e.date ? FILE_DATE_WHY : "";
      }
      e.year = e.date ? Number(e.date.slice(0, 4)) : null;
      e.onSite = !!o.onSite || e.hasText;
      e.noteSources = sourceOrder((o.sources || []).filter((s) => s.url));
      e.findable = e.noteSources.some(holdsNotes);
      e.editorNote = [o.note, e.hasText ? "" : o.untilTranscribed].filter(Boolean).join(" ");
      e.origins = e.hasText ? o.origins || [] : [];
      if (e.hasText && !e.noteSources.length) {
        problems.push({file: "notes.md", line: note.line,
          text: `VU ${v} has release notes but no source with a url in versions.json`});
      }
      if (o.status) {
        e.st = o.status;
      } else if (own.length) {
        e.st = own.map((f) => f.status).reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
      } else {
        e.st = "lost";
      }
      e.documented = e.st === "lost" && own.length > 0;
      return e;
    });
    const nearest = (values, i) => {
      for (let j = i - 1; j >= 0; j -= 1) {
        if (values[j]) {
          return values[j];
        }
      }
      for (let j = i + 1; j < values.length; j += 1) {
        if (values[j]) {
          return values[j];
        }
      }
      return null;
    };
    const titles = entries.map((e) => versions.get(e.v).title);
    const families = entries.map((e) => (e.engine ? familyOf(e.engine) : null));
    entries.forEach((e, i) => {
      e.title = titles[i] || nearest(titles, i) || "";
      e.family = families[i] || nearest(families, i) || "Engine not recorded";
    });
    const seenAnchors = new Map();
    for (const e of entries) {
      if (seenAnchors.has(e.anchor)) {
        flag(["versions", e.v], `version ${e.v}`, `its link #${e.anchor} is the same as version ${seenAnchors.get(e.anchor)}'s`);
      }
      seenAnchors.set(e.anchor, e.v);
    }

    // ---- the timeline: one notch per x.y update, its patches rolled in, in the order the sections show them
    const parentOf = (e) => {
      let v = e.v;
      for (let guard = 0; versions.get(v) && versions.get(v).after !== null && guard < 50; guard += 1) {
        v = versions.get(v).after;
      }
      return SERIES.test(v) ? v.split(".").slice(0, 2).join(".") : v;
    };
    const notchOf = new Map();
    for (const e of entries) {
      if (e.major) {
        notchOf.set(e.v, {e, members: [e]});
      }
    }
    for (const e of entries) {
      if (e.major) {
        continue;
      }
      let notch = notchOf.get(parentOf(e));
      if (!notch) {
        const before = entries.slice(0, e.index).reverse().find((x) => x.major);
        notch = notchOf.get((before || entries.find((x) => x.major) || e).v);
      }
      if (notch) {
        notch.members.push(e);
      }
    }
    const notches = entries.filter((e) => e.major).map((e) => {
      const n = notchOf.get(e.v);
      n.st = n.members.map((x) => x.st).reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
      n.target = n.members.find((x) => x.st === n.st && x.files.length) || n.e;
      return n;
    });

    // ---- the files no version is named for; each takes the engine its series or its year had, when that was one
    const oneFamily = (rows) => {
      const found = [...new Set(rows.map((e) => e.family))];
      return found.length === 1 && FAMILIES.includes(found[0]) ? found[0] : "";
    };
    const others = files.filter((f) => !f.key).map((f, k) => {
      const name = f.name || (f.sources.find((s) => s.label) || {}).label || "";
      const series = /^(\d+)\.[Xx]$/.exec(f.version);
      let family = "";
      let engineWhy = "";
      if (series) {
        family = oneFamily(entries.filter((e) => e.v.split(".")[0] === series[1]));
        engineWhy = `Not recorded for this file; taken from the ${series[1]}.x versions`;
      } else if (f.date) {
        for (const span of new Set([f.date, f.date.slice(0, 7), f.date.slice(0, 4)])) {
          family = oneFamily(entries.filter((e) => e.date.startsWith(span)));
          if (family) {
            engineWhy = `Not recorded for this file; taken from the versions released in ${span}`;
            break;
          }
        }
      }
      return {k, f, name, family, engineWhy: family ? engineWhy : "", isFile: !!f.name, vu: f.label || f.version,
        date: f.date,
        approx: f.date !== "" && !FULL_DATE.test(f.date), why: "The date of the client file",
        anchor: "file-" + (slug(name) || String(f.n + 1))};
    });
    const seenFiles = new Set();
    for (const o of others) {
      let anchor = o.anchor;
      for (let n = 2; seenFiles.has(anchor); n += 1) {
        anchor = `${o.anchor}-${n}`;
      }
      o.anchor = anchor;
      seenFiles.add(anchor);
    }

    // ---- the listing: every version, and each of those files in its place among them: after the versions of its
    //      series ("7.X" after the last 7.x), by its date when it has no version (after the last version released
    //      by then), and at the very end when it has neither
    const placeOf = (o) => {
      const key = sortKey(o.f.version);
      if (key) {
        const at = entries.findIndex((e) => sortKey(e.v) && compareKeys(sortKey(e.v), key) > 0);
        return at === -1 ? entries.length : at;
      }
      if (o.date) {
        let at = -1;
        entries.forEach((e, i) => {
          if (e.date && e.date.slice(0, o.date.length) <= o.date) {
            at = i;
          }
        });
        return at + 1;
      }
      return entries.length;
    };
    const placed = others.map((o) => [placeOf(o), o]);
    const rows = [];
    entries.forEach((e, i) => {
      rows.push(...placed.filter(([at]) => at === i).map(([, o]) => o), e);
    });
    rows.push(...placed.filter(([at]) => at === entries.length).map(([, o]) => o));
    rows.forEach((row, i) => {
      if (row.f) {
        const before = rows.slice(0, i).reverse().find((x) => !x.f);
        const after = rows.slice(i + 1).find((x) => !x.f);
        row.title = (before || after || {}).title || "";
        row.st = row.f.status;
        row.year = row.date ? Number(row.date.slice(0, 4)) : null;
      }
    });

    // ---- the sections: one per title, in the order the listing reaches them
    const sections = [...new Set(rows.map((r) => r.title))].map((title) => {
      const own = rows.filter((r) => r.title === title);
      const years = own.filter((r) => !r.f).map((r) => r.year).filter(Boolean);
      const name = TITLE_NAME[title] || "Title not recorded";
      const span = years.length ? (Math.min(...years) === Math.max(...years) ? `${years[0]}`
        : `${Math.min(...years)}-${Math.max(...years)}`) : "";
      return {name, title, id: slug(name), rows: own, span};
    });
    for (const r of rows) {
      r.section = sections.find((section) => section.title === r.title);
    }

    const counts = {preserved: 0, partial: 0, lost: 0};
    rows.forEach((r) => { counts[r.st] += 1; });
    const years = entries.map((e) => e.year).filter(Boolean);
    const span = years.length ? Array.from({length: Math.max(...years) - Math.min(...years) + 1},
      (_, k) => Math.min(...years) + k) : [];
    return {entries, rows, sections, notches, others, counts, problems, files, years: span,
      images: [...new Set(files.flatMap((f) => f.sources.map((s) => s.image)).filter(Boolean))]};
  }

  // ------------------------------------------------------------------------------------------ drawing

  function badge(status) {
    return `<span class="badge ${status}">${BADGE[status]}</span>`;
  }

  function columnBadge(status) {
    return status === "preserved" || status === "partial" ? badge(status) : "";
  }

  function dateHTML(item) {
    if (!item.date) {
      return '<span class="date unknown">unknown</span>';
    }
    if (item.approx) {
      const why = item.why || (item.date.length === 4 ? "Approximate: the year is known, the month is not"
        : "Approximate: the month is known, the day is not");
      return `<span class="date approx" title="${esc(why)}">${esc(item.date)}</span>`;
    }
    return `<span class="date">${esc(item.date)}</span>`;
  }

  function engineHTML(e) {
    if (!FAMILIES.includes(e.family)) {
      return '<span class="engine"></span>';
    }
    const why = !e.engine ? "Not recorded for this version; taken from the versions around it"
      : e.engine !== e.family ? e.engine : "";
    return `<span class="engine"${why ? ` title="${esc(why)}"` : ""}>${esc(e.family)}</span>`;
  }

  function notchTitle(n) {
    const parts = [n.e.v, n.e.date || "date unknown", TITLE_NAME[n.e.title] || "",
      FAMILIES.includes(n.e.family) ? n.e.family : ""].filter(Boolean);
    const said = {preserved: "client preserved", partial: "client partly preserved"};
    for (const st of ["preserved", "partial"]) {
      const vs = n.members.filter((m) => m.st === st).map((m) => m.v);
      if (vs.length) {
        parts.push(`${said[st]}: ${vs.join(", ")}`);
      }
    }
    if (n.st === "lost") {
      parts.push("client lost");
    }
    const documented = n.members.filter((m) => m.documented).map((m) => m.v);
    if (documented.length) {
      parts.push(`file documented, no copy found: ${documented.join(", ")}`);
    }
    const k = n.members.length - 1;
    if (k) {
      parts.push(`+${count(k, "patch", "patches")}`);
    }
    return parts.join(" · ");
  }

  /* A label under the first notch of each year, dropped when the next one starts before this one has room, and
     hung off the last notch when it would run past the end. */
  function yearLabels(items, room) {
    const starts = [];
    let seen = 0;
    items.forEach((n, i) => {
      if (n.e.year && n.e.year > seen) {
        starts.push([i, n.e.year]);
        seen = n.e.year;
      }
    });
    const out = new Map();
    starts.filter(([i], j) => j + 1 === starts.length || starts[j + 1][0] - i >= room).forEach(([i, year]) => {
      const hung = i + room > items.length;
      out.set(hung ? items.length - 1 : i, [year, hung ? "right" : "left"]);
    });
    return out;
  }

  function overviewHTML(m) {
    const years = yearLabels(m.notches, 2);
    const groups = m.sections.map((section) => m.notches.filter((n) => n.e.section === section)).filter((g) => g.length);
    let i = 0;
    const cells = groups.map((g) => `<div class="strip-group" style="flex: ${g.length} 1 0px;">` + g.map((n) => {
      const year = years.get(i);
      i += 1;
      const label = year ? `<span class="year ${year[1]}">${year[0]}</span>` : "";
      return `<a class="cell ${n.st}" href="#${esc(n.target.anchor)}" tabindex="-1" title="${esc(notchTitle(n))}">${label}</a>`;
    }).join("") + "</div>").join("");
    const labels = groups.map((g) => `<span style="flex: ${g.length} 1 0px;">${esc(g[0].e.section.name)}</span>`).join("");
    return `<section aria-label="Surviving clients at a glance">
<div aria-hidden="true"><div class="strip-labels">${labels}</div><div class="strip">${cells}</div></div>
<ul class="legend"><li><span class="swatch preserved"></span>Preserved</li><li><span class="swatch partial"></span>Partial</li>`
      + `<li><span class="swatch lost"></span>Lost</li></ul>
</section>`;
  }

  function filtersHTML(m) {
    const select = (name, label, options, chosen) => `<select class="fsel" data-filter="${name}" aria-label="${label}">`
      + options.map(([value, text]) => `<option value="${esc(value)}"${value === chosen ? " selected" : ""}>${esc(text)}</option>`)
        .join("") + "</select>";
    const years = m.years.map((y) => [String(y), String(y)]);
    const titles = [["", "Any"]].concat(["PE", "EU"].map((t) =>
      [t, `${TITLE_NAME[t]} (${m.rows.filter((r) => r.title === t).length})`]));
    const clients = [["", "Any"]].concat(STATUSES.map((s) => [s, `${BADGE[s]} (${m.counts[s]})`]));
    const engines = [["", "Any"]].concat(FAMILIES.filter((f) => m.rows.some((r) => r.family === f)).map((f) =>
      [f, `${f} (${m.rows.filter((r) => r.family === f).length})`]));
    const last = years.length ? years[years.length - 1][0] : "";
    return `<div class="filters" role="search" aria-label="Filter the versions">
<div class="range" role="group" aria-label="Date"><span>Date</span>${select("from", "From year", years, years.length ? years[0][0] : "")}`
      + `<span>to</span>${select("to", "To year", years, last)}</div>
<label><span>Title</span>${select("title", "Title", titles, "")}</label>
<label><span>Client</span>${select("client", "Client", clients, "")}</label>
<label><span>Engine</span>${select("engine", "Engine", engines, "")}</label>
<span class="spacer"></span><button type="button" class="fclear" hidden>Clear filters</button>
</div>`;
  }

  function sourceText(s) {
    if (s.available) {
      return s.url ? link(s.url, s.label, isUrl(s.label) ? "url" : "") : esc(s.label);
    }
    if (/bt4gprx|magnet/.test(`${s.label} ${s.url}`)) {
      return "BitTorrent, a magnet listing";
    }
    if (s.label.includes("infohash")) {
      return "BitTorrent DHT";
    }
    return isUrl(s.label) ? `<span class="url">${esc(s.label)}</span>` : esc(s.label);
  }

  function isUrl(text) {
    return /^(https?|ftp):\/\//.test(text) || /^[\w.-]+\.\w{2,}\//.test(text);
  }

  function evidenceHTML(items, labelled) {
    const list = `<ul class="plain">${items.map((i) => `<li>${i.url ? link(i.url, i.label) : esc(i.label)}</li>`).join("")}</ul>`;
    return labelled ? `<div class="evidence"><span>Evidence</span>${list}</div>` : list;
  }

  function sourceBlock(s) {
    const note = s.note ? `<p class="src-note">${s.note.split("\n").map(esc).join("<br>")}</p>` : "";
    let label;
    let body;
    if (s.label) {
      label = s.available ? "Found on" : "Once on";
      body = `<div>${sourceText(s)}</div>${note}` + (s.evidence.length ? evidenceHTML(s.evidence, true) : "");
    } else {
      label = "Known from";
      body = evidenceHTML(s.evidence, false) + note;
    }
    body = `<div class="src">${body}</div>`;
    if (s.image) {
      body = `<div class="src-thumb"><img class="thumb" src="${esc(s.image)}" alt="${esc(s.label || "Disc")}" width="64" `
        + `height="64" loading="lazy">${body}</div>`;
    }
    return [label, body];
  }

  function fileCard(f, showLabel) {
    const name = f.name ? `<span class="fname">${esc(f.name)}</span>` : '<span class="noname">File name not recorded</span>';
    const shown = f.label || (f.estimated && f.version ? `${f.version} (est)` : "");
    const label = showLabel && shown ? `<span class="flabel">${esc(shown)}</span>` : "";
    const meta = [f.size, f.bytes, f.date, f.dataIni ? `data.ini ${f.dataIni}` : ""].filter(Boolean);
    const metaHTML = meta.length ? `<div class="card-meta">${meta.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : "";
    const noteHTML = f.note ? `<p class="card-note">${esc(f.note)}</p>` : "";
    const blocks = f.sources.map(sourceBlock);
    const grid = blocks.map(([lab, body], k) =>
      `<span class="src-label">${k === 0 || blocks[k - 1][0] !== lab ? lab : ""}</span>${body}`).join("");
    return `<div class="card"><div class="card-head">${name}${label}${badge(f.status)}</div>${metaHTML}${noteHTML}`
      + `<div class="card-sources">${grid}</div></div>`;
  }

  function noteSourceHTML(s) {
    const archived = /web\.archive\.org\/web\/(\d{4})(\d{2})(\d{2})/.exec(s.url);
    const meta = archived ? ` <span class="meta">archived ${archived[1]}-${archived[2]}-${archived[3]}</span>` : "";
    const target = safeUrl(s.url) ? `<a href="${esc(s.url)}">${esc(s.label)}</a>` : esc(s.label);
    return `<li><span class="tier t${s.tier}" title="${esc(TIER_HELP[s.tier])}">${TIER_NAMES[s.tier]}</span> ${target}${meta}</li>`;
  }

  function notesPanel(e) {
    const parts = [];
    if (e.editorNote) {
      parts.push(`<p class="note">${esc(e.editorNote)}</p>`);
    }
    if (e.hasText) {
      parts.push(`<div class="text">${markdown(e.body)}</div>`);
      if (e.origins.length) {
        parts.push(`<p class="origin">Transcribed from ${e.origins.map((o) => link(o.url, o.label)).join(", ")}.</p>`);
      }
    } else if (e.findable) {
      parts.push('<p class="empty">Not transcribed yet. The sources below hold the notes.</p>');
    } else if (e.noteSources.length) {
      parts.push('<p class="empty">No surviving copy of these notes has been found. The sources below only name or '
        + "describe this version.</p>");
    } else {
      parts.push('<p class="empty">No surviving copy of these notes has been found.</p>');
    }
    parts.push("<h3>Sources</h3>");
    parts.push(e.noteSources.length ? `<ol class="sources">${e.noteSources.map(noteSourceHTML).join("")}</ol>`
      : '<p class="empty">No source recorded.</p>');
    return parts.join("\n");
  }

  function button(kind, panelId, text) {
    return `<button type="button" class="pt ${kind}" aria-expanded="false" aria-controls="${esc(panelId)}">${CHEVRON}${text}</button>`;
  }

  function entryHTML(e) {
    const n = e.files.length;
    const filesId = `${e.anchor}-files`;
    const notesId = `${e.anchor}-notes`;
    const toggles = (n ? button("pf", filesId, count(n, "file")) : "") + (e.onSite ? button("pn", notesId, "Changes") : "");
    return `<div class="entry" data-i="${e.index}">
<div class="row${e.major ? " major" : ""}" id="${esc(e.anchor)}"><span class="ver">${esc(e.v)}</span>${dateHTML(e)}`
      + `${engineHTML(e)}<span class="client">${columnBadge(e.st)}</span><div class="main"><span class="changes">`
      + `${e.changes.map(esc).join("<br>")}</span><div class="toggles">${toggles}</div></div>`
      + `<a class="permalink" href="#${esc(e.anchor)}" title="Link to this version">#</a></div>`
      + (n ? `\n<div class="panel files" id="${esc(filesId)}" hidden="until-found">${e.files.map((f) => fileCard(f, true)).join("")}</div>` : "")
      + (e.onSite ? `\n<div class="panel notes" id="${esc(notesId)}" hidden="until-found">${notesPanel(e)}</div>` : "")
      + "\n</div>";
  }

  const LABELS = '<div class="labels"><span>VU</span><span>Date</span><span>Engine</span><span>Client</span>'
    + "<span>Important changes</span><span></span></div>";

  function sectionHTML(section, k) {
    const rows = section.rows.map((r) => (r.f ? fileRowHTML(r) : entryHTML(r))).join("\n");
    return `<section class="section" data-section="${k}" aria-labelledby="${section.id}">
<div class="section-head"><h2 id="${section.id}">${esc(section.name)} <span>${section.span}</span></h2></div>
${LABELS}
${rows}
<div class="list-end"></div>
</section>`;
  }

  function fileRowHTML(o) {
    const vu = o.vu ? `<span class="ver">${esc(o.vu)}</span>` : '<span class="ver muted">-</span>';
    const name = o.isFile ? `<span class="fname-cell">${esc(o.name)}</span>` : esc(o.name);
    const engine = o.family ? `<span class="engine" title="${esc(o.engineWhy)}">${esc(o.family)}</span>`
      : '<span class="engine"></span>';
    const panelId = `${o.anchor}-files`;
    return `<div class="entry" data-file="${o.k}">
<div class="row" id="${esc(o.anchor)}">${vu}${dateHTML(o)}${engine}<span class="client">${columnBadge(o.st)}</span>`
      + `<div class="main"><span class="changes">${name}</span><div class="toggles">${button("pf", panelId, "1 file")}</div></div>`
      + `<a class="permalink" href="#${esc(o.anchor)}" title="Link to this file">#</a></div>
<div class="panel files" id="${esc(panelId)}" hidden="until-found">${fileCard(o.f, false)}</div>
</div>`;
  }

  function showProblems(problems) {
    const box = document.getElementById("problems");
    if (!problems.length) {
      box.innerHTML = "";
      return;
    }
    const sorted = problems.slice().sort((a, b) => (a.file === b.file ? (a.line || 0) - (b.line || 0) : a.file < b.file ? 1 : -1));
    box.innerHTML = `<details class="problems" open><summary>${count(problems.length, "problem")} in the page's data</summary><ul>`
      + sorted.map((p) => `<li><span class="muted">${esc(p.file)}${p.line ? `, line ${p.line}` : ""}:</span> ${esc(p.text)}</li>`)
        .join("") + "</ul></details>";
  }

  // ------------------------------------------------------------------------------------------ the page at work

  function wire(m, root) {
    const first = m.years[0];
    const last = m.years[m.years.length - 1];
    const state = {from: first, to: last, title: "", client: "", engine: ""};
    for (const r of m.rows) {
      r.el = root.querySelector(r.f ? `.entry[data-file="${r.k}"]` : `.entry[data-i="${r.index}"]`);
    }
    m.sections.forEach((section, k) => {
      section.el = root.querySelector(`section[data-section="${k}"]`);
    });
    const nomatch = root.querySelector(".nomatch");
    const clearButton = root.querySelector(".fclear");
    const selects = [...root.querySelectorAll("select[data-filter]")];

    const setPanel = (panel, open) => {
      if (open) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "until-found");
      }
      const control = root.querySelector(`[aria-controls="${CSS.escape(panel.id)}"]`);
      if (control) {
        control.setAttribute("aria-expanded", String(open));
      }
    };

    const apply = () => {
      const full = state.from === first && state.to === last;
      const filtered = !full || state.title !== "" || state.client !== "" || state.engine !== "";
      let shown = 0;
      const sectionShown = new Set();
      for (const r of m.rows) {
        const on = (r.year ? r.year >= state.from && r.year <= state.to : full)
          && (state.title === "" || r.title === state.title)
          && (state.client === "" || r.st === state.client)
          && (state.engine === "" || r.family === state.engine);
        r.el.hidden = !on;
        if (on) {
          shown += 1;
          sectionShown.add(r.section);
        }
      }
      m.sections.forEach((section) => {
        section.el.hidden = !sectionShown.has(section);
      });
      nomatch.hidden = shown > 0;
      clearButton.hidden = !filtered;
    };

    const clear = () => {
      Object.assign(state, {from: first, to: last, title: "", client: "", engine: ""});
      for (const select of selects) {
        select.value = String(state[select.dataset.filter]);
      }
      apply();
    };

    for (const select of selects) {
      select.addEventListener("change", () => {
        const key = select.dataset.filter;
        state[key] = key === "from" || key === "to" ? Number(select.value) : select.value;
        apply();
      });
    }

    root.addEventListener("click", (event) => {
      const cell = event.target.closest("a.cell");
      if (cell) {
        event.preventDefault();
        const id = cell.getAttribute("href").slice(1);
        if (location.hash.slice(1) !== id) {
          history.pushState(null, "", "#" + id);
        }
        show(document.getElementById(id), "files");
        return;
      }
      const control = event.target.closest("button[aria-controls]");
      if (control) {
        const panel = document.getElementById(control.getAttribute("aria-controls"));
        setPanel(panel, control.getAttribute("aria-expanded") !== "true");
      } else if (event.target.closest(".fclear")) {
        clear();
      }
    });

    // Find in page opens a closed panel that holds what it found; its button follows.
    root.addEventListener("beforematch", (event) => {
      const panel = event.target;
      const control = root.querySelector(`[aria-controls="${CSS.escape(panel.id)}"]`);
      if (control) {
        control.setAttribute("aria-expanded", "true");
      }
    });

    // A link to a version opens its release notes, as it always has (#vu-5.7, #5.7, #vu-4 for 4.0), or its files
    // when it has no notes; a link to a file of its own opens that file; #vu-5.4-files or #vu-5.4-notes opens that
    // panel. A timeline notch opens files first.
    const show = (el, first) => {
      if (el.closest(".entry[hidden], section[hidden]")) {
        clear();
      }
      const holder = el.closest(".entry");
      if (holder && el.classList.contains("panel")) {
        setPanel(el, true);
        el = holder.querySelector(":scope > .row");
      } else if (holder && el.classList.contains("row")) {
        const notes = holder.querySelector(":scope > .panel.notes");
        const files = holder.querySelector(":scope > .panel.files");
        const panel = first === "files" ? files || notes : notes || files;
        if (panel) {
          setPanel(panel, true);
        }
      }
      el.scrollIntoView();
    };

    const openFromHash = () => {
      const raw = decodeURIComponent(location.hash.slice(1)).trim();
      if (!raw) {
        return;
      }
      const lower = raw.toLowerCase().replace(/\s+/g, "-");
      const bare = lower.replace(/^vu-/, "");
      const el = [raw, lower, "vu-" + bare, "vu-" + bare + ".0"].map((id) => document.getElementById(id)).find(Boolean);
      if (el) {
        show(el, "notes");
      }
    };

    apply();
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
  }

  async function get(url) {
    const response = await fetch(url, {cache: "no-cache"});
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status} ${response.statusText}`.trim());
    }
    return response.text();
  }

  function fatal(app, html) {
    app.innerHTML = `<p class="fatal">${html}</p>`;
  }

  async function start() {
    const app = document.getElementById("app");
    if (location.protocol === "file:") {
      const folder = decodeURIComponent(location.pathname.replace(/\/[^/]*$/, "")).replace(/^\/([A-Za-z]:)/, "$1");
      fatal(app, "This page reads versions.json and notes.md, which browsers will not load from a file on disk. "
        + "Serve its folder instead: run "
        + `<code>python -m http.server --bind 127.0.0.1 --directory "${esc(folder)}"</code> and open `
        + '<a href="http://localhost:8000/">http://localhost:8000/</a>.');
      return;
    }
    let json;
    let notes;
    try {
      [json, notes] = await Promise.all([get("versions.json"), get("notes.md")]);
    } catch (error) {
      fatal(app, `The page could not load its data: ${esc(error.message)}.`);
      return;
    }
    let scanned;
    let data;
    try {
      scanned = scan(json);
      data = JSON.parse(json);
    } catch (error) {
      fatal(app, `versions.json could not be read, at ${esc(error.message)}. Nothing is shown until it is fixed.`);
      return;
    }
    const m = build(data, notes.replace(/\r\n?/g, "\n"), scanned);
    app.innerHTML = [overviewHTML(m), filtersHTML(m), m.sections.map(sectionHTML).join("\n"),
      '<p class="nomatch" hidden>No versions match these filters.</p>'].join("\n");
    showProblems(m.problems);
    wire(m, app);
    for (const image of m.images) {
      fetch(image, {method: "HEAD", cache: "no-cache"}).then((response) => {
        if (!response.ok) {
          m.problems.push({file: "versions.json", text: `image "${image}" answered ${response.status}; is it in the folder?`});
          showProblems(m.problems);
        }
      }, () => {});
    }
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {scan, build, markdown, inline, holdsNotes, notchTitle, yearLabels, fileCard, notesPanel,
      noteSourceHTML, entryHTML, fileRowHTML, overviewHTML, filtersHTML};
  } else {
    start();
  }
})();
