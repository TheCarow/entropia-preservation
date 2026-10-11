/* Entropia Archive sites and tools: filter the list to sites or tools, by who made each, its kind, what survives of it,
   the years it ran and words, all kept in the address. Without this file every entry shows and the filter bar is
   hidden. */
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
  const groups = Array.from(document.querySelectorAll(".s-group"));
  const items = Array.from(document.querySelectorAll(".site"), (li) => ({
    li, type: li.dataset.type, by: li.dataset.by, kind: li.dataset.kind, status: li.dataset.status, text: li.dataset.text,
    from: li.dataset.from ? Number(li.dataset.from) : null, to: li.dataset.to ? Number(li.dataset.to) : Infinity,
  }));

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

  // A site still running has no end year and reaches any later year; a present-day one is left out once a year is
  // chosen.
  function matches(item, f) {
    const from = f.from ? Number(f.from) : -Infinity;
    const to = f.to ? Number(f.to) : Infinity;
    const words = (f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (!f.type || item.type === f.type)
      && (!f.by || item.by === f.by)
      && (!f.kind || item.kind === f.kind)
      && (!f.status || item.status === f.status)
      && (!(f.from || f.to) || (item.from !== null && item.from <= to && item.to >= from))
      && words.every((w) => item.text.includes(w));
  }

  function show() {
    const f = chosen();
    let shown = 0;
    for (const item of items) {
      item.li.hidden = !matches(item, f);
      shown += item.li.hidden ? 0 : 1;
    }
    for (const group of groups) {
      group.hidden = !group.querySelector(".site:not([hidden])");
    }
    tally.textContent = `${shown} of ${items.length} entries`;
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

  // A link to an entry the filters hide clears them first, so the entry it names is there to see.
  function reveal() {
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target && target.classList.contains("site") && target.hidden) {
      clearAll();
      target.scrollIntoView();
    }
  }

  clear.addEventListener("click", clearAll);
  addEventListener("hashchange", reveal);
  show();
  reveal();
})();
