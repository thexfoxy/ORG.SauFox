// SauFox Entertainment — site scripts

// Small wrapper around localStorage: it can throw (private windows, blocked
// storage), and the site has to keep working when it does.
const local = {
  get: (key) => {
    try {
      return localStorage.getItem(`saufox.${key}`);
    } catch (e) {
      return null;
    }
  },
  set: (key, value) => {
    try {
      if (value == null) localStorage.removeItem(`saufox.${key}`);
      else localStorage.setItem(`saufox.${key}`, value);
      return true;
    } catch (e) {
      return false;
    }
  },
};

// Accounts live in Supabase (project saufox-entertainment). This key is the
// public one meant for browsers; the database's row-level security decides
// what each member can read and change. The session is stored under
// "saufox.session", which the inline script in each page's <head> checks
// before first paint. Only pages that load js/vendor/supabase.js get a client.
const account = (() => {
  if (!window.supabase) return null;
  // Sessions from the pre-Supabase demo were a bare email address.
  const old = local.get("session");
  if (old && !old.startsWith("{")) local.set("session", null);
  return window.supabase.createClient(
    "https://gwyqkzhhnspfadqefmix.supabase.co",
    "sb_publishable_IB06YrDhrsKJbVghWP-zzg_xDgB1mXN",
    {
      auth: { storageKey: "saufox.session" },
      // Give up after 20 seconds so a stalled connection shows an error
      // instead of leaving the page waiting.
      global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal || (AbortSignal.timeout && AbortSignal.timeout(20000)) }) },
    }
  );
})();

// Keeps the name, photo and currency in this browser too, so the header and
// the price cards can show them straight away on the next visit.
const cacheProfile = (profile) => {
  if (!profile) return;
  local.set("name", profile.name || null);
  local.set("avatar", profile.avatar_url || null);
  local.set("currency", profile.currency || null);
};

const fetchProfile = async (user) => {
  const { data } = await account
    .from("profiles")
    .select("name, currency, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  return data;
};

// Section 1 — Header: split each call-to-action into two lines of letters.
// The resting line runs the orange -> white wave; the hover line (from
// data-hover-text) replaces it letter by letter on hover. CSS staggers the
// motion with each letter's --i.
(function animateLetters() {
  const buildLine = (text, kind) => {
    const line = document.createElement("span");
    line.className = `cta__line cta__line--${kind}`;
    line.setAttribute("aria-hidden", "true");
    const chars = Array.from(text);
    // Short words get a slower, clearly readable wave; long ones stay ~1.4s.
    const step = Math.min(140, 1400 / chars.length);
    chars.forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "cta__char";
      span.textContent = ch;
      span.style.setProperty("--i", i);
      span.style.animationDelay = `${Math.round(i * step)}ms`;
      line.append(span);
    });
    return line;
  };

  document.querySelectorAll("[data-animate-letters]").forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute("aria-label", text);
    el.textContent = "";
    el.append(buildLine(text, "rest"));
    if (el.dataset.hoverText) el.append(buildLine(el.dataset.hoverText, "hover"));
  });
})();

// Section 1 — Header: logotype blur follows the mouse (desktop only).
(function brandBlur() {
  const brand = document.querySelector(".brand");
  if (!brand || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  brand.addEventListener("pointermove", (event) => {
    const box = brand.getBoundingClientRect();
    brand.style.setProperty("--mx", `${event.clientX - box.left}px`);
    brand.style.setProperty("--my", `${event.clientY - box.top}px`);
    brand.classList.add("is-blurring");
  });
  brand.addEventListener("pointerleave", () => brand.classList.remove("is-blurring"));
})();

// Section 1 — Header: profile chip (signed-in users only).
// Desktop expands it on hover (CSS). On touch screens the first tap expands
// it, a second tap follows the link, and tapping elsewhere collapses it.
(function profileChip() {
  const chip = document.querySelector(".profile-chip");
  if (!chip) return;

  const avatar = local.get("avatar");
  if (avatar) chip.querySelector("img").src = avatar;

  const canHover = window.matchMedia("(hover: hover)").matches;

  chip.addEventListener("click", (event) => {
    if (canHover) return;
    if (!chip.classList.contains("is-open")) {
      event.preventDefault();
      chip.classList.add("is-open");
    }
  });

  document.addEventListener("click", (event) => {
    if (!chip.contains(event.target)) chip.classList.remove("is-open");
  });
})();

// The hero's bottom edge, shared by the hero and the work cards. Same shape
// as the hero's mask in css/style.css, in its 1440 x 520 viewBox: flat at
// y=370 up to x=460, a cubic down to (1200, 520), then flat. Takes x as a
// fraction of the hero's width, returns y in viewBox units.
const heroEdgeY = (() => {
  const P = [[1200, 520], [900, 520], [780, 370], [460, 370]];
  const at = (t, k) =>
    (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t ** 2 * P[2][k] + t ** 3 * P[3][k];
  return (fraction) => {
    const x = fraction * 1440;
    if (x <= 460) return 370;
    if (x >= 1200) return 520;
    let lo = 0;
    let hi = 1; // x falls as t rises
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid, 0) > x) lo = mid;
      else hi = mid;
    }
    return at((lo + hi) / 2, 1);
  };
})();

