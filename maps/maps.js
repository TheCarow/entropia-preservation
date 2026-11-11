/* Entropia Archive Maps: pointing at an area on a map or in its list marks it in both, a map zooms and moves, and a
   fact's sources show in a tip kept inside the window. Without this file the maps and lists show as they are and an
   area's link still jumps to its row. */
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
    boxes: [...section.querySelectorAll("input[data-layer]")],
  });

  // The filters live in the address so a view can be linked: continent, vu (the build) and hide (the layers switched
  // off), each left out while it is the default.
  function remember() {
    if (!continent) {
      return;
    }
    const {build, boxes} = controlsOf(document.getElementById(continent.value));
    const f = [];
    if (continent.selectedIndex) {
      f.push(["continent", continent.value.replace(/^map-/, "")]);
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
    for (const el of document.querySelectorAll(".m-map, .m-build-choice")) {
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
    const {build, boxes} = controlsOf(section);
    for (const box of boxes) {
      box.addEventListener("change", () => {
        section.classList.toggle(`off-${box.dataset.layer}`, !box.checked);
        remember();
      });
    }
    build.addEventListener("change", () => {
      section.dataset.build = build.value;
      remember();
    });
  }

  // Each map zooms about the pointer with the wheel, a pinch or its buttons, from the whole map to MOST_ZOOM times
  // closer, and moves with a drag while zoomed, held inside the whole; its markers keep their size on the screen.
  const MOST_ZOOM = 8;
  const BUTTON_STEP = 2;
  // A wheel's notch (100 pixels of scroll) zooms by the square root of 2; a trackpad's small steps zoom smoothly.
  const WHEEL_PIXELS_PER_DOUBLING = 200;
  const DRAG_THRESHOLD = 4;
  for (const figure of document.querySelectorAll(".m-view")) {
    const svg = figure.querySelector("svg");
    const [left0, top0, width0, height0] = svg.getAttribute("viewBox").trim().split(/\s+/).map(Number);
    const buttons = {};
    for (const button of figure.querySelectorAll("button[data-zoom]")) {
      buttons[button.dataset.zoom] = button;
    }
    let zoom = 1;
    let left = left0;
    let top = top0;

    const apply = () => {
      const width = width0 / zoom;
      const height = height0 / zoom;
      left = Math.min(Math.max(left, left0), left0 + width0 - width);
      top = Math.min(Math.max(top, top0), top0 + height0 - height);
      svg.setAttribute("viewBox", `${left} ${top} ${width} ${height}`);
      svg.style.setProperty("--m-zoom", String(1 / zoom));
      svg.classList.toggle("m-zoomed", zoom > 1);
      buttons.in.disabled = zoom >= MOST_ZOOM;
      buttons.out.disabled = zoom <= 1;
      buttons.reset.disabled = zoom <= 1;
    };

    // A new zoom about a point given as a share of the view across and down, which stays under it; false when the
    // zoom is already at that end.
    const zoomTo = (next, across, down) => {
      next = Math.min(Math.max(next, 1), MOST_ZOOM);
      if (Math.abs(next - 1) < 0.01) {
        next = 1;
      }
      if (Math.abs(next - zoom) < 1e-6) {
        return false;
      }
      const atX = left + across * width0 / zoom;
      const atY = top + down * height0 / zoom;
      zoom = next;
      left = atX - across * width0 / zoom;
      top = atY - down * height0 / zoom;
      apply();
      return true;
    };

    // A map not laid out (no size on the screen) is zoomed about its middle.
    const shareOf = (clientX, clientY) => {
      const r = svg.getBoundingClientRect();
      return r.width && r.height ? [(clientX - r.left) / r.width, (clientY - r.top) / r.height] : [0.5, 0.5];
    };

    // The wheel over the map is the map's alone: at either end of the zoom it does nothing, rather than scroll the page.
    svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 400 : 1);
      const [across, down] = shareOf(event.clientX, event.clientY);
      zoomTo(zoom * Math.pow(2, -pixels / WHEEL_PIXELS_PER_DOUBLING), across, down);
    }, {passive: false});

    buttons.in.addEventListener("click", () => zoomTo(zoom * BUTTON_STEP, 0.5, 0.5));
    buttons.out.addEventListener("click", () => zoomTo(zoom / BUTTON_STEP, 0.5, 0.5));
    buttons.reset.addEventListener("click", () => zoomTo(1, 0.5, 0.5));

    // A drag moves the map once the pointer has gone a few pixels, so a click on a marker still follows its link; two
    // fingers pinch.
    const pointers = new Map();
    // A pointer let go before it is captured cannot be, and the drag goes on without it.
    const capture = (id) => {
      try {
        svg.setPointerCapture(id);
      } catch (error) {
        // Nothing to hold.
      }
    };
    let drag = null;
    let pinch = null;
    let dragged = false;
    svg.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      dragged = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = {distance: Math.hypot(a.x - b.x, a.y - b.y), zoom};
        drag = null;
        for (const id of pointers.keys()) {
          capture(id);
        }
      } else if (pointers.size === 1) {
        drag = {id: event.pointerId, x: event.clientX, y: event.clientY, left, top, moving: false};
      }
    });
    svg.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) {
        return;
      }
      pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const [across, down] = shareOf((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomTo(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance, across, down);
        dragged = true;
        return;
      }
      if (!drag || drag.id !== event.pointerId || zoom <= 1) {
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moving) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
          return;
        }
        drag.moving = true;
        dragged = true;
        capture(event.pointerId);
        svg.classList.add("m-dragging");
      }
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) {
        return;
      }
      left = drag.left - dx * (width0 / zoom) / r.width;
      top = drag.top - dy * (height0 / zoom) / r.height;
      apply();
    });
    const release = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) {
        pinch = null;
      }
      if (drag && drag.id === event.pointerId) {
        drag = null;
        svg.classList.remove("m-dragging");
      }
    };
    svg.addEventListener("pointerup", release);
    svg.addEventListener("pointercancel", release);
    // The click that ends a drag or a pinch follows no link.
    svg.addEventListener("click", (event) => {
      if (dragged) {
        event.preventDefault();
        event.stopPropagation();
        dragged = false;
      }
    }, true);

    apply();
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
    const {build, boxes} = controlsOf(document.getElementById(continent.value));
    choose(build, params.get("vu"));
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
