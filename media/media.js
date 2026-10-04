/* Entropia Archive media: the gallery's tag search, Year or VU range, source filter and pages of 72 (6 x 12), all
   kept in the address; on a picture's page, Back to the gallery as it was left. Without this file every picture
   shows and the filter bar and the pages are hidden. */
(function () {
  "use strict";
  document.documentElement.dataset.script = "1";
  const KEPT = "entropia-media-filters";
  const back = document.querySelector("a.back");
  if (back) {
    try {
      const filters = sessionStorage.getItem(KEPT);
      if (filters) {
        back.href = `../${filters}${back.hash}`;
      }
    } catch {
      // Without storage, Back opens the whole gallery at this picture.
    }
    return;
  }
  const bar = document.querySelector(".filters");
  if (!bar) {
    return;
  }
  const PER_PAGE = 72;
  const gallery = document.querySelector(".gallery");
  const pager = document.querySelector(".pager");
  const none = document.querySelector(".nomatch");
  const clear = bar.querySelector(".fclear");
  const kind = document.getElementById("range-kind");
  const ranges = Array.from(bar.querySelectorAll("[data-range]"));
  const selects = Array.from(bar.querySelectorAll("select[data-filter]"));
  const input = document.getElementById("tag-input");
  const suggest = document.getElementById("tag-suggest");
  const chips = bar.querySelector(".tag-chips");
  const list = JSON.parse(document.getElementById("tag-list").textContent);
  const bySlug = new Map(list.map((t) => [t.s, t]));
  const words = (text) => new Set((text || "").split(" ").filter(Boolean));
  const bound = (text, open) => (text ? Number(text) : open);
  const items = Array.from(gallery.querySelectorAll(".pic"), (li) => {
    const d = li.dataset;
    return {li, tags: words(d.tags), sources: words(d.source), dated: d.from !== undefined,
            from: bound(d.from, -Infinity), to: bound(d.to, Infinity), vu: d.vu ? d.vu.split(" ").map(Number) : null};
  });
  const places = {};
  for (const name of ["vufrom", "vuto"]) {
    places[name] = new Map(Array.from(bar.querySelectorAll(`select[data-filter="${name}"] option[data-place]`),
      (o) => [o.value, Number(o.dataset.place)]));
  }

  const params = new URLSearchParams(location.search);
  for (const select of selects) {
    const wanted = params.get(select.dataset.filter);
    if (wanted && Array.from(select.options).some((o) => o.value === wanted)) {
      select.value = wanted;
    }
  }
  kind.value = params.get("vufrom") || params.get("vuto") ? "vu" : "year";
  let page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);
  let tags = [];
  let active = 0;
  const choose = (s, not) => {
    if (bySlug.has(s) && !tags.some((t) => t.s === s)) {
      tags.push({s, not});
    }
  };
  for (const part of (params.get("tags") || "").split(",")) {
    choose(part.replace(/^-/, ""), part.startsWith("-"));
  }

  // Only the chosen range's fields show, and the other's are cleared, so no hidden range keeps filtering.
  function showRange() {
    for (const range of ranges) {
      range.hidden = range.dataset.range !== kind.value;
      if (range.hidden) {
        for (const select of range.querySelectorAll("select")) {
          select.value = "";
        }
      }
    }
  }

  function chosen() {
    const f = {};
    if (tags.length) {
      f.tags = tags.map((t) => (t.not ? "-" : "") + t.s).join(",");
    }
    for (const select of selects) {
      if (select.value) {
        f[select.dataset.filter] = select.value;
      }
    }
    return f;
  }

  // An open end of a date or VU range reaches as far as it may.
  function test(f) {
    const years = f.from || f.to ? [bound(f.from, -Infinity), bound(f.to, Infinity)] : null;
    const vus = f.vufrom || f.vuto
      ? [f.vufrom ? places.vufrom.get(f.vufrom) : -Infinity, f.vuto ? places.vuto.get(f.vuto) : Infinity] : null;
    return (item) => tags.every((t) => item.tags.has(t.s) !== t.not)
      && (!f.source || item.sources.has(f.source))
      && (!vus || (item.vu !== null && item.vu[0] <= vus[1] && item.vu[1] >= vus[0]))
      && (!years || (item.dated && item.from <= years[1] && item.to >= years[0]));
  }

  function address(f, number) {
    const query = Object.entries(f).map(([k, v]) => `${k}=${k === "tags" ? v : encodeURIComponent(v)}`);
    if (number > 1) {
      query.push(`page=${number}`);
    }
    return query.length ? `?${query.join("&")}` : location.pathname;
  }

  /* ---------- the tag search ---------- */

  function drawChips() {
    chips.textContent = "";
    for (const t of tags) {
      const label = bySlug.get(t.s).l;
      const chip = document.createElement("span");
      chip.className = t.not ? "tag-chip without" : "tag-chip";
      const name = document.createElement("button");
      name.type = "button";
      name.className = "tag-name";
      name.textContent = t.not ? `not ${label}` : label;
      name.title = t.not ? "Left out. Click to require it instead." : "Required. Click to leave it out instead.";
      name.addEventListener("click", () => {
        t.not = !t.not;
        changed();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tag-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${label}`);
      remove.addEventListener("click", () => {
        tags = tags.filter((x) => x !== t);
        changed();
        input.focus();
      });
      chip.append(name, remove);
      chips.append(chip);
    }
  }

  // Names starting with the text first, then names or broader places containing it: "eudoria" offers its places.
  function candidates() {
    const query = input.value.trim().replace(/^-\s*/, "").toLowerCase();
    const free = list.filter((t) => !tags.some((c) => c.s === t.s));
    if (!query) {
      return free;
    }
    const starts = free.filter((t) => t.l.toLowerCase().startsWith(query));
    return [...starts, ...free.filter((t) => !starts.includes(t)
      && (t.l.toLowerCase().includes(query) || t.p.toLowerCase().includes(query)))];
  }

  function highlight() {
    Array.from(suggest.children).forEach((option, n) => {
      option.classList.toggle("active", n === active);
      option.setAttribute("aria-selected", String(n === active));
    });
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", `tag-option-${active}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function drawSuggestions() {
    const found = candidates();
    active = found.length ? Math.min(Math.max(active, 0), found.length - 1) : -1;
    suggest.textContent = "";
    found.forEach((t, n) => {
      const option = document.createElement("li");
      option.id = `tag-option-${n}`;
      option.setAttribute("role", "option");
      const name = document.createElement("span");
      name.className = "s-name";
      name.textContent = t.l;
      const where = document.createElement("span");
      where.className = "s-path";
      where.textContent = t.p;
      const without = document.createElement("button");
      without.type = "button";
      without.className = "s-not";
      without.tabIndex = -1;
      without.textContent = "without";
      // mousedown, not click: the search box keeps the focus, so the list stays open for the next tag.
      option.addEventListener("mousedown", (event) => {
        event.preventDefault();
        pick(t.s, event.target === without || input.value.trim().startsWith("-"));
      });
      option.addEventListener("mousemove", () => {
        if (active !== n) {
          active = n;
          highlight();
        }
      });
      option.append(name, where, without);
      suggest.append(option);
    });
    suggest.hidden = !found.length || document.activeElement !== input;
    input.setAttribute("aria-expanded", String(!suggest.hidden));
    highlight();
  }

  function pick(s, not) {
    choose(s, not);
    input.value = "";
    active = 0;
    changed();
    drawSuggestions();
  }

  function changed() {
    drawChips();
    show(true);
  }

  input.addEventListener("input", () => {
    active = 0;
    drawSuggestions();
  });
  input.addEventListener("focus", drawSuggestions);
  input.addEventListener("blur", () => {
    suggest.hidden = true;
    input.setAttribute("aria-expanded", "false");
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const count = suggest.children.length;
      if (count) {
        active = (active + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
        highlight();
        suggest.children[active].scrollIntoView({block: "nearest"});
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const found = candidates();
      if (found[active]) {
        pick(found[active].s, input.value.trim().startsWith("-"));
      }
    } else if (event.key === "Escape") {
      input.value = "";
      input.blur();
    } else if (event.key === "Backspace" && !input.value && tags.length) {
      tags.pop();
      changed();
    }
  });

  /* ---------- the pages ---------- */

  // Every page number when there are few, else the first, the last and two either side of this one.
  function numbers(count) {
    const shown = [];
    for (let n = 1; n <= count; n += 1) {
      if (count <= 9 || n === 1 || n === count || Math.abs(n - page) <= 2) {
        shown.push(n);
      } else if (shown[shown.length - 1] !== null) {
        shown.push(null);
      }
    }
    return shown;
  }

  function drawPager(f, count) {
    pager.textContent = "";
    if (count < 2) {
      return;
    }
    const item = (number, text, current) => {
      if (number === null) {
        const span = document.createElement("span");
        span.className = "off";
        span.textContent = text;
        pager.append(span);
        return;
      }
      const a = document.createElement("a");
      a.href = address(f, number);
      a.textContent = text;
      if (current) {
        a.setAttribute("aria-current", "page");
      }
      a.addEventListener("click", (event) => {
        event.preventDefault();
        page = number;
        show(false);
        gallery.scrollIntoView({block: "start"});
      });
      pager.append(a);
    };
    item(page > 1 ? page - 1 : null, "Previous");
    for (const n of numbers(count)) {
      item(n, n === null ? "…" : String(n), n === page);
    }
    item(page < count ? page + 1 : null, "Next");
  }

  // focus: the picture whose page to show, when coming Back from it.
  function show(reset, focus) {
    const f = chosen();
    if (reset) {
      page = 1;
    }
    const found = items.filter(test(f));
    const at = focus ? found.findIndex((item) => item.li === focus) : -1;
    if (at >= 0) {
      page = Math.floor(at / PER_PAGE) + 1;
    }
    const count = Math.max(1, Math.ceil(found.length / PER_PAGE));
    page = Math.min(page, count);
    const visible = new Set(found.slice((page - 1) * PER_PAGE, page * PER_PAGE));
    for (const item of items) {
      item.li.hidden = !visible.has(item);
    }
    none.hidden = found.length > 0;
    clear.hidden = Object.keys(f).length === 0;
    drawPager(f, found.length ? count : 0);
    history.replaceState(null, "", address(f, page));
  }

  for (const select of selects) {
    select.addEventListener("change", () => show(true));
  }
  kind.addEventListener("change", () => {
    showRange();
    show(true);
  });
  clear.addEventListener("click", () => {
    for (const select of selects) {
      select.value = "";
    }
    tags = [];
    drawChips();
    show(true);
  });
  gallery.addEventListener("click", (event) => {
    if (event.target.closest("a.shot")) {
      const query = address(chosen(), 1);
      try {
        sessionStorage.setItem(KEPT, query.startsWith("?") ? query : "");
      } catch {
        // Without storage, the picture's Back opens the whole gallery at that picture.
      }
    }
  });
  showRange();
  drawChips();
  const target = location.hash.startsWith("#p-") ? document.getElementById(location.hash.slice(1)) : null;
  show(false, target);
  if (target && !target.hidden) {
    target.scrollIntoView({block: "center"});
  }
})();