// Section 2 — Hero: key art from the studio's releases, one slanted panel per
// work (up to five), or a single full-width image while there is one work.
// WORKS and CATALOG come from js/content.js.

(function heroCollage() {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const SWAP_EVERY = 4500;
  const MAX_PANELS = 5;

  // One panel per work with a hero image, up to MAX_PANELS.
  const heroes = CATALOG.filter((work) => work.hero);
  const count = Math.min(heroes.length, MAX_PANELS);
  if (!count) return;

  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const art = (work) => {
    const el = document.createElement("span");
    el.className = "hero__art";
    el.style.backgroundImage = `url("${work.hero}")`;
    if (work.heroFocus) el.style.backgroundPosition = work.heroFocus;
    el.dataset.src = work.hero;
    return el;
  };

  hero.style.setProperty("--n", count);
  hero.dataset.count = count;
  hero.replaceChildren(
    ...shuffle(heroes)
      .slice(0, count)
      .map((work, i) => {
        const panel = document.createElement("a");
        panel.className = "hero__panel";
        panel.href = `work.html?id=${encodeURIComponent(work.id)}`;
        panel.setAttribute("aria-label", work.title);
        panel.style.setProperty("--i", i);
        panel.append(art(work));
        return panel;
      })
  );

  // With more works than panels, every few seconds one random panel
  // crossfades to a work not on screen.
  const swap = () => {
    if (document.hidden || calm.matches) return;
    const panels = [...hero.children];
    const shown = new Set(panels.map((p) => p.lastElementChild.dataset.src));
    const options = heroes.filter((work) => !shown.has(work.hero));
    if (!options.length) return;

    const panel = panels[Math.floor(Math.random() * panels.length)];
    const next = art(options[Math.floor(Math.random() * options.length)]);
    next.classList.add("is-entering");
    panel.append(next);
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove("is-entering")));
    setTimeout(() => {
      while (panel.children.length > 1) panel.firstElementChild.remove();
    }, 1600);
  };

  // Clip each panel to exactly what shows: its slanted strip, cut off along
  // the curved bottom edge. Besides looking the same as the mask, this keeps
  // the hero from catching clicks and drags meant for the cards that slide
  // in underneath its curve.
  const clipPanels = () => {
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    if (!W || !H) return;
    const css = getComputedStyle(hero);
    const slant = (parseFloat(css.getPropertyValue("--slant")) / 100) * W;
    const gap = parseFloat(css.getPropertyValue("--gap"));
    const panels = [...hero.children];
    const w = (W + slant) / panels.length;
    const curve = (x) => (heroEdgeY(x / W) * H) / 520;

    // Where a slanted edge (top x -> bottom x) meets the curve.
    const meet = (top, bottom) => {
      const edge = (y) => top + ((bottom - top) * y) / H;
      let lo = 0;
      let hi = H;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (mid < curve(edge(mid))) lo = mid;
        else hi = mid;
      }
      return [edge(hi), hi];
    };

    panels.forEach((panel, i) => {
      const x0 = i === 0 ? -0.3 * W : i * w;
      const x1 = i === panels.length - 1 ? 1.3 * W : (i + 1) * w;
      const [rx, ry] = meet(x1 - gap, x1 - slant - gap);
      const [lx, ly] = meet(x0 + gap, x0 - slant + gap);
      const points = [[x0 + gap, 0], [x1 - gap, 0], [rx, ry]];
      for (let x = rx - 8; x > lx; x -= 8) points.push([x, curve(x)]);
      points.push([lx, ly]);
      panel.style.clipPath = `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
    });
  };

  clipPanels();
  new ResizeObserver(clipPanels).observe(hero);
  if (heroes.length > count) setInterval(swap, SWAP_EVERY);
})();


// Sliding rows (work cards, category rows): drag like a touch screen on
// every device. Phones use native touch scrolling. With a mouse the row
// follows the pointer, then glides on with the release speed and settles on
// a card.
const dragScroll = (track) => {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let drag = null;
  let glide = 0;

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    cancelAnimationFrame(glide);
    drag = { x: event.clientX, left: track.scrollLeft, moved: false, v: 0, lastX: event.clientX, lastT: performance.now() };
  });

  window.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      track.classList.add("is-dragging");
    }
    if (!drag.moved) return;
    track.scrollLeft = drag.left - dx;
    const now = performance.now();
    const dt = Math.max(now - drag.lastT, 1);
    drag.v = 0.8 * ((event.clientX - drag.lastX) / dt) + 0.2 * drag.v; // px per ms
    drag.lastX = event.clientX;
    drag.lastT = now;
  });

  window.addEventListener("pointerup", () => {
    if (!drag) return;
    const { moved } = drag;
    let v = drag.v * 16; // px per frame
    drag = null;
    if (!moved) return;

    // Swallow the click that ends a drag so it doesn't open a card.
    track.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        e.preventDefault();
      },
      { capture: true, once: true }
    );

    const settle = () => track.classList.remove("is-dragging"); // snapping resumes
    if (calm.matches || Math.abs(v) < 0.5) return settle();
    const tick = () => {
      track.scrollLeft -= v;
      v *= 0.94;
      if (Math.abs(v) > 0.5) glide = requestAnimationFrame(tick);
      else settle();
    };
    glide = requestAnimationFrame(tick);
  });
};

// Section 4 — Work cards, rendered from CATALOG in js/content.js.

(function workCards() {
  const section = document.querySelector(".works");
  const track = section && section.querySelector(".works__track");
  if (!track) return;

  const hero = document.querySelector(".hero");
  const currencyButtons = [...section.querySelectorAll("[data-currency]")];
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  const CURRENCIES = ["USD", "EUR", "IRR"];
  const STATUS = {
    released: "Released",
    preorder: "Pre-order",
    coming: "Coming soon",
    production: "In production",
  };
  const money = {
    USD: (n) => `$${n.toFixed(2)}`,
    EUR: (n) => `€${n.toFixed(2)}`,
    IRR: (n) => `${Math.round(n).toLocaleString("en-US")} Rials`,
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // Shows item `next` in a list of absolutely stacked items.
  const step = (items, next, leavingClass) => {
    items.forEach((item, i) => {
      const wasActive = item.classList.contains("is-active");
      item.classList.toggle("is-active", i === next);
      if (leavingClass) item.classList.toggle(leavingClass, wasActive && i !== next);
    });
  };

  let mode = "auto"; // "auto" cycles currencies; otherwise a fixed code

  // ---------- Cards ----------
  const cards = CATALOG.map((work, index) => {
    const card = el("article", "card");

    const link = el("a", "card__link");
    link.href = `work.html?id=${encodeURIComponent(work.id)}`;
    const media = el("div", "card__media");
    link.append(media);
    const slides = work.images.map((src, i) => {
      const img = el("img", "card__slide" + (i === 0 ? " is-active" : ""));
      img.src = src;
      img.alt = i === 0 ? `${work.title} artwork` : "";
      img.loading = "lazy";
      img.draggable = false;
      return img;
    });
    const dots = el("div", "card__dots");
    const dotButtons = slides.map((_, i) => {
      const dot = el("button", "card__dot" + (i === 0 ? " is-active" : ""));
      dot.type = "button";
      dot.setAttribute("aria-label", `Show image ${i + 1} of ${slides.length}`);
      dots.append(dot);
      return dot;
    });
    const caption = el("div", "card__caption");
    caption.append(el("h2", "card__title", work.title), el("span", "card__kind", work.kind));
    media.append(...slides, caption);
    if (slides.length > 1) media.append(dots);

    const price = el("div", "card__price");
    const priceTrack = el("div", "card__price-track");
    // Only the currencies the work is sold in. Works without a price yet
    // show their note (say, a trailer date) instead.
    const codes = CURRENCIES.filter((code) => work.prices && work.prices[code] != null);
    const amounts = codes.length
      ? codes.map((code, i) => el("span", "card__amount" + (i === 0 ? " is-active" : ""), money[code](work.prices[code])))
      : [el("span", "card__amount is-active", work.note.text)];
    priceTrack.append(...amounts);
    price.append(el("span", "card__price-label", codes.length ? "Price" : work.note.label), priceTrack);

    const status = el("span", `card__status card__status--${work.status}`, work.statusText || STATUS[work.status]);

    card.append(link, price, status);
    track.append(card);

    // Image slider: every 4s, paused while the pointer is on the image.
    let slide = 0;
    let paused = false;
    const showSlide = (i) => {
      slide = i;
      step(slides, i);
      step(dotButtons, i);
    };
    dotButtons.forEach((dot, i) =>
      dot.addEventListener("click", (event) => {
        event.preventDefault(); // the dots sit inside the card's link
        showSlide(i);
      })
    );
    media.addEventListener("pointerenter", () => (paused = true));
    media.addEventListener("pointerleave", () => (paused = false));

    // Price: cycles every 2.6s in "auto" mode; staggered per card.
    let currency = 0;
    const showCurrency = (i) => {
      if (i === currency || amounts.length < 2) return;
      currency = i;
      step(amounts, i, "is-leaving");
    };

    setTimeout(() => {
      setInterval(() => {
        if (document.hidden || calm.matches || paused) return;
        showSlide((slide + 1) % slides.length);
      }, 4000);
      setInterval(() => {
        if (document.hidden || calm.matches || mode !== "auto") return;
        showCurrency((currency + 1) % amounts.length);
      }, 2600);
    }, (index % 4) * 350);

    // Pins a currency; works not sold in it keep what they show.
    const pinCurrency = (code) => codes.includes(code) && showCurrency(codes.indexOf(code));

    return { work, card, pinCurrency };
  });

  // ---------- Currency buttons ----------
  currencyButtons.forEach((button) =>
    button.addEventListener("click", () => {
      mode = button.dataset.currency;
      currencyButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      if (mode !== "auto") cards.forEach((c) => c.pinCurrency(mode));
      document.dispatchEvent(new CustomEvent("currencymode", { detail: mode }));
      try {
        localStorage.setItem("saufox.currency", mode);
      } catch (e) {}
    })
  );

  // Start in the currency the visitor chose last time (here or in Settings).
  try {
    const saved = localStorage.getItem("saufox.currency");
    const button = saved && currencyButtons.find((b) => b.dataset.currency === saved);
    if (button && saved !== "auto") setTimeout(() => button.click());
  } catch (e) {}

  dragScroll(track);

  // ---------- Fade under the hero ----------
  // The row gets a mask that is transparent above the hero's bottom edge
  // (heroEdgeY) and fades in over FADE px below it.
  const FADE = 90;

  const updateMask = () => {
    if (!hero) return;
    const t = track.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    const W = Math.round(t.width);
    const H = Math.round(t.height);
    const points = [];
    let lowest = -Infinity;
    for (let x = -80; x <= W + 80; x += 12) {
      const y = h.top + (heroEdgeY((t.left + x - h.left) / h.width) / 520) * h.height - t.top + FADE / 2;
      lowest = Math.max(lowest, y);
      points.push(`${x},${y.toFixed(1)}`);
    }
    if (lowest + FADE < 0) {
      track.style.removeProperty("--curve-mask");
      return;
    }
    points.push(`${W + 80},${H + 300}`, `-80,${H + 300}`);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${FADE / 3}"/></filter>` +
      `<polygon points="${points.join(" ")}" filter="url(#f)"/></svg>`;
    track.style.setProperty("--curve-mask", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  };

  updateMask();
  new ResizeObserver(updateMask).observe(track);
  window.addEventListener("resize", updateMask);
  if (document.fonts) document.fonts.ready.then(updateMask);
})();

