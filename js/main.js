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

// ---------- Language ----------
// English, or Persian (right to left). The inline script in each page's
// <head> picks the language before first paint and hides a Persian page
// until its text is in. Here every English text and label listed in FA
// (js/fa.js) becomes Persian, now and whenever the scripts add more. Parts
// marked translate="no" (work titles, names, emails) are left alone.
const LANG = document.documentElement.lang === "fa" && typeof FA !== "undefined" ? "fa" : "en";

const faDigits = (text) => String(text).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const digits = (text) => (LANG === "fa" ? faDigits(text) : String(text));
const num = (n, decimals = 0) =>
  n.toLocaleString(LANG === "fa" ? "fa-IR" : "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const money = {
  USD: (n) => (LANG === "fa" ? `${num(n, 2)} دلار` : `$${num(n, 2)}`),
  EUR: (n) => (LANG === "fa" ? `${num(n, 2)} یورو` : `€${num(n, 2)}`),
  IRR: (n) => (LANG === "fa" ? `${num(Math.round(n))} ریال` : `${num(Math.round(n))} Rials`),
};
const priceText = (work, code) => (work.approx && work.approx[code] ? "≈ " : "") + money[code](work.prices[code]);

// Dates in Tehran time; Persian uses the Iranian calendar.
const dateText = (iso, options = { day: "numeric", month: "long", year: "numeric" }) =>
  new Date(iso).toLocaleDateString(LANG === "fa" ? "fa-IR" : "en-GB", { ...options, timeZone: "Asia/Tehran" });

// Keys with {name} parts become patterns.
const faPatterns =
  LANG === "fa"
    ? Object.keys(FA)
        .filter((key) => key.includes("{"))
        .map((key) => {
          const names = [];
          const source = key
            .replace(/[.*+?^$()|[\]\\{}]/g, "\\$&")
            .replace(/\\\{(\w+)\\\}/g, (_, name) => {
              names.push(name);
              return "(.+?)";
            });
          return { key, names, re: new RegExp(`^${source}$`) };
        })
    : [];

const t = (text) => {
  if (LANG !== "fa" || !text) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  let out = FA[trimmed];
  if (out === undefined) {
    for (const { key, names, re } of faPatterns) {
      const match = trimmed.match(re);
      if (!match) continue;
      out = names.reduce((s, name, i) => {
        const value = match[i + 1];
        return s.replace(`{${name}}`, /^\d+$/.test(value) ? faDigits(value) : FA[value] || value);
      }, FA[key]);
      break;
    }
  }
  return out === undefined ? text : text.replace(trimmed, out);
};

(function translatePage() {
  if (LANG !== "fa") return;
  const SKIP = "script, style, textarea, [translate='no']";
  const ATTRS = ["placeholder", "aria-label", "title", "alt", "data-hover-text"];

  const translateText = (node) => {
    if (!node.parentElement || node.parentElement.closest(SKIP)) return;
    const next = t(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  };
  const translateAttr = (el, name) => {
    const value = el.getAttribute(name);
    const next = value && t(value);
    if (next && next !== value && !el.closest(SKIP)) el.setAttribute(name, next);
  };
  const translateTree = (root) => {
    if (root.nodeType === Node.TEXT_NODE) return translateText(root);
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(SKIP)) return;
    [root, ...root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))].forEach((el) =>
      ATTRS.forEach((a) => el.hasAttribute(a) && translateAttr(el, a))
    );
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateText(walker.currentNode);
  };

  translateTree(document.documentElement);
  // The Persian about page has its own contact heading.
  if (location.hash === "#contact" && document.getElementById("contact-fa"))
    addEventListener("load", () => document.getElementById("contact-fa").scrollIntoView());
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "childList") r.addedNodes.forEach(translateTree);
      else if (r.type === "characterData") translateText(r.target);
      else translateAttr(r.target, r.attributeName);
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
})();
document.documentElement.classList.remove("i18n-pending");

// Language switch (footer, login pages): remembers the choice and reloads.
document.querySelectorAll("[data-lang-switch]").forEach((button) => {
  button.textContent = LANG === "fa" ? "English" : "فارسی";
  button.lang = LANG === "fa" ? "en" : "fa";
  button.addEventListener("click", () => {
    local.set("lang", LANG === "fa" ? "en" : "fa");
    location.reload();
  });
});

// Accounts live in Supabase (project saufox-entertainment). This key is the
// public one meant for browsers; the database's row-level security decides
// what each member can read and change. The session is stored under
// "saufox.session", which the inline script in each page's <head> checks
// before first paint. Only pages that load js/vendor/supabase.js get a client.
const SUPABASE_URL = "https://gwyqkzhhnspfadqefmix.supabase.co";
const SUPABASE_KEY = "sb_publishable_IB06YrDhrsKJbVghWP-zzg_xDgB1mXN";
const timeout = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

const account = (() => {
  if (!window.supabase) return null;
  // Sessions from the pre-Supabase demo were a bare email address.
  const old = local.get("session");
  if (old && !old.startsWith("{")) local.set("session", null);
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      // "implicit": links in emails work on whichever device opens them.
    auth: { storageKey: "saufox.session", flowType: "implicit" },
      // Give up after 20 seconds so a stalled connection shows an error
      // instead of leaving the page waiting.
    global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal || timeout(20000) }) },
  });
})();

// The catalogue lives in Supabase (table works), managed on admin.html.
// Pages read the published works with one plain request, so the home page
// doesn't need the Supabase library. The last copy is kept in this browser
// and used if the request fails.
// Prices in each currency: the work's own where the admin gave one,
// otherwise worked out from its Rial price at the rates set in the admin
// panel (shown with "≈").
const pricesOf = (row, rates) => {
  const prices = { USD: row.price_usd, EUR: row.price_eur, IRR: row.price_irr };
  const approx = {};
  [["USD", rates.usd_irr], ["EUR", rates.eur_irr]].forEach(([code, rate]) => {
    if (prices[code] == null && row.price_irr != null && rate) {
      prices[code] = Math.round((row.price_irr / rate) * 100) / 100;
      approx[code] = true;
    }
  });
  return { prices, approx };
};

