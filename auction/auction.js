/* Entropia Archive auction: filter the list by category, source, a VU an item was auctioned in and words, all kept in
   the address, and open an item's auctions in a popup: read from its data file, they show as a chart of the markup
   over time (each sale a dot, the price sites' readings a line each), a table of sales, unsold auctions and readings,
   newest first, with each record's sources and captures, and PE Auction's own charts. Without this file every item shows
   with a link to its data file and the filter bar is hidden. */
(function () {
  "use strict";
  document.documentElement.dataset.script = "1";
  const bar = document.querySelector(".filters");
  if (!bar) {
    return;
  }
  const page = JSON.parse(document.getElementById("a-data").textContent);
  const controls = Array.from(bar.querySelectorAll("[data-filter]"));
  const clear = bar.querySelector(".fclear");
  const tally = document.querySelector(".shown");
  const none = document.querySelector(".nomatch");
  const items = Array.from(document.querySelectorAll(".item"), (li) => ({
    li, cat: li.dataset.cat, src: li.dataset.src.split(" "), text: li.dataset.text,
    v: new Set(li.dataset.v.split(" ").filter(Boolean).map(Number)),
  }));
  const rank = new Map(Array.from(bar.querySelector('[data-filter="vu"]').options).filter((o) => o.value)
    .map((o) => [o.value, Number(o.dataset.rank)]));
  const VUS = page.vus;

  const params = new URLSearchParams(location.search);
  for (const control of controls) {
    const wanted = params.get(control.dataset.filter);
    if (wanted && (control.tagName !== "SELECT" || Array.from(control.options).some((o) => o.value === wanted))) {
      control.value = wanted;
    }
  }
  function chosen() {
    const f = {};
    for (const control of controls) {
      const value = control.value.trim();
      if (value) {
        f[control.dataset.filter] = value;
      }
    }
    return f;
  }
  function matches(item, f) {
    const words = (f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (!f.cat || item.cat === f.cat) && (!f.src || item.src.includes(f.src))
      && (!f.vu || item.v.has(rank.get(f.vu))) && words.every((w) => item.text.includes(w));
  }
  function show() {
    const f = chosen();
    let shown = 0;
    for (const item of items) {
      item.li.hidden = !matches(item, f);
      shown += item.li.hidden ? 0 : 1;
    }
    tally.textContent = `${shown} of ${items.length} items`;
    none.hidden = shown > 0;
    clear.hidden = Object.keys(f).length === 0;
    const query = Object.entries(f).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`).join("&");
    history.replaceState(null, "", query ? `?${query}${location.hash}` : location.pathname + location.hash);
    if (opened) {
      draw();
    }
  }
  for (const control of controls) {
    control.addEventListener(control.tagName === "SELECT" ? "change" : "input", show);
  }
  clear.addEventListener("click", () => {
    for (const control of controls) {
      control.value = "";
    }
    show();
  });

  // --- an item's auctions --------------------------------------------------------------------------------------

  const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const money = (n) => (n === null || n === undefined ? "" : n.toLocaleString("en", {minimumFractionDigits: 2, maximumFractionDigits: 2}));
  const vuOf = (when) => {
    const day = when.slice(0, 10);
    let found = null;
    for (const [v, date] of VUS) {
      if (date <= day) found = v;
    }
    return found;
  };
  const captureDay = (url) => {
    const m = url.match(/\/web\/(\d{4})(\d\d)(\d\d)/);
    return `${m[1]}-${m[2]}-${m[3]}`;
  };
  const value = (data, tt, bid) => (tt === null || bid === null ? null : data.markup === "%" ? (tt > 0 ? bid / tt * 100 : null) : bid - tt);
  const markupText = (data, tt, bid) => {
    const m = value(data, tt, bid);
    if (m === null) return "";
    return data.markup === "%" ? `${m.toFixed(2)}%` : `${m < 0 ? "-" : "+"}${money(Math.abs(m))}`;
  };

  // A record's sources behind a question mark: each site with the time it printed and the capture it was read from.
  function mark(data, seen) {
    const lines = seen.map(([s, when, c, greyed]) => {
      const capture = data.captures[c];
      const stamp = capture.match(/\/web\/(\d{4})(\d\d)(\d\d)/);
      return `<span class="e">${esc(page.sources[data.sources[s]].name)}, ${esc(when)}${greyed ? " (greyed out on the site)" : ""}; <a href="${esc(capture)}" target="_blank" rel="noopener">captured ${stamp[1]}-${stamp[2]}-${stamp[3]}</a></span>`;
    });
    return `<span class="src" tabindex="0" role="button" aria-label="Sources">?<span>${lines.join("")}</span></span>`;
  }

  // The markup of every sale over time, a dot each (hollow where the site greyed the sale out), with the median of
  // each month as a line; a VU chosen in the filter is shaded. The scale leaves out the highest and lowest 2% so a
  // stray sale does not flatten the rest; a sale outside it sits on the edge.
  function chart(data, sales, at) {
    const points = sales.map((s) => ({t: Date.parse(`${s[4][0][1].slice(0, 10)}T00:00:00Z`), m: value(data, s[1], s[2]), grey: s[4].some((e) => e[3])}))
      .filter((p) => p.m !== null && Number.isFinite(p.m));
    // The readings of the item's own kind of markup, each source a line of steps from its first capture to its last.
    const steps = new Map();
    for (const [s, kind, v, a, b] of data.readings || []) {
      if (kind !== data.markup) continue;
      const line = steps.get(s) || [];
      line.push([Date.parse(`${captureDay(data.captures[a])}T00:00:00Z`), Date.parse(`${captureDay(data.captures[b])}T00:00:00Z`), v]);
      steps.set(s, line);
    }
    const stepValues = [...steps.values()].flat();
    if (points.length + stepValues.length < 2) {
      return "";
    }
    const W = 760, H = 220, L = 64, R = 10, T = 10, B = 26;
    const ms = [...points.map((p) => p.m), ...stepValues.map((x) => x[2])].sort((a, b) => a - b);
    const cut = Math.floor(ms.length * 0.02);
    let lo = ms[cut], hi = ms[ms.length - 1 - cut];
    if (hi === lo) { hi += 1; lo -= 1; }
    const times = [...points.map((p) => p.t), ...stepValues.flatMap((x) => [x[0], x[1]])];
    const t0 = Math.min(...times), t1 = Math.max(...times) || t0 + 1;
    const x = (t) => L + (t1 === t0 ? (W - L - R) / 2 : (t - t0) / (t1 - t0) * (W - L - R));
    const y = (m) => T + (1 - (Math.min(hi, Math.max(lo, m)) - lo) / (hi - lo)) * (H - T - B);
    const parts = [];
    for (let year = new Date(t0).getUTCFullYear(); year <= new Date(t1).getUTCFullYear() + 1; year++) {
      const t = Date.UTC(year, 0, 1);
      if (t >= t0 && t <= t1) {
        parts.push(`<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${T}" y2="${H - B}"/><text class="lbl" x="${x(t) + 3}" y="${H - 8}">${year}</text>`);
      }
    }
    if (at) {
      const start = VUS.findIndex(([v]) => v === at);
      const a = Date.parse(`${VUS[start][1]}T00:00:00Z`), b = start + 1 < VUS.length ? Date.parse(`${VUS[start + 1][1]}T00:00:00Z`) : t1;
      if (b >= t0 && a <= t1) {
        parts.push(`<rect class="vu" x="${x(Math.max(a, t0))}" y="${T}" width="${Math.max(2, x(Math.min(b, t1)) - x(Math.max(a, t0)))}" height="${H - T - B}"/>`);
      }
    }
    for (const m of [lo, (lo + hi) / 2, hi]) {
      parts.push(`<line class="grid" x1="${L}" x2="${W - R}" y1="${y(m)}" y2="${y(m)}"/><text class="lbl" x="${L - 4}" y="${y(m) + 4}" text-anchor="end">${data.markup === "%" ? `${Math.round(m)}%` : `${m >= 0 ? "+" : ""}${Math.round(m)}`}</text>`);
    }
    if (data.markup === "%" && lo < 100 && hi > 100) {
      parts.push(`<line class="tt" x1="${L}" x2="${W - R}" y1="${y(100)}" y2="${y(100)}"/>`);
    } else if (data.markup !== "%" && lo < 0 && hi > 0) {
      parts.push(`<line class="tt" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`);
    }
    let n = 0;
    const legend = [];
    const lines = [];
    for (const [s, line] of steps) {
      line.sort((a, b) => a[0] - b[0]);
      // One line per site through its readings in time order, flat across a run of captures that printed the same.
      const path = line.map(([a, b, v], k) => `${k ? "L" : "M"}${x(a).toFixed(1)},${y(v).toFixed(1)}H${Math.max(x(a), x(b)).toFixed(1)}`).join("");
      lines.push(`<path class="reading r${n % 4}" d="${path}"/>`);
      legend.push(`<span class="key r${n % 4}"></span>${esc(page.sources[data.sources[s]].name)}`);
      n += 1;
    }
    parts.push(points.map((p) => `<circle class="${p.grey ? "dot grey" : "dot"}" cx="${x(p.t).toFixed(1)}" cy="${y(p.m).toFixed(1)}" r="2.2"/>`).join(""));
    const months = new Map();
    for (const p of points) {
      const d = new Date(p.t);
      const k = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15);
      months.set(k, [...(months.get(k) || []), p.m]);
    }
    const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const line = [...months].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${x(Math.min(t1, Math.max(t0, k))).toFixed(1)},${y(median(v)).toFixed(1)}`);
    if (line.length > 1) {
      parts.push(`<polyline class="median" points="${line.join(" ")}"/>`);
    }
    parts.push(...lines);
    const what = data.markup === "%" ? "Markup as a share of TT value" : "Markup as the bid less the TT value, in PED";
    const caption = [points.length ? "each sale a dot, the white line each month's median" : "",
      legend.length ? `the price sites' readings a coloured line each (${legend.join(", ")})` : "", "the dashed line TT value"].filter(Boolean).join("; ");
    return `<figure class="a-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(what)}">${parts.join("")}</svg><figcaption>${esc(what)}: ${caption}.</figcaption></figure>`;
  }

  const popup = document.createElement("dialog");
  popup.className = "i-pop";
  popup.setAttribute("aria-labelledby", "i-pop-title");
  popup.innerHTML = '<div class="i-pop-head"><div class="i-pop-title" id="i-pop-title"></div>'
    + '<button class="i-pop-close" type="button" aria-label="Close">×</button></div><div class="i-pop-body"></div>';
  document.body.append(popup);
  const popupTitle = popup.querySelector(".i-pop-title");
  const popupBody = popup.querySelector(".i-pop-body");
  const cache = new Map();
  let opened = null;
  let data = null;
  let tab = "sold";
  let limit = 100;

  async function openRow(li) {
    opened = li;
    tab = "sold";
    limit = 100;
    popupTitle.textContent = li.querySelector(".i-name").textContent;
    popupBody.innerHTML = '<p class="a-wait">Loading the auctions…</p>';
    if (!popup.open) {
      popup.showModal();
    }
    history.replaceState(null, "", `${location.pathname}${location.search}#${encodeURIComponent(li.id)}`);
    try {
      if (!cache.has(li.id)) {
        const response = await fetch(`data/items/${encodeURIComponent(li.id)}.json`);
        if (!response.ok) throw new Error(response.status);
        cache.set(li.id, await response.json());
      }
    } catch (error) {
      popupBody.innerHTML = `<p class="a-wait">The auctions could not be read (${esc(error.message)}). <a href="data/items/${esc(li.id)}.json">Open the data file</a>.</p>`;
      return;
    }
    if (opened === li) {
      data = cache.get(li.id);
      draw();
    }
  }

  function draw() {
    if (!data) {
      return;
    }
    const f = chosen();
    const at = f.vu || null;
    const inVU = (seen) => !at || vuOf(seen[0][1]) === at;
    const sold = data.sold.filter((s) => inVU(s[4]));
    const unsold = data.unsold.filter((u) => inVU(u[3]));
    const readings = (data.readings || []).filter((r) => !at || VUS.findIndex(([v]) => v === vuOf(captureDay(data.captures[r[3]]))) <= VUS.findIndex(([v]) => v === at)
      && VUS.findIndex(([v]) => v === vuOf(captureDay(data.captures[r[4]]))) >= VUS.findIndex(([v]) => v === at));
    const all = data.sold;
    const first = all.length ? all[0][4][0][1].slice(0, 10) : "", last = all.length ? all[all.length - 1][4][0][1].slice(0, 10) : "";
    const twice = data.sold.filter((s) => s[4].length > 1).length;
    const summary = [
      ["Sales", `${data.sold.length.toLocaleString("en")}${twice ? ` (${twice.toLocaleString("en")} recorded by two sites)` : ""}`],
      ["Unsold", data.unsold.length.toLocaleString("en")],
      ["Sold", first ? (first === last ? first : `${first} to ${last}`) : "none recorded"],
      ["Markup readings", (data.readings || []).length.toLocaleString("en")],
      ["Recorded by", data.sources.map((s) => esc(page.sources[s].name)).join(", ")],
    ];
    const rows = tab === "readings"
      ? readings.slice().sort((a, b) => data.captures[b[3]].split("/web/")[1].localeCompare(data.captures[a[3]].split("/web/")[1]))
      : (tab === "sold" ? sold : unsold).slice().reverse();
    const head = tab === "sold"
      ? "<tr><th>Ended</th><th>VU</th><th class=\"n\">Qty</th><th class=\"n\">TT value</th><th class=\"n\">Bid</th><th class=\"n\">Markup</th><th class=\"n\">Bids</th><th></th></tr>"
      : tab === "unsold" ? "<tr><th>Ended</th><th>VU</th><th class=\"n\">Qty</th><th class=\"n\">TT value</th><th class=\"n\">Start bid</th><th class=\"n\">Markup</th><th></th></tr>"
        : "<tr><th>Printed</th><th>VU</th><th>Site</th><th class=\"n\">Markup</th><th>Captures</th></tr>";
    const readingRow = ([src, kind, v, a, b]) => {
      const first = captureDay(data.captures[a]), last = captureDay(data.captures[b]);
      const link = (c, text) => `<a href="${esc(data.captures[c])}" target="_blank" rel="noopener">${esc(text)}</a>`;
      const vu0 = vuOf(first), vu1 = vuOf(last);
      return `<tr><td>${esc(first === last ? first : `${first} to ${last}`)}</td><td>${esc(vu0 === vu1 ? vu0 : `${vu0} to ${vu1}`)}</td><td>${esc(page.sources[data.sources[src]].name)}</td>`
        + `<td class="n">${esc(kind === "%" ? `${v}%` : `TT${v < 0 ? "-" : "+"}${money(Math.abs(v))} PED`)}</td><td>${a === b ? link(a, "capture") : `${link(a, "first")}, ${link(b, "last")}`}</td></tr>`;
    };
    const body = rows.slice(0, limit).map((r) => {
      if (tab === "readings") {
        return readingRow(r);
      }
      const seen = tab === "sold" ? r[4] : r[3];
      const bid = r[2];
      const grey = seen.some((e) => e[3]) ? " class=\"grey\"" : "";
      return `<tr${grey}><td>${esc(seen[0][1])}</td><td>${esc(vuOf(seen[0][1]) || "")}</td><td class="n">${esc(r[0] ?? "")}</td><td class="n">${esc(money(r[1]))}</td>`
        + `<td class="n">${esc(money(bid))}</td><td class="n">${esc(markupText(data, r[1], bid))}</td>${tab === "sold" ? `<td class="n">${esc(r[3] ?? "")}</td>` : ""}<td class="q">${mark(data, seen)}</td></tr>`;
    }).join("");
    const more = rows.length > limit ? `<button class="a-more" type="button">Show ${Math.min(500, rows.length - limit).toLocaleString("en")} more of ${(rows.length - limit).toLocaleString("en")}</button>` : "";
    popupBody.innerHTML = `<table class="i-stats a-summary"><tbody>${summary.map(([k, v]) => `<tr><th scope="row">${k}</th><td class="v">${v}</td></tr>`).join("")}</tbody></table>`
      + `<p class="a-links-pop"><a href="../items/#${esc(opened.id)}">The item on the Items page</a> · <a href="data/items/${esc(opened.id)}.json">Data file</a></p>`
      + chart(data, data.sold, at)
      + `<div class="a-tabs" role="tablist"><button type="button" role="tab" data-tab="sold" aria-selected="${tab === "sold"}">Sold (${sold.length.toLocaleString("en")})</button>`
      + `<button type="button" role="tab" data-tab="unsold" aria-selected="${tab === "unsold"}">Unsold (${unsold.length.toLocaleString("en")})</button>`
      + `<button type="button" role="tab" data-tab="readings" aria-selected="${tab === "readings"}">Readings (${readings.length.toLocaleString("en")})</button>`
      + `${at ? `<span class="a-at">in VU ${esc(at)}</span>` : ""}</div>`
      + (rows.length ? `<div class="a-scroll"><table class="a-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>${more}` : `<p class="a-wait">None recorded${at ? ` in VU ${esc(at)}` : ""}.</p>`)
      + chartsHTML(data)
      + `<p class="a-note">Times are as each site printed them, on its own clock. A reading is a markup a price site printed, the same markup at several captures in a row being one reading. Markup is ${data.markup === "%" ? "the bid as a share of the TT value" : "the bid less the TT value, in PED"}, as PE Auction showed it for this item. A greyed row is one the site showed greyed out.</p>`;
  }

  // PE Auction's own charts of the item's sales, as Wayback kept them, each with the day it was captured.
  function chartsHTML(data) {
    const list = data.charts || [];
    if (!list.length) {
      return "";
    }
    return `<details class="a-pea-charts"><summary>PE Auction's own charts (${list.length})</summary>${list.map(([dtype, c, name]) =>
      `<figure><img src="charts/${esc(name)}" alt="PE Auction's chart of the item's sales" loading="lazy" width="700" height="300"><figcaption>Captured ${esc(captureDay(data.captures[c]))} (chart type ${esc(dtype)}); <a href="${esc(data.captures[c])}" target="_blank" rel="noopener">the capture</a>.</figcaption></figure>`).join("")}</details>`;
  }

  popupBody.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-tab]");
    if (tabButton) {
      tab = tabButton.dataset.tab;
      limit = 100;
      draw();
    }
    if (event.target.closest(".a-more")) {
      limit += 500;
      draw();
    }
  });

  function closeRow() {
    if (popup.open) {
      popup.close();
    }
    const li = opened;
    opened = null;
    data = null;
    if (li) {
      li.focus();
      history.replaceState(null, "", location.pathname + location.search);
    }
  }
  popup.addEventListener("close", () => {
    if (!popup.open && opened) {
      closeRow();
    }
  });
  popup.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeRow();
  });
  popup.querySelector(".i-pop-close").addEventListener("click", closeRow);
  popup.addEventListener("click", (event) => {
    if (event.target === popup) {
      closeRow();
    }
  });

  // A record's sources show in a tip below its question mark (above it near the bottom of the window), kept inside the
  // window, while the pointer rests on the mark or it has the focus.
  function placeTip(markEl) {
    const tip = markEl.querySelector("span");
    tip.style.left = "0px";
    tip.style.top = "0px";
    const rect = markEl.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - size.width - 8))}px`;
    tip.style.top = `${rect.bottom + size.height + 8 > innerHeight ? Math.max(8, rect.top - size.height) : rect.bottom}px`;
  }
  for (const type of ["pointerover", "focusin"]) {
    document.addEventListener(type, (event) => {
      const markEl = event.target.closest && event.target.closest(".src");
      if (markEl && !markEl.contains(event.relatedTarget)) {
        placeTip(markEl);
      }
    });
  }

  for (const item of items) {
    item.li.tabIndex = 0;
    item.li.setAttribute("aria-haspopup", "dialog");
  }
  document.addEventListener("click", (event) => {
    const li = event.target.closest(".item.has-more");
    if (li && !event.target.closest("a")) {
      openRow(li);
    }
  });
  document.addEventListener("keydown", (event) => {
    const li = event.target.closest && event.target.closest(".item.has-more");
    if (li && event.target === li && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openRow(li);
    }
  });
  function reveal() {
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target && target.classList.contains("item")) {
      if (target.hidden) {
        for (const control of controls) {
          control.value = "";
        }
        show();
      }
      target.scrollIntoView({block: "center"});
      openRow(target);
    }
  }
  addEventListener("hashchange", reveal);
  show();
  reveal();
})();