// A small poster card linking to a work's page (category rows, My List).
const posterCard = (work) => {
  const link = document.createElement("a");
  link.className = "poster-card";
  link.href = `work.html?id=${encodeURIComponent(work.id)}`;
  const frame = document.createElement("span");
  frame.className = "poster-card__frame";
  const img = document.createElement("img");
  img.src = work.images[0];
  img.alt = "";
  img.loading = "lazy";
  img.draggable = false;
  frame.append(img);
  const title = document.createElement("span");
  title.className = "poster-card__title";
  title.textContent = work.title;
  const kind = document.createElement("span");
  kind.className = "poster-card__kind";
  kind.textContent = work.kind;
  link.append(frame, title, kind);
  return link;
};

// Home page — category rows under the main row, like a streaming service.
// They only appear once the catalogue spans at least two kinds of work;
// until then the main row already shows everything.
(function shelves() {
  const section = document.querySelector(".shelves");
  if (!section) return;

  const KINDS = [
    ["Games", (w) => /game/i.test(w.kind)],
    ["Films", (w) => /film|movie/i.test(w.kind)],
    ["Animation", (w) => /anim/i.test(w.kind)],
    ["Novels", (w) => /novel|book/i.test(w.kind)],
  ];
  const kindsInUse = KINDS.filter(([, test]) => CATALOG.some(test)).length;
  if (kindsInUse < 2) return;

  const rows = [["Coming soon", (w) => ["coming", "preorder", "production"].includes(w.status)], ...KINDS];
  rows.forEach(([name, test]) => {
    const works = CATALOG.filter(test);
    if (!works.length) return;
    const shelf = document.createElement("section");
    shelf.className = "shelf";
    const heading = document.createElement("h2");
    heading.className = "shelf__heading";
    heading.textContent = name;
    const track = document.createElement("div");
    track.className = "shelf__track";
    track.tabIndex = 0;
    track.setAttribute("aria-label", `${name}, drag or swipe sideways for more`);
    track.append(...works.map(posterCard));
    shelf.append(heading, track);
    section.append(shelf);
    dragScroll(track);
  });
  section.hidden = false;
})();

