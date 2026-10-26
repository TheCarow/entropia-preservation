/* Entropia Archive creatures: filter the list by class, a VU the creature was seen in and words, all kept in the
   address, and show each recorded value and loot for the chosen VU. Without this file every creature and every value
   shows and the filter bar is hidden. */
(function () {
  "use strict";
  document.documentElement.dataset.script = "1";
  const bar = document.querySelector(".filters");
  if (!bar) {
    return;
  }
  const controls = Array.from(bar.querySelectorAll("[data-filter]"));
  const clear = bar.querySelector(".fclear");
  const tally = document.querySelector(".shown");
  const none = document.querySelector(".nomatch");
  const rows = Array.from(document.querySelectorAll(".item"), (li) => ({
    li, klass: li.dataset.class, text: li.dataset.text,
    a: li.dataset.a ? Number(li.dataset.a) : null, b: li.dataset.b ? Number(li.dataset.b) : null,
  }));
  const rank = new Map(Array.from(bar.querySelector('[data-filter="vu"]').options).filter((o) => o.value)
    .map((o) => [o.value, Number(o.dataset.rank)]));
  // The fields as fields.json defines them, in its order, with the ones each scope lists (the page writes them in):
  // the popup adds the rows nothing gives a value for, which the page leaves out to stay small.
  const layout = JSON.parse(document.getElementById("i-fields").textContent);
  const fieldInfo = new Map(layout.fields.map(([key, label, group, scopes], n) => [key, {label, group, scopes, n}]));

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

  // A creature seen in VU 8.4 and in 9.0 is taken to have been there in every VU between.
  function matches(row, f) {
    const at = f.vu ? rank.get(f.vu) : null;
    const words = (f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (!f.class || row.klass === f.class)
      && (at === null || (row.a !== null && row.a <= at && row.b >= at))
      && words.every((w) => row.text.includes(w));
  }

  // As on the Items page: for a chosen VU the value recorded in it (the best-ranked source first, then the one most
  // sources give), failing that the nearest earlier record, then the nearest later one; with no VU chosen the latest.
  function pick(lines, at) {
    const by = (...keys) => (x, y) => keys.reduce((d, k) => d || k(x, y), 0);
    if (at === null) {
      return [...lines].sort(by((x, y) => y.b - x.b, (x, y) => x.t - y.t, (x, y) => y.n - x.n))[0];
    }
    return [...lines.filter((l) => l.a <= at && at <= l.b)].sort(by((x, y) => x.t - y.t, (x, y) => y.n - x.n))[0]
      || [...lines.filter((l) => l.b < at)].sort(by((x, y) => y.b - x.b, (x, y) => x.t - y.t))[0]
      || [...lines.filter((l) => l.a > at)].sort(by((x, y) => x.a - y.a, (x, y) => x.t - y.t))[0];
  }

  // As on the Items page, the fields of one group (a creature's damage by type) are one reading per source: the
  // reading is picked from all their rows, and each field shows only a value recorded in the VU that reading stands for.
  function readings(fields, at) {
    const rows = new Map();
    for (const field of fields.filter((f) => f.group)) {
      rows.set(field.group, [...(rows.get(field.group) || []), ...field.lines]);
    }
    return new Map([...rows].map(([group, lines]) => {
      const best = pick(lines, at);
      return [group, at !== null && best.a <= at && at <= best.b ? at : at !== null && best.a > at ? best.a : best.b];
    }));
  }

  // A table as the popup shows it: the fields its scope lists and every type of a group one type of which has a value,
  // in fields.json's shown order, "unknown" where nothing gives a value; a field of a group also says so where the
  // reading picked for the VU leaves its type out. Done once per table, when its popup first opens.
  function unknownRow(label) {
    const row = document.createElement("tr");
    row.className = "unknown";
    const head = document.createElement("th");
    head.scope = "row";
    head.textContent = label;
    row.append(head);
    row.insertCell().className = "q";
    row.insertCell().textContent = "unknown";
    row.cells[2].className = "v";
    return row;
  }
  function complete(root) {
    for (const table of root.querySelectorAll("table.i-stats[data-scope]:not([data-complete])")) {
      table.dataset.complete = "1";
      const scope = table.dataset.scope;
      const listed = layout.shown[scope] || [];
      const bodies = [...table.tBodies];
      // A field can have several bodies (damage through each armour set), kept together in their order.
      const present = new Map();
      for (const b of bodies.filter((body) => body.dataset.field)) {
        present.set(b.dataset.field, [...(present.get(b.dataset.field) || []), b]);
      }
      const groups = new Set([...present.keys()].map((f) => fieldInfo.get(f).group).filter(Boolean));
      const place = (f) => (listed.includes(f) ? listed.indexOf(f) : listed.length + fieldInfo.get(f).n);
      const wanted = [...fieldInfo.keys()].filter((f) => present.has(f) || listed.includes(f)
        || (groups.has(fieldInfo.get(f).group) && fieldInfo.get(f).scopes.includes(scope))).sort((a, b) => place(a) - place(b));
      const middle = wanted.flatMap((f) => {
        const found = present.get(f);
        if (found) {
          for (const body of found.filter((b) => b.dataset.group)) {
            const row = unknownRow(fieldInfo.get(f).label);
            row.hidden = true;
            body.append(row);
          }
          return found;
        }
        const added = document.createElement("tbody");
        added.className = "fixed";
        added.append(unknownRow(fieldInfo.get(f).label));
        return added;
      });
      const first = bodies.filter((b) => b.classList.contains("head") || (!b.dataset.field && !b.classList.contains("fixed")));
      const last = bodies.filter((b) => !b.dataset.field && b.classList.contains("fixed") && !b.classList.contains("head"));
      table.append(...first, ...middle, ...last);
    }
  }

  // Each field of a table under `root` (the open popup) shows its value for the VU, marked where it comes from another
  // VU, and a table says when that happens; a drop not recorded in the VU dims. Only the open popup is picked, so a
  // filter change touches no other table.
  function pickValues(root, at, vu) {
    for (const table of root.querySelectorAll(".i-stats")) {
      const fields = Array.from(table.querySelectorAll("tbody:not(.fixed)"), (body) => ({
        group: body.dataset.group, unknown: body.querySelector("tr.unknown"),
        lines: Array.from(body.querySelectorAll("tr.sv"), (sv) => ({
          sv, a: Number(sv.dataset.a), b: Number(sv.dataset.b), t: Number(sv.dataset.t), n: Number(sv.dataset.n),
        })),
      }));
      const reading = readings(fields, at);
      let missing = 0;
      for (const field of fields) {
        const lines = field.lines;
        const point = reading.get(field.group);
        const chosen = pick(field.group ? lines.filter((l) => l.a <= point && point <= l.b) : lines, at);
        if (field.unknown) {
          field.unknown.hidden = Boolean(chosen);
        }
        for (const line of lines) {
          const off = line === chosen && at !== null && !(line.a <= at && at <= line.b);
          line.sv.classList.toggle("on", line === chosen);
          line.sv.classList.toggle("off", off);
          missing += off ? 1 : 0;
        }
      }
      const mixed = table.nextElementSibling;
      if (mixed && mixed.classList.contains("i-mixed")) {
        const note = missing ? `No record of ${missing === 1 ? "one value" : `${missing} values`} for VU ${vu}; the nearest VU's is shown, marked.` : "";
        mixed.textContent = note;
        mixed.hidden = !note;
      }
    }
    for (const drop of root.querySelectorAll(".drop")) {
      drop.classList.toggle("off", at !== null && !drop.dataset.v.split(" ").map(Number).includes(at));
    }
  }

  function show() {
    const f = chosen();
    const at = f.vu ? rank.get(f.vu) : null;
    let shown = 0;
    for (const row of rows) {
      row.li.hidden = !matches(row, f);
      shown += row.li.hidden ? 0 : 1;
    }
    if (opened) {
      pickValues(popupBody, at, f.vu);
    }    tally.textContent = `${shown} of ${rows.length} creatures`;
    none.hidden = shown > 0;
    clear.hidden = Object.keys(f).length === 0;
    const query = Object.entries(f).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`).join("&");
    history.replaceState(null, "", query ? `?${query}${location.hash}` : location.pathname + location.hash);
  }

  for (const control of controls) {
    control.addEventListener(control.tagName === "SELECT" ? "change" : "input", show);
  }
  function clearAll() {
    for (const control of controls) {
      control.value = "";
    }
    show();
  }

  // A link to a creature opens it; one the filters hide clears them first.
  function reveal() {
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target && target.classList.contains("item")) {
      if (target.hidden) {
        clearAll();
      }
      target.scrollIntoView({block: "center"});
      if (target.classList.contains("has-more")) {
        openRow(target);
      }
    }
  }

  // A row with more to say opens it in a popup on a click, or on Enter or Space once focused: the row's own details
  // move into the popup and back when it closes (Esc, the close button or a click outside it), so the values picked
  // for the chosen VU stay as they are. While it is open the address names the row, so it can be linked to.
  const popup = document.createElement("dialog");
  popup.className = "i-pop";
  popup.setAttribute("aria-labelledby", "i-pop-title");
  popup.innerHTML = '<div class="i-pop-head"><div class="i-pop-title" id="i-pop-title"></div>'
    + '<button class="i-pop-close" type="button" aria-label="Close">\u00d7</button></div><div class="i-pop-body"></div>';
  document.body.append(popup);
  const popupTitle = popup.querySelector(".i-pop-title");
  const popupBody = popup.querySelector(".i-pop-body");
  let opened = null;

  // The popup is headed by the row's name alone; its picture and the row's other columns (loot, seen) open the
  // details, the columns as the first rows of the table ("unknown" where the row's column is empty), and go again
  // when the details go back.
  const SUMMARY = [["Loot", ".c-count"], ["Seen", ".i-seen"]];
  function putBack() {
    for (const added of popupBody.querySelectorAll(".i-pop-added")) {
      added.remove();
    }
    opened.append(popupBody.querySelector(".i-more"));
    opened = null;
  }
  function summaryRows(li) {
    const body = document.createElement("tbody");
    body.className = "fixed i-pop-added";
    for (const [label, selector] of SUMMARY) {
      const text = ((li.querySelector(selector) || {}).textContent || "").trim();
      const row = body.insertRow();
      const head = document.createElement("th");
      head.scope = "row";
      head.textContent = label;
      row.append(head);
      row.insertCell().className = "q";
      row.insertCell().textContent = text || "unknown";
      row.cells[2].className = "v";
      if (!text) {
        row.className = "unknown";
      }
    }
    return body;
  }
  function openRow(li) {
    if (opened === li && popup.open) {
      return;
    }
    if (opened) {
      putBack();
    }
    opened = li;
    popupTitle.textContent = li.querySelector(".i-name").textContent;
    const more = li.querySelector(".i-more");
    complete(more);
    for (const mark of more.querySelectorAll(".src:not([role])")) {
      mark.setAttribute("role", "button");
      mark.setAttribute("aria-label", `Sources: ${Array.from(mark.querySelectorAll(".e"), (e) => e.textContent).join("; ")}`);
    }
    const table = more.querySelector(".i-stats");
    if (table) {
      table.prepend(summaryRows(li));
    } else {
      const own = document.createElement("table");
      own.className = "i-stats i-pop-added";
      own.append(summaryRows(li));
      more.prepend(own);
    }
    const picture = li.querySelector(".i-icon img");
    if (picture) {
      const box = document.createElement("div");
      box.className = "i-pop-icon i-pop-added";
      box.append(picture.cloneNode());
      more.prepend(box);
    }
    popupBody.append(more);
    popupBody.scrollTop = 0;
    const f = chosen();
    pickValues(more, f.vu ? rank.get(f.vu) : null, f.vu);
    if (!popup.open) {
      popup.showModal();
    }
    history.replaceState(null, "", `${location.pathname}${location.search}#${encodeURIComponent(li.id)}`);
  }
  // Closing puts the details back, returns the focus to the row and takes the row out of the address; it is done here
  // rather than on the dialog's close event alone, which a browser may send late, even after the popup opened again.
  function closeRow() {
    if (popup.open) {
      popup.close();
    }
    const li = opened;
    if (li) {
      putBack();
      li.focus();
      history.replaceState(null, "", location.pathname + location.search);
    }
  }
  popup.addEventListener("close", () => {
    if (!popup.open) {
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

  // A value's sources show in a tip below its question mark (above it near the bottom of the window), kept inside the
  // window, while the pointer rests on the mark or it has the focus.
  function placeTip(mark) {
    const tip = mark.querySelector("span");
    tip.style.left = "0px";
    tip.style.top = "0px";
    const at = mark.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    const left = Math.max(8, Math.min(at.left, innerWidth - size.width - 8));
    const top = at.bottom + size.height + 8 > innerHeight ? Math.max(8, at.top - size.height) : at.bottom;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  for (const type of ["pointerover", "focusin"]) {
    document.addEventListener(type, (event) => {
      const mark = event.target.closest && event.target.closest(".src");
      if (mark && !mark.contains(event.relatedTarget)) {
        placeTip(mark);
      }
    });
  }

  for (const li of document.querySelectorAll(".item.has-more")) {
    li.tabIndex = 0;
    li.setAttribute("aria-haspopup", "dialog");
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

  clear.addEventListener("click", clearAll);
  addEventListener("hashchange", reveal);
  show();
  reveal();
})();
