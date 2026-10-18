/* Entropia Archive Societies: filter the table by source, what a society shows and words, all kept in the address,
   and open a society's details in a popup; an address ending in #<id> opens that society. Without this file every
   society shows with its details under its row and the filter bar is hidden. */
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
  const rows = Array.from(document.querySelectorAll(".item"), (el) => ({
    el, s: el.dataset.s.split(" "), m: el.dataset.m === "1", w: el.dataset.w === "1", text: el.dataset.text,
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
  function show() {
    const f = chosen();
    const words = (f.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const row of rows) {
      row.el.hidden = !((!f.s || row.s.includes(f.s)) && (!f.h || (f.h === "m" ? row.m : row.w)) && words.every((w) => row.text.includes(w)));
      shown += row.el.hidden ? 0 : 1;
    }
    tally.textContent = `${shown} of ${rows.length} societies`;
    none.hidden = shown > 0;
    clear.hidden = Object.keys(f).length === 0;
    const query = Object.entries(f).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`).join("&");
    history.replaceState(null, "", (query ? `?${query}` : location.pathname) + location.hash);
  }
  function clearAll() {
    for (const control of controls) {
      control.value = "";
    }
    show();
  }
  for (const control of controls) {
    control.addEventListener(control.tagName === "SELECT" ? "change" : "input", show);
  }
  clear.addEventListener("click", clearAll);

  // A row opens its details in a popup on a click, or on Enter or Space once focused, as on the Creatures page: the
  // details move into the popup and back when it closes (Esc, the close button or a click outside it). While it is
  // open the address names the society, so it can be linked to.
  const popup = document.createElement("dialog");
  popup.className = "i-pop";
  popup.setAttribute("aria-labelledby", "i-pop-title");
  popup.innerHTML = '<div class="i-pop-head"><div class="i-pop-title" id="i-pop-title"></div>'
    + '<button class="i-pop-close" type="button" aria-label="Close">×</button></div><div class="i-pop-body"></div>';
  document.body.append(popup);
  const popupTitle = popup.querySelector(".i-pop-title");
  const popupBody = popup.querySelector(".i-pop-body");
  let opened = null;
  function putBack() {
    opened.append(popupBody.querySelector(".i-more"));
    opened = null;
  }
  function openRow(li) {
    if (opened === li && popup.open) {
      return;
    }
    if (opened) {
      putBack();
    }
    opened = li;
    popupTitle.textContent = li.querySelector(".s-name").textContent;
    const more = li.querySelector(".i-more");
    for (const mark of more.querySelectorAll(".src:not([role])")) {
      mark.setAttribute("role", "button");
      mark.setAttribute("aria-label", `Sources: ${Array.from(mark.querySelectorAll(".e"), (e) => e.textContent).join("; ")}`);
    }
    popupBody.append(more);
    popupBody.scrollTop = 0;
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
  for (const row of rows) {
    row.el.tabIndex = 0;
    row.el.setAttribute("aria-haspopup", "dialog");
  }
  document.addEventListener("click", (event) => {
    const li = event.target.closest(".item");
    if (li && !event.target.closest("a")) {
      openRow(li);
    }
  });
  document.addEventListener("keydown", (event) => {
    const li = event.target.closest && event.target.closest(".item");
    if (li && event.target === li && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openRow(li);
    }
  });

  // A link to a society opens it; one the filters hide clears them first.
  function reveal() {
    const target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target && target.classList.contains("item")) {
      if (target.hidden) {
        clearAll();
      }
      target.scrollIntoView({block: "center"});
      openRow(target);
    }
  }
  addEventListener("hashchange", reveal);

  // A fact's sources show in a tip below its question mark (above it near the bottom of the window), kept inside the
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
  reveal();
})();