// Section 5 — Subscriptions: plan prices use the same currency ticker as the
// work cards and follow the currency chosen there ("auto" keeps cycling).
(function planPrices() {
  const boxes = [...document.querySelectorAll(".plan__amounts")];
  if (!boxes.length) return;

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const CODES = ["USD", "EUR", "IRR"];
  const format = {
    USD: (n) => `$${n.toFixed(2)}`,
    EUR: (n) => `€${n.toFixed(2)}`,
    IRR: (n) => `${Math.round(n).toLocaleString("en-US")} Rials`,
  };

  const tickers = boxes.map((box) => {
    const items = CODES.map((code, i) => {
      const span = document.createElement("span");
      span.className = "card__amount" + (i === 0 ? " is-active" : "");
      span.textContent = format[code](Number(box.dataset[code.toLowerCase()]));
      box.append(span);
      return span;
    });
    return items;
  });

  let mode = "auto";
  let current = 0;
  // Each box is as wide as the price it shows, so "/ month" sits right after.
  const fit = () =>
    boxes.forEach((box, b) => (box.style.width = `${tickers[b][current].offsetWidth}px`));
  const show = (i) => {
    if (i === current) return;
    current = i;
    fit();
    tickers.forEach((items) =>
      items.forEach((item, k) => {
        const was = item.classList.contains("is-active");
        item.classList.toggle("is-active", k === i);
        item.classList.toggle("is-leaving", was && k !== i);
      })
    );
  };

  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  window.addEventListener("resize", fit);

  document.addEventListener("currencymode", (event) => {
    mode = event.detail;
    if (mode !== "auto") show(CODES.indexOf(mode));
  });

  setInterval(() => {
    if (document.hidden || calm.matches || mode !== "auto") return;
    show((current + 1) % CODES.length);
  }, 2600);
})();

// Section 5 — Subscriptions: each plan's hover light follows the pointer.
(function planLight() {
  document.querySelectorAll(".plan").forEach((plan) =>
    plan.addEventListener("pointermove", (event) => {
      const box = plan.getBoundingClientRect();
      plan.style.setProperty("--mx", `${event.clientX - box.left}px`);
      plan.style.setProperty("--my", `${event.clientY - box.top}px`);
    })
  );
})();

