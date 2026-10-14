/* Entropia Archive items: filter the list by category, type, a VU the item was seen in and words, all kept in the
   address. Without this file every item shows and the filter bar is hidden. */
(function () {
  "use strict";
  document.documentElement.dataset.script = "1";
  const bar = document.querySelector(".filters");
  if (!bar) {
    return;
  }
  const controls = Array.from(bar.querySelectorAll("[data-filter]"));
  const category = bar.querySelector('[data-filter="cat"]');
  const type = bar.querySelector('[data-filter="type"]');
  const clear = bar.querySelector(".fclear");
  const tally = document.querySelector(".shown");
  const none = document.querySelector(".nomatch");
  const groups = Array.from(document.querySelectorAll(".i-group"));
  // Items judged never in use are left out unless the address asks for them with unused=1; there is no control.
  const unused = new URLSearchParams(location.search).get("unused") === "1";
  document.documentElement.classList.toggle("show-unused", unused);
  const items = Array.from(document.querySelectorAll(unused ? ".item" : ".item:not([data-unused])"), (li) => ({
    li, cat: li.dataset.cat, type: `${li.dataset.cat}:${li.dataset.type}`, text: li.dataset.text,
    a: li.dataset.a ? Number(li.dataset.a) : null, b: li.dataset.b ? Number(li.dataset.b) : null,
    names: li.dataset.names ? JSON.parse(li.dataset.names) : null, name: li.querySelector(".i-name"),
    latest: li.querySelector(".i-name").textContent,
  }));
  const rank = new Map(Array.from(bar.querySelector('[data-filter="vu"]').options).filter((o) => o.value)
    .map((o) => [o.value, Number(o.dataset.rank)]));

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

  // An item seen in VU 8.4 and in 9.0 is taken to have been there in every VU between.
  function matches(item, f) {
    const at = f.vu ? rank.get(f.vu) : null;
    const words = (f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (!f.cat || item.cat === f.cat)
      && (!f.type || item.type === f.type)
      && (at === null || (item.a !== null && item.a <= at && item.b >= at))
      && words.every((w) => item.text.includes(w));
  }

  // An item that changed its name shows the one it had in the chosen VU: the name printed then, or across a gap
  // between two names the earlier one, or before its first dated name that one. With no VU chosen, its last name.
  function rename(item, at) {
    if (!item.names) {
      return;
    }
    let shown = item.latest;
    if (at !== null) {
      const during = item.names.filter((n) => n[1] <= at && at <= n[2]);
      const before = item.names.filter((n) => n[1] <= at);
      shown = (during.pop() || before.pop() || item.names[0])[0];
    }
    if (item.name.textContent !== shown) {
      item.name.textContent = shown;
    }
  }

  // The Type list offers only the chosen category's types.
  function narrow() {
    for (const group of type.querySelectorAll("optgroup")) {
      group.hidden = Boolean(category.value) && group.dataset.cat !== category.value;
      group.disabled = group.hidden;
    }
    if (type.value && category.value && !type.value.startsWith(`${category.value}:`)) {
      type.value = "";
    }
  }

  function show() {
    narrow();
    const f = chosen();
    let shown = 0;
    const at = f.vu ? rank.get(f.vu) : null;
    for (const item of items) {
      rename(item, at);
      item.li.hidden = !matches(item, f);
      shown += item.li.hidden ? 0 : 1;
    }
    for (const group of groups) {
      group.hidden = !group.querySelector(unused ? ".item:not([hidden])" : ".item:not([hidden]):not([data-unused])");
    }
    tally.textContent = `${shown} of ${items.length} items`;
    none.hidden = shown > 0;
    clear.hidden = Object.keys(f).length === 0;
    if (unused) {
      f.unused = "1";
    }
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

  // A link to an item the filters hide clears them first, so the item it names is there to see.
  function reveal() {
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target && target.classList.contains("item") && target.hidden) {
      clearAll();
      target.scrollIntoView();
    }
  }

  // A row with flavour text opens it on a click, or on Enter or Space once focused, and closes it again.
  for (const li of document.querySelectorAll(".item.has-desc")) {
    li.tabIndex = 0;
    li.setAttribute("aria-expanded", "false");
  }
  function toggle(li) {
    li.classList.toggle("open");
    li.setAttribute("aria-expanded", String(li.classList.contains("open")));
  }
  document.addEventListener("click", (event) => {
    const li = event.target.closest(".item.has-desc");
    if (li && !event.target.closest("a")) {
      toggle(li);
    }
  });
  document.addEventListener("keydown", (event) => {
    const li = event.target.closest && event.target.closest(".item.has-desc");
    if (li && event.target === li && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggle(li);
    }
  });

  clear.addEventListener("click", clearAll);
  addEventListener("hashchange", reveal);
  show();
  reveal();
})();
