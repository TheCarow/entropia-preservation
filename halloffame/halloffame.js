/* Entropia Archive Hall of Fame: filter the records by kind, activity, source, year and words, all kept in the
   address; an address naming a creature (c=) or an item (i=), as the Creatures and Items pages link here, shows its
   records alone. Without this file every record shows and the filter bar is hidden. */
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
  const rows = Array.from(document.querySelectorAll(".h-table tbody tr"), (tr) => ({
    tr, k: tr.dataset.k, a: tr.dataset.a, s: tr.dataset.s.split(" "), y: tr.dataset.y, c: tr.dataset.c || "", i: tr.dataset.i || "",
    text: tr.dataset.text,
  }));
  const params = new URLSearchParams(location.search);
  // A creature or item the address names; cleared with the other filters.
  let only = params.get("c") ? {key: "c", value: params.get("c")} : params.get("i") ? {key: "i", value: params.get("i")} : null;
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
  function show() {
    const f = chosen();
    const words = (f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const row of rows) {
      row.tr.hidden = !((!f.k || row.k === f.k) && (!f.a || row.a === f.a) && (!f.s || row.s.includes(f.s)) && (!f.y || row.y === f.y)
        && (!only || row[only.key] === only.value) && words.every((w) => row.text.includes(w)));
      shown += row.tr.hidden ? 0 : 1;
    }
    tally.textContent = `${shown} of ${rows.length} records${only ? ` of one ${only.key === "c" ? "creature" : "item"}` : ""}`;
    none.hidden = shown > 0;
    clear.hidden = Object.keys(f).length === 0 && !only;
    if (only) {
      f[only.key] = only.value;
    }
    const query = Object.entries(f).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`).join("&");
    history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }
  for (const control of controls) {
    control.addEventListener(control.tagName === "SELECT" ? "change" : "input", show);
  }
  clear.addEventListener("click", () => {
    for (const control of controls) {
      control.value = "";
    }
    only = null;
    show();
  });

  // A record's sources show in a tip below its question mark (above it near the bottom of the window), kept inside the
  // window, while the pointer rests on the mark or it has the focus.
  function placeTip(mark) {
    const tip = mark.querySelector("span");
    tip.style.left = "0px";
    tip.style.top = "0px";
    const at = mark.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(at.left, innerWidth - size.width - 8))}px`;
    tip.style.top = `${at.bottom + size.height + 8 > innerHeight ? Math.max(8, at.top - size.height) : at.bottom}px`;
  }
  for (const type of ["pointerover", "focusin"]) {
    document.addEventListener(type, (event) => {
      const mark = event.target.closest && event.target.closest(".src");
      if (mark && !mark.contains(event.relatedTarget)) {
        placeTip(mark);
      }
    });
  }
  show();
})();