// Site-wide: no copying text and no saving images (right-click menu,
// dragging images out, copy / cut). Form fields keep working normally.
(function protectContent() {
  // Form fields and contact details (.selectable) can still be copied.
  const isField = (el) => el instanceof Element && el.closest("input, textarea, [contenteditable], .selectable");
  document.addEventListener("contextmenu", (e) => { if (!isField(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (e.target instanceof HTMLImageElement) e.preventDefault(); });
  ["copy", "cut"].forEach((type) =>
    document.addEventListener(type, (e) => { if (!isField(e.target)) e.preventDefault(); })
  );
})();

// Login page — background strips, curved art layers, Login / Sign Up tabs
// with sliding forms, and password reveal.
// Accounts go through Supabase (see `account` at the top of this file).
(function loginPage() {
  const auth = document.querySelector(".auth");
  if (!auth) return;

  const shuffled = WORKS.slice().sort(() => Math.random() - 0.5);

  // Background strips
  const bg = document.querySelector(".login-bg");
  const count = window.matchMedia("(max-width: 760px)").matches ? 4 : 6;
  bg.style.setProperty("--n", count);
  // Images repeat when there are fewer works than slots.
  const pick = (i) => shuffled[i % shuffled.length];
  Array.from({ length: count }, (_, i) => pick(i)).forEach((src, i) => {
    const strip = document.createElement("div");
    strip.className = "login-bg__strip";
    strip.style.setProperty("--i", i);
    const art = document.createElement("span");
    art.className = "login-bg__art";
    art.style.backgroundImage = `url("${src}")`;
    strip.append(art);
    bg.append(strip);
  });

  // Curved art layers, plus one more image in the corner behind them
  auth.querySelectorAll(".auth__band").forEach((band, i) => {
    band.style.backgroundImage = `url("${pick(count + i)}")`;
  });
  auth.querySelector(".auth__art").style.backgroundImage = `url("${pick(count + 3)}")`;

  // Tabs and sliding forms
  const tabs = { login: auth.querySelector("#tab-login"), signup: auth.querySelector("#tab-signup") };
  const forms = { login: auth.querySelector("#form-login"), signup: auth.querySelector("#form-signup") };
  const viewport = auth.querySelector(".auth__viewport");
  let mode = location.hash === "#signup" ? "signup" : "login";

  const fitHeight = () => (viewport.style.height = `${forms[mode].offsetHeight}px`);

  const setMode = (next) => {
    mode = next;
    auth.dataset.mode = mode;
    Object.keys(tabs).forEach((key) => {
      tabs[key].setAttribute("aria-selected", String(key === mode));
      forms[key].inert = key !== mode;
    });
    fitHeight();
    // Leave the hash alone while it carries a sign-in from a confirmation link.
    if (!location.hash || location.hash === "#signup")
      history.replaceState(null, "", mode === "signup" ? "#signup" : location.pathname + location.search);
  };

  Object.keys(tabs).forEach((key) => tabs[key].addEventListener("click", () => setMode(key)));
  window.addEventListener("resize", fitHeight);
  setMode(mode);

  // Password reveal
  auth.querySelectorAll(".field__reveal").forEach((button) => {
    const input = button.parentElement.querySelector("input");
    button.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      input.focus();
    });
  });

  // Submitting
  const say = (el, text, ok) => {
    el.textContent = text;
    el.classList.toggle("is-ok", Boolean(ok));
    fitHeight();
  };

  const problem = (form) => {
    for (const input of form.querySelectorAll("input")) {
      if (input.validity.valid) continue;
      const name = input.closest(".field").querySelector(".field__label").textContent;
      input.focus();
      if (input.validity.valueMissing) return `Enter your ${name.toLowerCase()}.`;
      if (input.validity.typeMismatch) return "Enter an email address like name@example.com.";
      if (input.validity.tooShort) return `Use at least ${input.minLength} characters for your password.`;
      return `Check your ${name.toLowerCase()}.`;
    }
    return "";
  };

  const ERRORS = {
    invalid_credentials: "That email and password don't match. Check them and try again.",
    email_not_confirmed: "Confirm your email first: open the link we sent you, then log in.",
    user_already_exists: "There's already an account with this email. Log in instead.",
    weak_password: "Choose a stronger password, one that isn't easy to guess.",
    over_request_rate_limit: "Too many tries. Wait a minute and try again.",
    over_email_send_rate_limit: "Too many emails sent. Wait a while and try again.",
  };
  const explain = (error) =>
    ERRORS[error.code] ||
    (error.status ? error.message : "Couldn't reach the server. Check your connection and try again.");

  const goHome = async (user, message, text) => {
    local.set("hasAccount", "1");
    say(message, text, true);
    cacheProfile(await fetchProfile(user));
    setTimeout(() => (location.href = "index.html"), 700);
  };

  Object.entries(forms).forEach(([key, form]) =>
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = form.querySelector(".auth__message");
      const submit = form.querySelector(".auth__submit");
      const invalid = problem(form);
      if (invalid) return say(message, invalid);
      if (!account) return say(message, "Accounts aren't available right now. Try again later.");

      const email = form.querySelector('input[name="email"]').value.trim();
      const password = form.querySelector('input[name="password"]').value;
      const nameInput = form.querySelector('input[name="name"]');

      submit.disabled = true;
      say(message, key === "login" ? "Logging in…" : "Creating your account…", true);
      let result;
      try {
        result =
          key === "login"
            ? await account.auth.signInWithPassword({ email, password })
            : await account.auth.signUp({
                email,
                password,
                options: {
                  data: { name: nameInput.value.trim() },
                  emailRedirectTo: new URL("login.html", location.href).href,
                },
              });
      } catch (e) {
        result = { error: {} };
      }
      submit.disabled = false;

      const { data, error } = result;
      if (error) return say(message, explain(error));
      // With email confirmation on, signing up again with a taken email
      // returns a user with no identities instead of an error.
      if (key === "signup" && data.user && data.user.identities && !data.user.identities.length)
        return say(message, ERRORS.user_already_exists);
      if (!data.session) {
        local.set("hasAccount", "1");
        setMode("login");
        forms.login.querySelector('input[name="email"]').value = email;
        return say(
          forms.login.querySelector(".auth__message"),
          `We sent a confirmation link to ${email}. Open it, then log in.`,
          true
        );
      }
      submit.disabled = true;
      goHome(data.user, message, key === "login" ? "Welcome back. Taking you home…" : "Account created. Taking you home…");
    })
  );

  // Arriving from the confirmation email (or already signed in): go home.
  if (account)
    account.auth.getSession().then(({ data }) => {
      if (data.session)
        goHome(data.session.user, forms.login.querySelector(".auth__message"), "You're signed in. Taking you home…");
    });

  const socialMessage = auth.querySelector(".auth__message--social");
  auth.querySelectorAll(".social").forEach((button) =>
    button.addEventListener("click", () =>
      say(socialMessage, `${button.dataset.provider} sign-in isn't connected yet. Use your email for now.`)
    )
  );
})();

