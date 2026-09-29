/* Entropia Archive: the page at work.

   The list itself is already in the HTML: render.js draws it with draw.js when GitHub publishes the site, and a local
   preview draws it in the browser. This script only adds what needs a script: the filters, their place in the
   address, the panels' buttons and the links to a version. Without it the page still reads in full, with every panel
   open and no filters (site.css, html:not(.js)). */
(function () {
  "use strict";

  // index.html marks a browser that runs scripts; this says the script arrived too, so that a copy of the page
  // without this file falls back to every panel open instead of panels that cannot open.
  document.documentElement.dataset.script = "ready";

  function wire(root) {
    const selects = [...root.querySelectorAll("select[data-filter]")];
    const years = [...root.querySelectorAll('select[data-filter="from"] option')].map((o) => Number(o.value));
    const first = years[0];
    const last = years[years.length - 1];
    const state = {from: first, to: last, title: "", client: "", engine: "", source: ""};
    // Each row carries what the filters test; draw.js writes it.
    const rows = [...root.querySelectorAll(".entry")].map((el) => ({
      el,
      year: Number(el.dataset.year) || null,
      title: el.dataset.title || "",
      st: el.dataset.status || "",
      family: el.dataset.engine || "",
      physical: el.dataset.physical === "1",
      section: el.closest("section"),
    }));
    const sections = [...root.querySelectorAll("section[data-section]")];
    const nomatch = root.querySelector(".nomatch");
    const clearButton = root.querySelector(".fclear");

    const setPanel = (panel, open) => {
      if (open) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "until-found");
      }
      const control = root.querySelector(`[aria-controls="${CSS.escape(panel.id)}"]`);
      if (control) {
        control.setAttribute("aria-expanded", String(open));
      }
    };

    const apply = () => {
      const full = state.from === first && state.to === last;
      const filtered = !full || state.title !== "" || state.client !== "" || state.engine !== "" || state.source !== "";
      let shown = 0;
      const sectionShown = new Set();
      for (const r of rows) {
        const on = (r.year ? r.year >= state.from && r.year <= state.to : full)
          && (state.title === "" || r.title === state.title)
          && (state.client === "" || r.st === state.client)
          && (state.engine === "" || r.family === state.engine)
          && (state.source === "" || r.physical);
        r.el.hidden = !on;
        if (on) {
          shown += 1;
          sectionShown.add(r.section);
        }
      }
      for (const section of sections) {
        section.hidden = !sectionShown.has(section);
      }
      nomatch.hidden = shown > 0;
      clearButton.hidden = !filtered;
    };

    // The element an address's #... names: #vu-5.7, #5.7 and #vu-4 (for 4.0) all name a version.
    const hashTarget = () => {
      let raw;
      try {
        raw = decodeURIComponent(location.hash.slice(1)).trim();
      } catch (error) {
        return null;
      }
      if (!raw) {
        return null;
      }
      const lower = raw.toLowerCase().replace(/\s+/g, "-");
      const bare = lower.replace(/^vu-/, "");
      return [raw, lower, "vu-" + bare, "vu-" + bare + ".0"].map((id) => document.getElementById(id)).find(Boolean) || null;
    };

    // The filters are in the address too, so that a filtered list can be shared: ?client=lost&source=physical. Only
    // a filter that is set is written, in lower case, and the rest of the query is left as it was. A #... naming a row
    // the filters now hide is dropped, since opening that address would clear them.
    const readAddress = () => {
      const query = new URLSearchParams(location.search);
      for (const select of selects) {
        const key = select.dataset.filter;
        const wanted = (query.get(key) || "").trim().toLowerCase();
        const option = wanted ? [...select.options].find((o) => o.value.toLowerCase() === wanted) : null;
        if (option) {
          select.value = option.value;
          state[key] = key === "from" || key === "to" ? Number(option.value) : option.value;
        }
      }
    };

    const writeAddress = () => {
      const query = new URLSearchParams(location.search);
      const keys = selects.map((select) => select.dataset.filter);
      keys.forEach((key) => query.delete(key));
      for (const key of keys) {
        const unset = state[key] === "" || (key === "from" && state.from === first) || (key === "to" && state.to === last);
        if (!unset) {
          query.append(key, String(state[key]).toLowerCase());
        }
      }
      const target = hashTarget();
      const hash = target && target.closest(".entry[hidden], section[hidden]") ? "" : location.hash;
      const search = query.toString();
      history.replaceState(history.state, "", location.pathname + (search ? `?${search}` : "") + hash);
    };

    const clear = () => {
      Object.assign(state, {from: first, to: last, title: "", client: "", engine: "", source: ""});
      for (const select of selects) {
        select.value = String(state[select.dataset.filter]);
      }
      apply();
      writeAddress();
    };

    for (const select of selects) {
      select.addEventListener("change", () => {
        const key = select.dataset.filter;
        state[key] = key === "from" || key === "to" ? Number(select.value) : select.value;
        apply();
        writeAddress();
      });
    }

    root.addEventListener("click", (event) => {
      const cell = event.target.closest("a.cell");
      if (cell) {
        event.preventDefault();
        const id = cell.getAttribute("href").slice(1);
        if (location.hash.slice(1) !== id) {
          history.pushState(null, "", "#" + id);
        }
        show(document.getElementById(id), "files");
        return;
      }
      const control = event.target.closest("button[aria-controls]");
      if (control) {
        const panel = document.getElementById(control.getAttribute("aria-controls"));
        setPanel(panel, control.getAttribute("aria-expanded") !== "true");
      } else if (event.target.closest(".fclear")) {
        clear();
      }
    });

    // Find in page opens a closed panel that holds what it found; its button follows.
    root.addEventListener("beforematch", (event) => {
      const panel = event.target;
      const control = root.querySelector(`[aria-controls="${CSS.escape(panel.id)}"]`);
      if (control) {
        control.setAttribute("aria-expanded", "true");
      }
    });

    // A link to a version opens its release notes, as it always has (#vu-5.7, #5.7, #vu-4 for 4.0), or its files
    // when it has no notes; a link to a file of its own opens that file; #vu-5.4-files or #vu-5.4-notes opens that
    // panel. A timeline notch opens files first.
    const show = (el, preferred) => {
      if (el.closest(".entry[hidden], section[hidden]")) {
        clear();
      }
      const holder = el.closest(".entry");
      if (holder && el.classList.contains("panel")) {
        setPanel(el, true);
        el = holder.querySelector(":scope > .row");
      } else if (holder && el.classList.contains("row")) {
        const notes = holder.querySelector(":scope > .panel.notes");
        const files = holder.querySelector(":scope > .panel.files");
        const panel = preferred === "files" ? files || notes : notes || files;
        if (panel) {
          setPanel(panel, true);
        }
      }
      el.scrollIntoView();
    };

    const openFromHash = () => {
      const el = hashTarget();
      if (el) {
        show(el, "notes");
      }
    };

    readAddress();
    apply();
    window.addEventListener("hashchange", openFromHash);
    openFromHash();
    writeAddress();
  }

  // The published page arrives drawn. In a local preview draw.js draws it first and says so.
  const app = document.getElementById("app");
  if (app.dataset.rendered === "1") {
    wire(app);
  } else {
    document.addEventListener("archive:drawn", () => wire(app), {once: true});
  }
})();