const toWork = (row, rates = {}) => ({
  ...pricesOf(row, rates),
  id: row.id,
  title: row.title,
  kind: row.kind,
  status: row.status,
  statusText: (LANG === "fa" && row.status_text_fa) || row.status_text || "",
  images: [row.cover_url || row.hero_url].filter(Boolean),
  hero: row.hero_url || "",
  heroFocus: row.hero_focus || "",
  stills: row.stills || [],
  trailerDate: row.trailer_date,
  trailer: row.trailer || "",
  synopsis: (LANG === "fa" && row.synopsis_fa) || row.synopsis || "",
  genres: row.genres || [],
  platforms: row.platforms || [],
  rating: row.rating || "",
  credits: row.credits || [],
});

const loadCatalog = async () => {
  const get = async (path) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY }, signal: timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  try {
    const [rows, settings] = await Promise.all([
      get("works?select=*&published=eq.true&order=sort.asc,created_at.asc"),
      get("site_settings?select=usd_irr,eur_irr&id=eq.1").catch(() => []),
    ]);
    const rates = settings[0] || {};
    local.set("catalog", JSON.stringify({ rows, rates }));
    return rows.map((row) => toWork(row, rates));
  } catch (e) {
    try {
      const saved = JSON.parse(local.get("catalog") || "{}");
      const rows = Array.isArray(saved) ? saved : saved.rows || [];
      return rows.map((row) => toWork(row, saved.rates || {}));
    } catch (e2) {
      return [];
    }
  }
};

// Started once, on the pages that show works.
const catalog = document.querySelector(".hero, .works, .title-page, .login-bg, .profile-page")
  ? loadCatalog()
  : Promise.resolve([]);

