/* Entropia Archive Maps: pointing at an area on a map or in its list marks it in both, and a fact's sources show in a
   tip kept inside the window. Without this file the maps and lists show as they are and an area's link still jumps to
   its row. */
(function () {
  "use strict";
  document.documentElement.dataset.script = "1";
  const marked = new Set();
  function mark(id) {
    for (const el of marked) {
      el.classList.remove("on");
    }
    marked.clear();
    if (!id) {
      return;
    }
    for (const el of document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`)) {
      el.classList.add("on");
      marked.add(el);
    }
  }
  for (const type of ["pointerover", "focusin"]) {
    document.addEventListener(type, (event) => {
      const el = event.target.closest && event.target.closest("[data-id]");
      mark(el ? el.dataset.id : null);
    });
  }

  // One continent shows at a time, the one chosen, or the one holding the element the address points at.
  const continent = document.querySelector("select[data-continent]");
  const controlsOf = (section) => ({
    build: document.querySelector(`.m-build-choice[data-for="${section.id}"] select[data-build]`),
    picture: document.querySelector(`.m-picture-choice[data-for="${section.id}"] select[data-picture]`),
    boxes: [...section.querySelectorAll("input[data-layer]")],
  });

  // The filters live in the address so a view can be linked: continent, map, vu (the build) and hide (the layers
  // switched off), each left out while it is the default.
  function remember() {
    if (!continent) {
      return;
    }
    const {build, picture, boxes} = controlsOf(document.getElementById(continent.value));
    const f = [];
    if (continent.selectedIndex) {
      f.push(["continent", continent.value.replace(/^map-/, "")]);
    }
    if (picture && picture.selectedIndex) {
      f.push(["map", picture.value]);
    }
    if (build.selectedIndex) {
      f.push(["vu", build.value]);
    }
    const hidden = boxes.filter((b) => !b.checked).map((b) => b.dataset.layer);
    if (hidden.length) {
      f.push(["hide", hidden.join(",")]);
    }
    const query = f.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ",")}`).join("&");
    history.replaceState(null, "", query ? `?${query}${location.hash}` : location.pathname + location.hash);
  }

  const showMap = (id) => {
    for (const el of document.querySelectorAll(".m-map, .m-picture-choice, .m-build-choice")) {
      el.classList.toggle("m-map-off", (el.dataset.for || el.id) !== id);
    }
    continent.value = id;
  };
  if (continent) {
    continent.addEventListener("change", () => {
      showMap(continent.value);
      remember();
    });
  }

  // Each map's layers switch on and off, and its places show as the chosen build listed them.
  for (const section of document.querySelectorAll(".m-map")) {
    const {build, picture, boxes} = controlsOf(section);
    for (const box of boxes) {
      box.addEventListener("change", () => {
        section.classList.toggle(`off-${box.dataset.layer}`, !box.checked);
        remember();
      });
    }
    // The map's picture: the one chosen, or on choosing a build the picture that names it.
    const show = (id) => {
      for (const el of section.querySelectorAll("[data-picture]:not(select)")) {
        el.classList.toggle("m-picture-off", el.dataset.picture !== id);
      }
    };
    if (picture) {
      picture.addEventListener("change", () => {
        show(picture.value);
        remember();
      });
    }
    build.addEventListener("change", () => {
      section.dataset.build = build.value;
      const match = picture && [...picture.options].find((o) => o.dataset.builds.split(" ").includes(build.value));
      if (match) {
        picture.value = match.value;
        show(match.value);
      }
      remember();
    });
  }

  // The address's filters, then the element it points at, which may be on another continent.
  if (continent) {
    const params = new URLSearchParams(location.search);
    const choose = (select, value) => {
      if (select && value && [...select.options].some((o) => o.value === value)) {
        select.value = value;
        select.dispatchEvent(new Event("change"));
      }
    };
    choose(continent, params.get("continent") && `map-${params.get("continent")}`);
    const {build, picture, boxes} = controlsOf(document.getElementById(continent.value));
    choose(build, params.get("vu"));
    choose(picture, params.get("map"));
    const hide = (params.get("hide") || "").split(",");
    for (const box of boxes) {
      if (hide.includes(box.dataset.layer)) {
        box.checked = false;
        box.dispatchEvent(new Event("change"));
      }
    }
    const follow = () => {
      const target = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      const section = target && target.closest(".m-map");
      if (section) {
        if (section.id !== continent.value) {
          showMap(section.id);
          remember();
        }
        const folded = target.closest("details");
        if (folded) {
          folded.open = true;
        }
        target.scrollIntoView();
      }
    };
    addEventListener("hashchange", follow);
    follow();
  }

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
      const src = event.target.closest && event.target.closest(".src");
      if (src && !src.contains(event.relatedTarget)) {
        placeTip(src);
      }
    });
  }
})();
