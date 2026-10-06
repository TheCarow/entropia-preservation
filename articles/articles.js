/* Entropia Archive articles: filter the list by type, year range, language and words, all kept in the address.
   Every type starts shown; unticking one hides it. Without this file every article shows and the filter bar is
   hidden. */
(function () {
  "use strict";
  document.documentElement.dataset.script = "1";
  const bar = document.querySelector(".filters");
  if (!bar) {
    return;
  }
  const controls = Array.from(bar.querySelectorAll("[data-filter]"));
  const typeBoxes = Array.from(bar.querySelectorAll("input[data-type]"));
  const clear = bar.querySelector(".fclear");
  const tally = document.querySelector(".shown");
  const none = document.querySelector(".nomatch");
  const groups = Array.from(document.querySelectorAll(".a-year"));
  const items = Array.from(document.querySelectorAll(".article"), (li) => ({
    li, type: li.dataset.type, lang: li.dataset.lang, text: li.dataset.text,
    from: li.dataset.from ? Number(li.dataset.from) : null, to: li.dataset.to ? Number(li.dataset.to) : null,
  }));

  const params = new URLSearchParams(location.search);
  for (const control of controls) {
    const wanted = params.get(control.dataset.filter);
    if (wanted && (control.tagName !== "SELECT" || Array.from(control.options).some((o) => o.value === wanted))) {
      control.value = wanted;
    }
  }
  const hidden = new Set((params.get("hide") || "").split(",").filter(Boolean));
  for (const box of typeBoxes) {
    box.checked = !hidden.has(box.dataset.type);
  }

  function chosen() {
    const f = {};
    for (const control of controls) {
      const value = control.value.trim();
      if (value) {
        f[control.dataset.filter] = value;
      }
    }
    const hide = typeBoxes.filter((b) => !b.checked).map((b) => b.dataset.type);
    if (hide.length) {
      f.hide = hide.join(",");
    }
    return f;
  }

  // An undated article is left out once a year is chosen; an open end of the range reaches as far as it may.
  function matches(item, f) {
    const from = f.from ? Number(f.from) : -Infinity;
    const to = f.to ? Number(f.to) : Infinity;
    const hide = new Set((f.hide || "").split(",").filter(Boolean));
    const words = (f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return !hide.has(item.type)
      && (!f.lang || item.lang === f.lang)
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
      group.hidden = !group.querySelector(".article:not([hidden])");
    }
    tally.textContent = `${shown} of ${items.length} articles`;
    none.hidden = shown > 0;
    clear.hidden = Object.keys(f).length === 0;
    const query = Object.entries(f).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ",").replace(/%20/g, "+")}`).join("&");
    history.replaceState(null, "", query ? `?${query}${location.hash}` : location.pathname + location.hash);
  }

  for (const control of controls) {
    control.addEventListener(control.tagName === "SELECT" ? "change" : "input", show);
  }
  for (const box of typeBoxes) {
    box.addEventListener("change", show);
  }
  clear.addEventListener("click", () => {
    for (const control of controls) {
      control.value = "";
    }
    for (const box of typeBoxes) {
      box.checked = true;
    }
    show();
  });
  show();
})();