// Profile page — the member's name, email, join date and photo from their
// account, tabs, and settings (photo, name, default currency, log out).
(async function profilePage() {
  const page = document.querySelector(".profile-page");
  if (!page) return;

  const DEFAULT_AVATAR = document.querySelector(".profile-avatar__img").getAttribute("src");

  const showName = (name) =>
    page.querySelectorAll('[data-profile="name"]').forEach((el) => (el.textContent = name));
  const showAvatar = (src) =>
    document.querySelectorAll(".profile-avatar__img, .profile-chip img").forEach((img) => (img.src = src));

  // ---------- Tabs ----------
  const tabList = page.querySelector(".profile-tabs");
  const tabs = [...tabList.querySelectorAll(".profile-tab")];
  const select = (index) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      document.getElementById(tab.getAttribute("aria-controls")).hidden = i !== index;
    });
    tabList.style.setProperty("--tab", index);
  };
  tabs.forEach((tab, i) => tab.addEventListener("click", () => select(i)));
  const fromHash = tabs.findIndex((tab) => `#${tab.id.replace("tab-", "")}` === location.hash);
  select(Math.max(fromHash, 0));

  // ---------- My List ----------
  const showMyList = async (userId) => {
    const { data, error } = await account
      .from("my_list")
      .select("work_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return;
    const works = data.map((row) => CATALOG.find((w) => w.id === row.work_id)).filter(Boolean);
    if (!works.length) return;
    const grid = document.createElement("div");
    grid.className = "poster-grid";
    grid.append(...works.map(posterCard));
    document.getElementById("panel-wishlist").replaceChildren(grid);
  };

  // ---------- Settings controls ----------
  const form = page.querySelector(".settings");
  const message = form.querySelector(".auth__message");
  const nameInput = form.querySelector("#settings-name");
  const fileInput = form.querySelector("#avatar-input");
  const preview = form.querySelector(".profile-avatar__img");
  const submit = form.querySelector('[type="submit"]');
  const currencyButtons = [...form.querySelectorAll("[data-currency]")];

  const say = (text, ok) => {
    message.textContent = text;
    message.classList.toggle("is-ok", Boolean(ok));
  };

  let currency = local.get("currency") || "auto";
  const pressCurrency = () =>
    currencyButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.currency === currency)));
  currencyButtons.forEach((b) =>
    b.addEventListener("click", () => {
      currency = b.dataset.currency;
      pressCurrency();
    })
  );

  // What this browser remembers, shown until the account answers.
  showName(local.get("name") || "");
  showAvatar(local.get("avatar") || DEFAULT_AVATAR);
  nameInput.value = local.get("name") || "";
  pressCurrency();

  // ---------- Account ----------
  const session = account && (await account.auth.getSession()).data.session;
  if (!session) {
    local.set("session", null);
    location.replace("login.html");
    return;
  }
  const user = session.user;
  const fallbackName = (user.email || "").split("@")[0] || "SauFox fan";

  page.querySelector('[data-profile="email"]').textContent = user.email;
  page.querySelector('[data-profile="since"]').textContent = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  showMyList(user.id);
  let profile = await fetchProfile(user);
  if (profile) {
    cacheProfile(profile);
    currency = profile.currency;
    pressCurrency();
  } else {
    profile = { name: local.get("name") || "", avatar_url: local.get("avatar") };
  }
  showName(profile.name || fallbackName);
  showAvatar(profile.avatar_url || DEFAULT_AVATAR);
  nameInput.value = profile.name || fallbackName;

  // ---------- Photo ----------
  // A new photo waits here until "Save changes". undefined = unchanged,
  // null = remove, a Blob = upload. Photos are shrunk to 320px on the long
  // side before upload.
  let pendingAvatar;
  const avatarPath = `${user.id}/avatar.jpg`;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return say("Choose an image file, such as a JPG or PNG.");
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 320 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob(
        (blob) => {
          pendingAvatar = blob;
          preview.src = URL.createObjectURL(blob);
          say("Photo ready. Save changes to keep it.", true);
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => say("That image couldn't be opened. Try another file.");
    img.src = URL.createObjectURL(file);
    fileInput.value = "";
  });

  form.querySelector('[data-action="remove-photo"]').addEventListener("click", () => {
    pendingAvatar = null;
    preview.src = DEFAULT_AVATAR;
    say("Photo removed. Save changes to keep it that way.", true);
  });

  // ---------- Save ----------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return say("Enter your name.");
    }

    submit.disabled = true;
    say("Saving…", true);
    try {
      const photos = account.storage.from("avatars");
      let avatarUrl = profile.avatar_url || null;
      if (pendingAvatar === null) {
        await photos.remove([avatarPath]);
        avatarUrl = null;
      } else if (pendingAvatar) {
        const { error } = await photos.upload(avatarPath, pendingAvatar, {
          upsert: true,
          contentType: "image/jpeg",
          cacheControl: "3600",
        });
        if (error) throw error;
        // The version number makes browsers fetch the new photo.
        avatarUrl = `${photos.getPublicUrl(avatarPath).data.publicUrl}?v=${Date.now()}`;
      }

      const changes = { name, currency, avatar_url: avatarUrl, updated_at: new Date().toISOString() };
      const { error } = await account.from("profiles").update(changes).eq("id", user.id);
      if (error) throw error;

      profile = { ...profile, ...changes };
      pendingAvatar = undefined;
      cacheProfile(profile);
      showName(name);
      showAvatar(avatarUrl || DEFAULT_AVATAR);
      say("Saved.", true);
    } catch (e) {
      say("Your changes weren't saved. Check your connection and try again.");
    }
    submit.disabled = false;
  });

  form.querySelector('[data-action="logout"]').addEventListener("click", async () => {
    try {
      await account.auth.signOut();
    } catch (e) {}
    ["session", "name", "avatar"].forEach((key) => local.set(key, null));
    location.href = "index.html";
  });
})();