// The current session, if it came through an emailed code or Google. The
// database opens nothing to a session made from the password alone (a login
// that stopped before its code), so such a leftover is cleared here.
const passwordOnly = (session) => {
  try {
    const claims = JSON.parse(atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const methods = claims.amr || [];
    return methods.length > 0 && methods.every((m) => m.method === "password");
  } catch (e) {
    return false;
  }
};
const verifiedSession = async () => {
  if (!account) return null;
  const { session } = (await account.auth.getSession()).data;
  if (!session) return null;
  if (passwordOnly(session)) {
    await account.auth.signOut({ scope: "local" });
    return null;
  }
  return session;
};

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
    const chars = LANG === "fa" ? text.split(/(\s+)/).filter(Boolean) : Array.from(text);
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
// Works come from the catalogue (see loadCatalog).

(async function heroCollage() {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const CATALOG = await catalog;

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

// Section 4 — Work cards, rendered from the catalogue.

(async function workCards() {
  const section = document.querySelector(".works");
  const track = section && section.querySelector(".works__track");
  if (!track) return;
  const CATALOG = await catalog;

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
    const title = el("h2", "card__title", work.title);
    title.translate = false; // titles stay as they are
    caption.append(title, el("span", "card__kind", work.kind));
    media.append(...slides, caption);
    if (slides.length > 1) media.append(dots);

    const price = el("div", "card__price");
    const priceTrack = el("div", "card__price-track");
    // Only the currencies the work is sold in.
    const codes = CURRENCIES.filter((code) => work.prices && work.prices[code] != null);
    const amounts = codes.length
      ? codes.map((code, i) => el("span", "card__amount" + (i === 0 ? " is-active" : ""), priceText(work, code)))
      : [el("span", "card__amount is-active", "To be announced")];
    priceTrack.append(...amounts);
    price.append(el("span", "card__price-label", "Price"), priceTrack);

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
  // Only currencies some work can show get a button; with one or none the
  // row goes. A member who picked a currency in Settings sees prices in it
  // and no buttons (they change it in Settings).
  const available = CURRENCIES.filter((code) => CATALOG.some((w) => w.prices[code] != null));
  const controls = section.querySelector(".works__controls");
  const choose = (next, remember) => {
    mode = next;
    currencyButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.currency === mode)));
    if (mode !== "auto") cards.forEach((c) => c.pinCurrency(mode));
    document.dispatchEvent(new CustomEvent("currencymode", { detail: mode }));
    if (remember) local.set("currencyPick", mode);
  };
  currencyButtons.forEach((button) => {
    const code = button.dataset.currency;
    button.hidden = code === "auto" ? available.length < 2 : !available.includes(code);
    button.addEventListener("click", () => choose(code, true));
  });

  const memberChoice = document.documentElement.dataset.auth === "member" ? local.get("currency") : null;
  if (memberChoice && memberChoice !== "auto" && available.includes(memberChoice)) {
    controls.hidden = true;
    setTimeout(() => choose(memberChoice, false));
  } else {
    controls.hidden = available.length < 2;
    const pick = local.get("currencyPick");
    if (pick && pick !== "auto" && available.includes(pick)) setTimeout(() => choose(pick, false));
    else if (available.length === 1) setTimeout(() => choose(available[0], false));
  }

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
  if (work.images[0]) {
    const img = document.createElement("img");
    img.src = work.images[0];
    img.alt = "";
    img.loading = "lazy";
    img.draggable = false;
    frame.append(img);
  }
  const title = document.createElement("span");
  title.className = "poster-card__title";
  title.translate = false;
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
(async function shelves() {
  const section = document.querySelector(".shelves");
  if (!section) return;
  const CATALOG = await catalog;

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
  const tickers = boxes.map((box) => {
    const items = CODES.map((code, i) => {
      const span = document.createElement("span");
      span.className = "card__amount" + (i === 0 ? " is-active" : "");
      span.textContent = money[code](Number(box.dataset[code.toLowerCase()]));
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

// Login and new-password pages — background strips and art layers, from
// the catalogue's artwork.
(function loginBackground() {
  const bg = document.querySelector(".login-bg");
  if (!bg) return;

  catalog.then((works) => {
    const images = [...new Set(works.flatMap((w) => [...w.stills, ...w.images, w.hero]).filter(Boolean))];
    if (!images.length) return;
    const shuffled = images.sort(() => Math.random() - 0.5);
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
    document.querySelectorAll(".auth__band").forEach((band, i) => {
      band.style.backgroundImage = `url("${pick(count + i)}")`;
    });
    const corner = document.querySelector(".auth__art");
    if (corner) corner.style.backgroundImage = `url("${pick(count + 3)}")`;
  });
})();

// Show / hide password, wherever there's a password field.
document.querySelectorAll(".field__reveal").forEach((button) => {
  const input = button.parentElement.querySelector("input");
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    input.focus();
  });
});

// Messages for Supabase Auth errors, shared by the login and new-password
// pages.
const AUTH_ERRORS = {
  invalid_credentials: "That email and password don't match. Check them and try again.",
  email_not_confirmed: "Confirm your email first: open the link we sent you, then log in.",
  user_already_exists: "There's already an account with this email. Log in instead.",
  weak_password: "Choose a stronger password, one that isn't easy to guess.",
  same_password: "Choose a password different from your old one.",
  otp_expired: "That code is wrong or has expired. Check it, or send a new one.",
  otp_disabled: "Codes aren't switched on yet. Try again later.",
  over_request_rate_limit: "Too many tries. Wait a minute and try again.",
  over_email_send_rate_limit: "Too many emails sent. Wait a while and try again.",
};
const explainAuthError = (error) =>
  AUTH_ERRORS[error.code] ||
  (error.status ? error.message : "Couldn't reach the server. Check your connection and try again.");

// Checks a form's fields; returns what to fix, or "".
const formProblem = (form) => {
  for (const input of form.querySelectorAll("input")) {
    if (input.validity.valid || input.closest("[hidden]")) continue;
    const name = input.closest(".field").querySelector(".field__label").textContent;
    input.focus();
    if (input.validity.valueMissing) return `Enter your ${name.toLowerCase()}.`;
    if (input.validity.typeMismatch) return "Enter an email address like name@example.com.";
    if (input.name === "code") return "Enter the 6-digit code from the email.";
    if (input.validity.tooShort) return `Use at least ${input.minLength} characters for your password.`;
    return `Check your ${name.toLowerCase()}.`;
  }
  return "";
};

// Remembers the member here and goes to the home page.
const signedInGoHome = async (user) => {
  local.set("hasAccount", "1");
  cacheProfile(await fetchProfile(user));
  setTimeout(() => (location.href = "index.html"), 700);
};

// Login page — Login / Sign Up tabs with sliding forms, a 6-digit code sent
// by email after sign-up and after the password at every login, "Forgot
// password?" by code, and Google sign-in. The database only opens an
// account to sessions that came through a code (or Google), so the code
// step can't be skipped. Accounts go through Supabase (see `account`).
(function loginPage() {
  const auth = document.querySelector(".auth");
  if (!auth || !auth.querySelector("#tab-login")) return;

  // Tabs and sliding forms. The login slide shows one panel at a time:
  // the login form, the forgot-password form or the code form.
  const tabs = { login: auth.querySelector("#tab-login"), signup: auth.querySelector("#tab-signup") };
  const slides = { login: auth.querySelector("#slide-login"), signup: auth.querySelector("#form-signup") };
  const forms = {
    login: auth.querySelector("#form-login"),
    signup: auth.querySelector("#form-signup"),
    reset: auth.querySelector("#form-reset"),
    code: auth.querySelector("#form-code"),
  };
  const viewport = auth.querySelector(".auth__viewport");
  let mode = location.hash === "#signup" ? "signup" : "login";
  let panel = location.hash === "#reset" ? "reset" : "login";

  const activeForm = () => (mode === "signup" ? forms.signup : forms[panel]);
  const fitHeight = () => (viewport.style.height = `${activeForm().offsetHeight}px`);

  const setMode = (next) => {
    mode = next;
    auth.dataset.mode = mode;
    Object.keys(tabs).forEach((key) => {
      tabs[key].setAttribute("aria-selected", String(key === mode));
      slides[key].inert = key !== mode;
    });
    fitHeight();
    // Leave the hash alone while it carries a sign-in from Google.
    if (!location.hash || ["#signup", "#reset"].includes(location.hash))
      history.replaceState(null, "", mode === "signup" ? "#signup" : location.pathname + location.search);
  };

  const showPanel = (name, focus = true) => {
    panel = name;
    ["login", "reset", "code"].forEach((key) => (forms[key].hidden = key !== name));
    if (name !== "login") setMode("login");
    fitHeight();
    if (focus) forms[name].querySelector("input").focus();
  };

  Object.keys(tabs).forEach((key) =>
    tabs[key].addEventListener("click", () => {
      if (panel !== "login") showPanel("login", false);
      setMode(key);
    })
  );
  window.addEventListener("resize", fitHeight);
  auth.querySelector('[data-action="forgot"]').addEventListener("click", () => {
    forms.reset.querySelector("input").value = forms.login.querySelector('input[name="email"]').value;
    showPanel("reset");
  });
  auth.querySelector('[data-action="back-to-login"]').addEventListener("click", () => showPanel("login"));
  auth.querySelector('[data-action="code-back"]').addEventListener("click", () => showPanel("login"));
  showPanel(panel, false);
  setMode(mode);

  const say = (el, text, ok) => {
    el.textContent = text;
    el.classList.toggle("is-ok", Boolean(ok));
    fitHeight();
  };
  const messageOf = (form) => form.querySelector(".auth__message");
  const busy = (form, on) => (form.querySelector(".auth__submit").disabled = on);

  // ---------- The code step ----------
  // purpose: "signup" (confirming a new account), "login" (after the
  // password) or "recovery" (forgotten password, with a new one).
  let pending = null;
  let cooldown = 0;
  const resendButton = forms.code.querySelector('[data-action="resend"]');
  const codeInput = forms.code.querySelector("#code");
  const newPassword = forms.code.querySelector('[data-slot="new-password"]');

  const startCooldown = () => {
    let left = 60;
    clearInterval(cooldown);
    resendButton.disabled = true;
    resendButton.textContent = `Send a new code (${left})`;
    cooldown = setInterval(() => {
      left -= 1;
      resendButton.textContent = left > 0 ? `Send a new code (${left})` : "Send a new code";
      if (left <= 0) {
        clearInterval(cooldown);
        resendButton.disabled = false;
      }
    }, 1000);
  };

  const askForCode = (purpose, email) => {
    pending = { purpose, email };
    forms.code.querySelector('[data-slot="code-intro"]').textContent =
      purpose === "recovery"
        ? `We emailed a 6-digit code to ${email}. Enter it with your new password.`
        : `We emailed a 6-digit code to ${email}. Enter it to continue.`;
    newPassword.hidden = purpose !== "recovery";
    forms.code.querySelector(".auth__submit").textContent = purpose === "recovery" ? "Save new password" : "Verify";
    codeInput.value = "";
    forms.code.querySelector("#code-password").value = "";
    say(messageOf(forms.code), "");
    showPanel("code");
    startCooldown();
  };

  // Sends (or re-sends) the code for the current purpose.
  const sendCode = async (purpose, email) => {
    try {
      if (purpose === "signup") return await account.auth.resend({ type: "signup", email });
      if (purpose === "recovery") return await account.auth.resetPasswordForEmail(email);
      return await account.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    } catch (e) {
      return { error: {} };
    }
  };

  const sendFailed = (error) =>
    error && error.status >= 500
      ? "We couldn't send the email right now. Try again later, or contact us."
      : explainAuthError(error);

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/[^0-9۰-۹]/g, "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).slice(0, 6);
  });

  resendButton.addEventListener("click", async () => {
    if (!pending) return;
    resendButton.disabled = true;
    const { error } = await sendCode(pending.purpose, pending.email);
    if (error) {
      resendButton.disabled = false;
      return say(messageOf(forms.code), sendFailed(error));
    }
    say(messageOf(forms.code), "A new code is on its way.", true);
    startCooldown();
  });

  forms.code.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = forms.code;
    const invalid = formProblem(form);
    if (invalid) return say(messageOf(form), invalid);
    if (!pending) return showPanel("login");

    busy(form, true);
    say(messageOf(form), pending.purpose === "recovery" ? "Saving…" : "Checking the code…", true);
    const token = codeInput.value;
    let result;
    try {
      // A new account's code is checked as "signup"; older servers use "email".
      result = await account.auth.verifyOtp({
        email: pending.email,
        token,
        type: pending.purpose === "recovery" ? "recovery" : pending.purpose === "signup" ? "signup" : "email",
      });
      if (result.error && pending.purpose === "signup")
        result = await account.auth.verifyOtp({ email: pending.email, token, type: "email" });
      if (!result.error && pending.purpose === "recovery")
        result = { ...result, ...(await account.auth.updateUser({ password: form.querySelector("#code-password").value })) };
    } catch (e) {
      result = { error: {} };
    }
    const { data, error } = result;
    if (error) {
      busy(form, false);
      return say(messageOf(form), explainAuthError(error));
    }
    clearInterval(cooldown);
    const text = {
      signup: "Account created. Taking you home…",
      login: "Welcome back. Taking you home…",
      recovery: "Password changed. Taking you home…",
    }[pending.purpose];
    say(messageOf(form), text, true);
    signedInGoHome(data.user || (data.session && data.session.user));
  });

  // ---------- Login: password, then a code ----------
  forms.login.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = forms.login;
    const invalid = formProblem(form);
    if (invalid) return say(messageOf(form), invalid);
    if (!account) return say(messageOf(form), "Accounts aren't available right now. Try again later.");

    const email = form.querySelector('input[name="email"]').value.trim();
    const password = form.querySelector('input[name="password"]').value;
    busy(form, true);
    say(messageOf(form), "Logging in…", true);
    let result;
    try {
      result = await account.auth.signInWithPassword({ email, password });
    } catch (e) {
      result = { error: {} };
    }

    // A new account that never entered its code: send a fresh one.
    if (result.error && result.error.code === "email_not_confirmed") {
      const sent = await sendCode("signup", email);
      busy(form, false);
      if (sent.error) return say(messageOf(form), sendFailed(sent.error));
      return askForCode("signup", email);
    }
    if (result.error) {
      busy(form, false);
      return say(messageOf(form), explainAuthError(result.error));
    }

    // The password was right. That session opens nothing on its own (see
    // above), so drop it and ask for the emailed code.
    await account.auth.signOut({ scope: "local" });
    const sent = await sendCode("login", email);
    busy(form, false);
    if (sent.error) return say(messageOf(form), sendFailed(sent.error));
    say(messageOf(form), "");
    askForCode("login", email);
  });

  // ---------- Sign up: then a code ----------
  forms.signup.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = forms.signup;
    const invalid = formProblem(form);
    if (invalid) return say(messageOf(form), invalid);
    if (!account) return say(messageOf(form), "Accounts aren't available right now. Try again later.");

    const email = form.querySelector('input[name="email"]').value.trim();
    busy(form, true);
    say(messageOf(form), "Creating your account…", true);
    let result;
    try {
      result = await account.auth.signUp({
        email,
        password: form.querySelector('input[name="password"]').value,
        options: { data: { name: form.querySelector('input[name="name"]').value.trim() } },
      });
    } catch (e) {
      result = { error: {} };
    }
    busy(form, false);
    const { data, error } = result;
    if (error) return say(messageOf(form), error.status >= 500 ? sendFailed(error) : explainAuthError(error));
    // An email that already has an account comes back with no identities.
    if (data.user && data.user.identities && !data.user.identities.length)
      return say(messageOf(form), AUTH_ERRORS.user_already_exists);
    local.set("hasAccount", "1");
    say(messageOf(form), "");
    askForCode("signup", email);
  });

  // ---------- Forgot password: a code, then a new password ----------
  forms.reset.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = forms.reset;
    const invalid = formProblem(form);
    if (invalid) return say(messageOf(form), invalid);
    if (!account) return say(messageOf(form), "Accounts aren't available right now. Try again later.");

    const email = form.querySelector("input").value.trim();
    busy(form, true);
    say(messageOf(form), "Sending…", true);
    const { error } = await sendCode("recovery", email);
    busy(form, false);
    // The reply is the same whether or not there's an account, so the form
    // can't be used to find out who has one.
    if (error && (!error.status || error.status >= 500 || (error.code || "").startsWith("over_")))
      return say(messageOf(form), sendFailed(error));
    say(messageOf(form), "");
    askForCode("recovery", email);
  });

  // ---------- Coming back from Google (or already signed in) ----------
  const socialMessage = auth.querySelector(".auth__message--social");
  const returned = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  if (returned.get("error_description"))
    say(socialMessage, "Signing in with Google didn't finish. Try again, or use your email.");
  verifiedSession().then((session) => {
    if (!session) return;
    say(messageOf(forms.login), "You're signed in. Taking you home…", true);
    signedInGoHome(session.user);
  });

  // Google sign-in, once it's switched on in Supabase (Authentication →
  // Sign In / Providers → Google). Until then the button says so.
  const providers = fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY }, signal: timeout(10000) })
    .then((res) => (res.ok ? res.json() : {}))
    .then((settings) => settings.external || {})
    .catch(() => ({}));

  // Google's own button, on this site: Google shows saufoxentertainment.ir
  // (not the Supabase address), signs in in a small window and hands back
  // a signed token that Supabase checks. If Google's script doesn't load,
  // the plain button below stays and signs in the old way (a redirect).
  const GOOGLE_CLIENT_ID = "514760919689-jq63kmblt3icbfeorg3mhf9scg4g0i22.apps.googleusercontent.com";
  (async function googleOnSite() {
    const fallback = auth.querySelector('.social[data-provider="Google"]');
    if (!account || !fallback || !window.crypto || !crypto.subtle) return;
    const loaded = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      setTimeout(reject, 8000);
      document.head.append(script);
    });
    try {
      await loaded;
    } catch (e) {
      return;
    }
    const gsi = window.google && google.accounts && google.accounts.id;
    if (!gsi) return;

    // Google puts the hash of this one-time value in the token; Supabase
    // checks it against the value itself, so a token can't be replayed.
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    const hashed = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce))), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

    gsi.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashed,
      ux_mode: "popup",
      use_fedcm_for_button: true,
      callback: async ({ credential }) => {
        say(socialMessage, "Signing in…", true);
        let result;
        try {
          result = await account.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
        } catch (e) {
          result = { error: {} };
        }
        if (result.error) return say(socialMessage, "Signing in with Google didn't finish. Try again, or use your email.");
        say(socialMessage, "You're signed in. Taking you home…", true);
        signedInGoHome(result.data.user);
      },
    });

    // Our own button stays in view; Google's, drawn the same size, sits on
    // top of it almost invisibly and takes the click.
    const wrap = document.createElement("div");
    wrap.className = "social-wrap";
    fallback.before(wrap);
    wrap.append(fallback);
    const slot = document.createElement("div");
    slot.className = "social-wrap__google";
    wrap.append(slot);
    gsi.renderButton(slot, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      shape: "rectangular",
      text: "continue_with",
      logo_alignment: "center",
      locale: LANG,
      width: Math.max(200, Math.min(400, Math.round(fallback.offsetWidth))),
    });
    fallback.tabIndex = -1; // Google's button takes the focus instead
  })();

  auth.querySelectorAll(".social[data-provider]").forEach((button) =>
    button.addEventListener("click", async () => {
      const provider = button.dataset.provider;
      const id = provider.toLowerCase();
      if (!account || !(await providers)[id])
        return say(socialMessage, `${provider} sign-in isn't connected yet. Use your email for now.`);
      say(socialMessage, `Opening ${provider}…`, true);
      const { error } = await account.auth.signInWithOAuth({
        provider: id,
        options: { redirectTo: new URL("login.html", location.href).href },
      });
      if (error) say(socialMessage, `${provider} sign-in didn't start. Try again, or use your email.`);
    })
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
    const CATALOG = await catalog;
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
  const session = await verifiedSession();
  if (!session) {
    local.set("session", null);
    location.replace("login.html");
    return;
  }
  const user = session.user;
  const fallbackName = (user.email || "").split("@")[0] || "SauFox fan";

  page.querySelector('[data-profile="email"]').textContent = user.email;
  page.querySelector('[data-profile="since"]').textContent = dateText(user.created_at, { month: "long", year: "numeric" });

  showMyList(user.id);
  // Admins get a way into the admin panel.
  account
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()
    .then(({ data }) => {
      if (!data) return;
      const link = document.createElement("a");
      link.href = "admin.html";
      link.textContent = "Manage works";
      page.querySelector(".profile-head__plan").append(link);
    });
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

// Title page (work.html?id=<id>) — one page per work in the catalogue: key art,
// name, poster, facts, trailer and buy actions, a countdown to the trailer,
// synopsis, gallery and credits. Sections without data stay hidden.
(async function titlePage() {
  const page = document.querySelector(".title-page");
  if (!page) return;
  const CATALOG = await catalog;

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
  if (work.images[0]) {
    poster.src = work.images[0];
    poster.alt = `${work.title} poster`;
  } else page.querySelector(".title-poster").hidden = true;

  // Facts
  const prices = work.prices ? Object.keys(money).filter((code) => work.prices[code] != null) : [];
  const facts = [
    ["Price", prices.map((code) => priceText(work, code)).join(" / ")],
    ["Genre", (work.genres || []).map(t).join(LANG === "fa" ? "، " : ", ")],
    ["Platforms", (work.platforms || []).join(LANG === "fa" ? "، " : ", ")],
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
      units.days.textContent = digits(Math.floor(s / 86400));
      units.hours.textContent = digits(String(Math.floor(s / 3600) % 24).padStart(2, "0"));
      units.minutes.textContent = digits(String(Math.floor(s / 60) % 60).padStart(2, "0"));
      units.seconds.textContent = digits(String(s % 60).padStart(2, "0"));
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
    const session = await verifiedSession();
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
    work.credits.forEach(({ role, name }) => {
      const row = make("div");
      const who = make("dd", "", name);
      who.translate = false;
      row.append(make("dt", "", role), who);
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
    const back = LANG === "fa" ? "ArrowRight" : "ArrowLeft";
    const forward = LANG === "fa" ? "ArrowLeft" : "ArrowRight";
    if (isStill && event.key === back) showStill(current - 1);
    if (isStill && event.key === forward) showStill(current + 1);
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

// Admin panel (admin.html) — add, edit, order, publish and delete works in
// the Supabase catalogue. Only accounts in the admins table get in, and the
// database refuses changes from anyone else anyway.
(async function adminPage() {
  const page = document.querySelector(".admin");
  if (!page) return;

  const gate = page.querySelector(".admin__gate");
  const listView = page.querySelector(".admin__list");
  const form = page.querySelector(".admin__editor");
  const message = form.querySelector(".admin-message");

  const session = await verifiedSession();
  if (!session) {
    local.set("session", null);
    location.replace("login.html");
    return;
  }
  const { data: adminRow, error: adminError } = await account
    .from("admins")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (adminError) {
    gate.textContent = "Couldn't reach the server. Check your connection and reload the page.";
    return;
  }
  if (!adminRow) {
    gate.textContent = "This page is for the studio's admins, and your account doesn't have access.";
    return;
  }
  gate.hidden = true;

  const STATUS = { released: "Released", preorder: "Pre-order", coming: "Coming soon", production: "In production" };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const photos = account.storage.from("works");

  let works = []; // every work, drafts too, in site order
  let editing = null; // the saved row being edited; null for a new work
  let images = { cover: "", hero: "" };
  let stills = [];
  let idTouched = false;

  const say = (text, ok) => {
    message.textContent = text;
    message.classList.toggle("is-ok", Boolean(ok));
  };

  // ---------- List ----------
  const listEl = page.querySelector(".admin-works");

  const renderList = () => {
    listEl.replaceChildren(
      ...works.map((work, i) => {
        const item = make("li", "admin-work");
        const thumb = make("span", "admin-work__thumb");
        if (work.cover_url || work.hero_url) {
          const img = make("img");
          img.src = work.cover_url || work.hero_url;
          img.alt = "";
          thumb.append(img);
        }
        const text = make("span", "admin-work__text");
        text.append(
          make("strong", "", work.title),
          make("span", "", `${work.kind} · ${work.status_text || STATUS[work.status]}`)
        );
        const badge = make("span", `admin-badge${work.published ? " is-on" : ""}`, work.published ? "Published" : "Draft");
        const tools = make("span", "admin-work__tools");
        const up = make("button", "admin-icon", "↑");
        up.type = "button";
        up.setAttribute("aria-label", `Move ${work.title} up`);
        up.disabled = i === 0;
        up.addEventListener("click", () => move(i, -1));
        const down = make("button", "admin-icon", "↓");
        down.type = "button";
        down.setAttribute("aria-label", `Move ${work.title} down`);
        down.disabled = i === works.length - 1;
        down.addEventListener("click", () => move(i, 1));
        const edit = make("button", "admin-button", "Edit");
        edit.type = "button";
        edit.addEventListener("click", () => showEditor(work));
        tools.append(up, down, edit);
        item.append(thumb, text, badge, tools);
        return item;
      })
    );
    page.querySelector(".admin__empty").hidden = works.length > 0;
  };

  const loadWorks = async () => {
    const { data, error } = await account.from("works").select("*").order("sort").order("created_at");
    if (error) {
      listEl.replaceChildren(make("li", "admin__hint", "Couldn't load the works. Reload the page to try again."));
      return;
    }
    works = data;
    renderList();
  };

  // Order is the list's order: after a move, every row gets its position.
  const move = async (i, step) => {
    const next = works.slice();
    [next[i], next[i + step]] = [next[i + step], next[i]];
    const changed = next.map((work, sort) => ({ work, sort })).filter(({ work, sort }) => work.sort !== sort);
    listEl.classList.add("is-busy");
    const results = await Promise.all(
      changed.map(({ work, sort }) => account.from("works").update({ sort }).eq("id", work.id))
    );
    listEl.classList.remove("is-busy");
    if (results.some((r) => r.error)) return loadWorks();
    changed.forEach(({ work, sort }) => (work.sort = sort));
    works = next;
    renderList();
  };

  const showList = () => {
    form.hidden = true;
    listView.hidden = false;
    window.scrollTo(0, 0);
    loadWorks();
  };

  // ---------- Editor ----------
  const $ = (id) => form.querySelector(`#${id}`);
  const fields = {
    title: $("w-title"),
    id: $("w-id"),
    kind: $("w-kind"),
    status: $("w-status"),
    statusText: $("w-status-text"),
    statusTextFa: $("w-status-text-fa"),
    published: $("w-published"),
    irr: $("w-price-irr"),
    usd: $("w-price-usd"),
    eur: $("w-price-eur"),
    heroFocus: $("w-hero-focus"),
    trailerDate: $("w-trailer-date"),
    trailer: $("w-trailer"),
    synopsis: $("w-synopsis"),
    synopsisFa: $("w-synopsis-fa"),
    genres: $("w-genres"),
    platforms: $("w-platforms"),
    rating: $("w-rating"),
  };
  const deleteButton = form.querySelector('[data-action="delete"]');
  const viewLink = form.querySelector('[data-slot="view-link"]');
  const creditsEl = form.querySelector(".admin-credits");
  const stillsEl = form.querySelector(".admin-stills__list");

  const slug = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "");
  const validId = (id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);

  // Iran keeps +03:30 all year, so the date field is read as Tehran time.
  const toLocalInput = (iso) =>
    iso ? new Date(new Date(iso).getTime() + 3.5 * 3600e3).toISOString().slice(0, 16) : "";
  const fromLocalInput = (value) => (value ? `${value}:00+03:30` : null);

  // Accepts an Aparat link (aparat.com/v/ID or an embed link) or the bare ID.
  const aparatId = (text) => {
    const value = text.trim();
    if (!value) return "";
    const match = value.match(/aparat\.com\/(?:v|video\/video\/embed\/videohash)\/([A-Za-z0-9]+)/);
    if (match) return match[1];
    return /^[A-Za-z0-9]{3,40}$/.test(value) ? value : null;
  };
  const list = (text) =>
    text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const number = (input) => (input.value.trim() === "" ? null : Number(input.value));

  const renderImages = () => {
    form.querySelectorAll("[data-image]").forEach((slot) => {
      const src = images[slot.dataset.image];
      const img = slot.querySelector("img");
      img.hidden = !src;
      if (src) img.src = src;
      slot.querySelector('[data-action="clear"]').hidden = !src;
    });
  };

  const renderStills = () => {
    stillsEl.replaceChildren(
      ...stills.map((src, i) => {
        const item = make("li", "admin-still");
        const img = make("img");
        img.src = src;
        img.alt = `Gallery image ${i + 1}`;
        const tools = make("span", "admin-still__tools");
        const earlier = make("button", "admin-icon", "←");
        earlier.type = "button";
        earlier.setAttribute("aria-label", `Move image ${i + 1} earlier`);
        earlier.disabled = i === 0;
        earlier.addEventListener("click", () => {
          [stills[i - 1], stills[i]] = [stills[i], stills[i - 1]];
          renderStills();
        });
        const remove = make("button", "admin-icon", "✕");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove image ${i + 1}`);
        remove.addEventListener("click", () => {
          stills.splice(i, 1);
          renderStills();
        });
        tools.append(earlier, remove);
        item.append(img, tools);
        return item;
      })
    );
  };

  const addCredit = (role = "", name = "") => {
    const item = make("li", "admin-credit");
    const roleInput = make("input");
    roleInput.type = "text";
    roleInput.placeholder = "Role, e.g. Director";
    roleInput.value = role;
    roleInput.maxLength = 60;
    roleInput.setAttribute("aria-label", "Role");
    const nameInput = make("input");
    nameInput.type = "text";
    nameInput.placeholder = "Name";
    nameInput.value = name;
    nameInput.maxLength = 80;
    nameInput.setAttribute("aria-label", "Name");
    const remove = make("button", "admin-icon", "✕");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove this credit");
    remove.addEventListener("click", () => item.remove());
    item.append(roleInput, nameInput, remove);
    creditsEl.append(item);
    return roleInput;
  };

  const showEditor = (row) => {
    editing = row || null;
    const w = row || {};
    form.reset();
    say("");
    idTouched = Boolean(row);
    form.querySelector('[data-slot="editor-title"]').textContent = row ? row.title : "New work";
    fields.title.value = w.title || "";
    fields.id.value = w.id || "";
    fields.id.readOnly = Boolean(row);
    fields.kind.value = w.kind || "";
    fields.status.value = w.status || "coming";
    fields.statusText.value = w.status_text || "";
    fields.statusTextFa.value = w.status_text_fa || "";
    fields.published.checked = Boolean(w.published);
    fields.irr.value = w.price_irr ?? "";
    fields.usd.value = w.price_usd ?? "";
    fields.eur.value = w.price_eur ?? "";
    const focus = w.hero_focus || "";
    if (![...fields.heroFocus.options].some((o) => o.value === focus)) fields.heroFocus.append(new Option(focus, focus));
    fields.heroFocus.value = focus;
    fields.trailerDate.value = toLocalInput(w.trailer_date);
    fields.trailer.value = w.trailer ? `https://www.aparat.com/v/${w.trailer}` : "";
    fields.synopsis.value = w.synopsis || "";
    fields.synopsisFa.value = w.synopsis_fa || "";
    fields.genres.value = (w.genres || []).join(", ");
    fields.platforms.value = (w.platforms || []).join(", ");
    fields.rating.value = w.rating || "";
    images = { cover: w.cover_url || "", hero: w.hero_url || "" };
    stills = (w.stills || []).slice();
    creditsEl.replaceChildren();
    (w.credits || []).forEach((c) => addCredit(c.role, c.name));
    renderImages();
    renderStills();
    deleteButton.hidden = !row;
    resetDelete();
    viewLink.hidden = !(row && row.published);
    if (row) viewLink.href = `work.html?id=${encodeURIComponent(row.id)}`;
    listView.hidden = true;
    form.hidden = false;
    window.scrollTo(0, 0);
    if (!row) fields.title.focus();
  };

  fields.title.addEventListener("input", () => {
    if (!editing && !idTouched) fields.id.value = slug(fields.title.value);
  });
  fields.id.addEventListener("input", () => {
    idTouched = true;
  });

  // Images are shrunk in the browser and saved as WebP, then uploaded at
  // once to works/<id>/…; the work itself changes on Save.
  const MAX_WIDTH = { cover: 900, hero: 1920, still: 1600 };
  const upload = async (file, kind) => {
    const id = fields.id.value.trim();
    if (!validId(id)) throw new Error("Give the work a title and page address before adding images.");
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file: JPG, PNG or WebP.");
    const bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image couldn't be opened. Try another file."));
      img.src = URL.createObjectURL(file);
    });
    const scale = Math.min(1, MAX_WIDTH[kind] / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(bitmap.src);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    const path = `${id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
    const { error } = await photos.upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
    if (error) throw new Error("The image didn't upload. Check your connection and try again.");
    return photos.getPublicUrl(path).data.publicUrl;
  };

  form.querySelectorAll("[data-image]").forEach((slot) => {
    const kind = slot.dataset.image;
    const input = slot.querySelector('input[type="file"]');
    input.addEventListener("change", async () => {
      const file = input.files[0];
      input.value = "";
      if (!file) return;
      say("Uploading…", true);
      try {
        images[kind] = await upload(file, kind);
        renderImages();
        say("Image added. Save to keep it.", true);
      } catch (e) {
        say(e.message);
      }
    });
    slot.querySelector('[data-action="clear"]').addEventListener("click", () => {
      images[kind] = "";
      renderImages();
    });
  });

  const stillsInput = form.querySelector("#w-stills-input");
  stillsInput.addEventListener("change", async () => {
    const files = [...stillsInput.files];
    stillsInput.value = "";
    for (const [i, file] of files.entries()) {
      say(`Uploading ${i + 1} of ${files.length}…`, true);
      try {
        stills.push(await upload(file, "still"));
        renderStills();
      } catch (e) {
        return say(e.message);
      }
    }
    say(files.length > 1 ? "Images added. Save to keep them." : "Image added. Save to keep it.", true);
  });

  form.querySelector('[data-action="add-credit"]').addEventListener("click", () => addCredit().focus());
  form.querySelector('[data-action="back"]').addEventListener("click", showList);
  page.querySelector('[data-action="new"]').addEventListener("click", () => showEditor(null));

  // ---------- Save ----------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = fields.title.value.trim();
    const id = fields.id.value.trim();
    const kind = fields.kind.value.trim();
    const trailer = aparatId(fields.trailer.value);
    const problem =
      (!title && [fields.title, "Enter a title."]) ||
      (!validId(id) && [fields.id, "Use lowercase letters, numbers and dashes for the page address, e.g. the-candlewood."]) ||
      (!kind && [fields.kind, "Enter the type of work, e.g. Game."]) ||
      (trailer === null && [fields.trailer, "Paste the Aparat link, like https://www.aparat.com/v/abc123."]) ||
      ([fields.irr, fields.usd, fields.eur].find((f) => f.value && !(Number(f.value) >= 0)) && [fields.irr, "Prices must be numbers of 0 or more."]);
    if (problem) {
      problem[0].focus();
      return say(problem[1]);
    }

    const row = {
      title,
      kind,
      status: fields.status.value,
      status_text: fields.statusText.value.trim() || null,
      status_text_fa: fields.statusTextFa.value.trim() || null,
      published: fields.published.checked,
      price_irr: number(fields.irr),
      price_usd: number(fields.usd),
      price_eur: number(fields.eur),
      cover_url: images.cover || null,
      hero_url: images.hero || null,
      hero_focus: fields.heroFocus.value || null,
      stills,
      trailer_date: fromLocalInput(fields.trailerDate.value),
      trailer: trailer || null,
      synopsis: fields.synopsis.value.trim() || null,
      synopsis_fa: fields.synopsisFa.value.trim() || null,
      genres: list(fields.genres.value),
      platforms: list(fields.platforms.value),
      rating: fields.rating.value.trim() || null,
      credits: [...creditsEl.children]
        .map((item) => {
          const [role, name] = item.querySelectorAll("input");
          return { role: role.value.trim(), name: name.value.trim() };
        })
        .filter((c) => c.role && c.name),
      updated_at: new Date().toISOString(),
    };

    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    say("Saving…", true);
    const result = editing
      ? await account.from("works").update(row).eq("id", editing.id).select().single()
      : await account
          .from("works")
          .insert({ ...row, id, sort: works.reduce((max, w) => Math.max(max, w.sort + 1), 0) })
          .select()
          .single();
    submit.disabled = false;

    if (result.error) {
      if (result.error.code === "23505") {
        fields.id.focus();
        return say("Another work already uses this page address. Choose a different one.");
      }
      return say("The work wasn't saved. Check your connection and try again.");
    }
    showEditor(result.data);
    say(row.published ? "Saved. It's live on the site." : "Saved as a draft.", true);
  });

  // ---------- Delete (press twice) ----------
  let armed = 0;
  const resetDelete = () => {
    clearTimeout(armed);
    armed = 0;
    deleteButton.textContent = "Delete work";
  };
  deleteButton.addEventListener("click", async () => {
    if (!editing) return;
    if (!armed) {
      deleteButton.textContent = "Press again to delete";
      armed = setTimeout(resetDelete, 4000);
      return;
    }
    resetDelete();
    deleteButton.disabled = true;
    say("Deleting…", true);
    const { error } = await account.from("works").delete().eq("id", editing.id);
    deleteButton.disabled = false;
    if (error) return say("The work wasn't deleted. Check your connection and try again.");
    // Its uploaded images go too.
    const { data: files } = await photos.list(editing.id, { limit: 1000 });
    if (files && files.length) await photos.remove(files.map((f) => `${editing.id}/${f.name}`));
    showList();
  });

  // ---------- Exchange rates ----------
  const ratesForm = page.querySelector(".admin-rates");
  const ratesMessage = ratesForm.querySelector(".admin-message");
  const rateUsd = ratesForm.querySelector("#rate-usd");
  const rateEur = ratesForm.querySelector("#rate-eur");
  account
    .from("site_settings")
    .select("usd_irr, eur_irr")
    .eq("id", 1)
    .maybeSingle()
    .then(({ data }) => {
      if (!data) return;
      rateUsd.value = data.usd_irr ?? "";
      rateEur.value = data.eur_irr ?? "";
    });
  ratesForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const usd = number(rateUsd);
    const eur = number(rateEur);
    if ([usd, eur].some((n) => n !== null && !(n > 0))) {
      ratesMessage.classList.remove("is-ok");
      ratesMessage.textContent = "Rates must be numbers above 0, or empty.";
      return;
    }
    ratesMessage.classList.add("is-ok");
    ratesMessage.textContent = "Saving…";
    const { error } = await account
      .from("site_settings")
      .update({ usd_irr: usd, eur_irr: eur, updated_at: new Date().toISOString() })
      .eq("id", 1);
    ratesMessage.classList.toggle("is-ok", !error);
    ratesMessage.textContent = error ? "The rates weren't saved. Check your connection and try again." : "Saved. Prices on the site use the new rates.";
  });

  showList();
})();