// Title page (work.html?id=<id>) — one page per work in CATALOG: key art,
// name, poster, facts, trailer and buy actions, a countdown to the trailer,
// synopsis, gallery and credits. Sections without data stay hidden.
(function titlePage() {
  const page = document.querySelector(".title-page");
  if (!page) return;

  const id = new URLSearchParams(location.search).get("id");
  const work = CATALOG.find((w) => w.id === id);
  if (!work) {
    page.querySelectorAll(":scope > section:not(.title-missing)").forEach((s) => (s.hidden = true));
    page.querySelector(".title-missing").hidden = false;
    document.title = "Not found · SauFox Entertainment";
    return;
  }

  const STATUS = { released: "Released", preorder: "Pre-order", coming: "Coming soon", production: "In production" };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  document.title = `${work.title} · SauFox Entertainment`;

  // Key art, kicker and name
  const art = page.querySelector(".title-hero__art");
  art.style.backgroundImage = `url("${work.hero || work.images[0]}")`;
  if (work.heroFocus) art.style.backgroundPosition = work.heroFocus;
  const kicker = page.querySelector(".title-head__kicker");
  kicker.append(work.kind, " \u00b7 ", make("b", "", STATUS[work.status] || ""));
  page.querySelector(".title-head__name").textContent = work.title;

  // Poster
  const poster = page.querySelector(".title-poster img");
  poster.src = work.images[0];
  poster.alt = `${work.title} poster`;

  // Facts
  const money = {
    USD: (n) => `$${n.toFixed(2)}`,
    EUR: (n) => `\u20ac${n.toFixed(2)}`,
    IRR: (n) => `${Math.round(n).toLocaleString("en-US")} Rials`,
  };
  const dateText = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tehran" });
  const prices = work.prices ? Object.keys(money).filter((code) => work.prices[code] != null) : [];
  const facts = [
    ["Price", prices.map((code) => money[code](work.prices[code])).join(" / ")],
    ["Genre", (work.genres || []).join(", ")],
    ["Platforms", (work.platforms || []).join(", ")],
    ["Age rating", work.rating],
  ];
  const factList = page.querySelector(".title-facts");
  facts.forEach(([label, value]) => {
    if (!value) return;
    const row = make("div");
    row.append(make("dt", "", label), make("dd", "", value));
    factList.append(row);
  });
  factList.hidden = !factList.children.length;

  // Actions: the trailer once it's out, otherwise its date; buying isn't
  // open yet.
  const play = page.querySelector('[data-action="trailer"]');
  const trailerSoon = page.querySelector('[data-slot="trailer-soon"]');
  if (work.trailer) play.hidden = false;
  else if (work.trailerDate) {
    trailerSoon.textContent = `Trailer on ${dateText(work.trailerDate)}`;
    trailerSoon.hidden = false;
  }
  page.querySelector('[data-slot="buy-soon"]').hidden = !prices.length;

  // Countdown to the trailer
  const countdown = page.querySelector(".countdown");
  const target = work.trailerDate && !work.trailer ? new Date(work.trailerDate).getTime() : 0;
  if (target > Date.now()) {
    countdown.hidden = false;
    countdown.querySelector(".countdown__label").textContent = "The trailer premieres in";
    const units = Object.fromEntries([...countdown.querySelectorAll("[data-unit]")].map((b) => [b.dataset.unit, b]));
    const tick = () => {
      const left = Math.max(0, target - Date.now());
      const s = Math.floor(left / 1000);
      units.days.textContent = Math.floor(s / 86400);
      units.hours.textContent = String(Math.floor(s / 3600) % 24).padStart(2, "0");
      units.minutes.textContent = String(Math.floor(s / 60) % 60).padStart(2, "0");
      units.seconds.textContent = String(s % 60).padStart(2, "0");
      if (!left) {
        clearInterval(timer);
        countdown.querySelector(".countdown__label").textContent = "The trailer is out. Check back shortly.";
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
  }

  // My List: saved to the member's account; signed-out visitors are sent
  // to log in.
  const listButton = page.querySelector('[data-action="my-list"]');
  const setListed = (on) => {
    listButton.classList.toggle("is-on", on);
    listButton.setAttribute("aria-pressed", String(on));
    listButton.querySelector("span").textContent = on ? "In My List" : "My List";
  };
  listButton.hidden = false;
  (async () => {
    const session = account && (await account.auth.getSession()).data.session;
    if (!session) {
      listButton.addEventListener("click", () => (location.href = "login.html"));
      return;
    }
    const { data } = await account.from("my_list").select("work_id").eq("work_id", work.id).maybeSingle();
    let listed = Boolean(data);
    setListed(listed);
    listButton.addEventListener("click", async () => {
      listButton.disabled = true;
      const next = !listed;
      setListed(next);
      const { error } = next
        ? await account.from("my_list").insert({ work_id: work.id })
        : await account.from("my_list").delete().eq("work_id", work.id).eq("user_id", session.user.id);
      if (error && error.code !== "23505") setListed(listed); // 23505: already saved
      else listed = next;
      listButton.disabled = false;
    });
  })();

  // Synopsis
  if (work.synopsis) {
    const synopsis = page.querySelector(".title-synopsis");
    synopsis.textContent = work.synopsis;
    synopsis.hidden = false;
  }

  // Credits
  if (work.credits && work.credits.length) {
    const list = page.querySelector(".title-credits__list");
    work.credits.forEach(([role, name]) => {
      const row = make("div");
      row.append(make("dt", "", role), make("dd", "", name));
      list.append(row);
    });
    page.querySelector(".title-credits").hidden = false;
  }

  // Viewer: stills full size, or the trailer.
  const viewer = document.querySelector(".viewer");
  const stage = viewer.querySelector(".viewer__stage");
  const stills = work.stills || [];
  let current = 0;
  let opener = null;

  const open = (content, single) => {
    opener = document.activeElement;
    stage.replaceChildren(content);
    viewer.classList.toggle("is-single", single);
    viewer.hidden = false;
    document.body.style.overflow = "hidden";
    viewer.querySelector(".viewer__close").focus();
  };
  const close = () => {
    viewer.hidden = true;
    stage.replaceChildren(); // stops the trailer
    document.body.style.overflow = "";
    if (opener) opener.focus();
  };
  const showStill = (i) => {
    current = (i + stills.length) % stills.length;
    const img = make("img");
    img.src = stills[current];
    img.alt = `${work.title}, image ${current + 1} of ${stills.length}`;
    img.draggable = false;
    if (viewer.hidden) open(img, stills.length < 2);
    else stage.replaceChildren(img);
  };

  viewer.querySelector(".viewer__close").addEventListener("click", close);
  viewer.querySelector(".viewer__step--prev").addEventListener("click", () => showStill(current - 1));
  viewer.querySelector(".viewer__step--next").addEventListener("click", () => showStill(current + 1));
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer || event.target === stage) close();
  });
  document.addEventListener("keydown", (event) => {
    if (viewer.hidden) return;
    if (event.key === "Escape") close();
    const isStill = stage.firstElementChild && stage.firstElementChild.tagName === "IMG";
    if (isStill && event.key === "ArrowLeft") showStill(current - 1);
    if (isStill && event.key === "ArrowRight") showStill(current + 1);
  });

  // Aparat plays in Iran without a VPN; the ID comes from aparat.com/v/<ID>.
  play.addEventListener("click", () => {
    const frame = make("iframe");
    frame.src = `https://www.aparat.com/video/video/embed/videohash/${encodeURIComponent(work.trailer)}/vt/frame`;
    frame.title = `${work.title} trailer`;
    frame.allow = "autoplay; fullscreen; picture-in-picture";
    frame.allowFullscreen = true;
    open(frame, true);
  });

  // Gallery
  if (stills.length) {
    const grid = page.querySelector(".title-gallery__grid");
    stills.forEach((src, i) => {
      const button = make("button", "title-gallery__item");
      button.type = "button";
      button.setAttribute("aria-label", `Open image ${i + 1} of ${stills.length}`);
      const img = make("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      button.append(img);
      button.addEventListener("click", () => showStill(i));
      grid.append(button);
    });
    page.querySelector(".title-gallery").hidden = false;
  }
})();
