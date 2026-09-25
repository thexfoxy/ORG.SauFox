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
  // The Persian text pages have their own headings (#contact -> #contact-fa).
  const twin = /^#[\w-]+$/.test(location.hash) && document.getElementById(`${location.hash.slice(1)}-fa`);
  if (twin) addEventListener("load", () => twin.scrollIntoView());
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

// A sign-in link from an email (older templates) lands on the site's home
// page with the session in the address; the login page picks it up.
if (!document.querySelector(".auth") && /(^#|&)(access_token|error_code)=/.test(location.hash))
  location.replace(`login.html${location.hash}`);

// Accounts live in Supabase (project saufox-entertainment). This key is the
// public one meant for browsers; the database's row-level security decides
// what each member can read and change. The session is stored under
// "saufox.session", which the inline script in each page's <head> checks
// before first paint. Only pages that load js/vendor/supabase.js get a client.
const SUPABASE_URL = "https://gwyqkzhhnspfadqefmix.supabase.co";
const SUPABASE_KEY = "sb_publishable_IB06YrDhrsKJbVghWP-zzg_xDgB1mXN";
// Cloudflare Turnstile site key (public) for the login page's bot check.
// Empty: no captcha. Set it before turning CAPTCHA protection on in Supabase.
const TURNSTILE_SITE_KEY = "";
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

// Loads the published works and the site settings (exchange rates,
// maintenance). { works, settings, offline }: offline when the server
// can't be reached and there's no saved copy either.
const loadSite = async () => {
  const get = async (path) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY }, signal: timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  try {
    const [rows, settings] = await Promise.all([
      get("works?select=*&published=eq.true&order=sort.asc,created_at.asc"),
      get("site_settings?select=usd_irr,eur_irr,maintenance,maintenance_note,maintenance_note_fa,plan_basic_irr,plan_premium_irr,payments,sales_open&id=eq.1").catch(() => []),
    ]);
    const rates = settings[0] || {};
    local.set("catalog", JSON.stringify({ rows, rates }));
    return { works: rows.map((row) => toWork(row, rates)), settings: rates, offline: false };
  } catch (e) {
    try {
      const saved = JSON.parse(local.get("catalog") || "null");
      if (!saved) return { works: [], settings: {}, offline: true };
      const rows = Array.isArray(saved) ? saved : saved.rows || [];
      // A saved copy doesn't count as maintenance: that needs the server.
      const rates = { ...(saved.rates || {}), maintenance: false, payments: "off" };
      return { works: rows.map((row) => toWork(row, rates)), settings: rates, offline: false };
    } catch (e2) {
      return { works: [], settings: {}, offline: true };
    }
  }
};

// Started once, on the pages that show works.
const site = document.querySelector(".hero, .works, .plans, .title-page, .login-bg, .profile-page, .checkout")
  ? loadSite()
  : Promise.resolve({ works: [], settings: {}, offline: false });
const catalog = site.then((data) => data.works);

// Maintenance and outages, on the pages built from the catalogue: visitors
// go to the status page (which comes back here when the site is up).
// Admins see the site as usual, with a reminder bar.
(async function siteStatus() {
  if (!document.querySelector(".hero, .works, .title-page, .profile-page, .checkout")) return;
  const { settings, offline } = await site;
  const from = encodeURIComponent(location.pathname + location.search + location.hash);
  if (offline) return location.replace(`status.html?reason=offline&from=${from}`);
  if (!settings.maintenance) return;
  if (local.get("admin") !== "1") return location.replace(`status.html?reason=maintenance&from=${from}`);
  const bar = document.createElement("div");
  bar.className = "maintenance-bar";
  const text = document.createElement("span");
  text.textContent = "Maintenance mode is on. Visitors see the maintenance page.";
  const link = document.createElement("a");
  link.href = "admin.html";
  link.textContent = "Turn it off";
  bar.append(text, link);
  document.body.append(bar);
})();

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
  let answer;
  try {
    answer = await account.auth.getSession();
  } catch (e) {
    // A hiccup (network, storage): try once more before giving up.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    answer = await account.auth.getSession();
  }
  const { session } = answer.data;
  if (!session) return null;
  if (passwordOnly(session)) {
    await account.auth.signOut({ scope: "local" });
    return null;
  }
  return session;
};

// Sends a signed-out visitor to log in, then back to this page.
const goLogin = () => {
  local.set("next", location.pathname.split("/").pop() + location.search + location.hash);
  location.href = "login.html";
};

// Sales can be paused from the admin panel (to catch up on orders): no new
// orders or payments then, except for admins.
const salesPaused = (settings) => settings.sales_open === false && local.get("admin") !== "1";
const SALES_PAUSED = "Sales are paused for a little while. Please check back soon.";
// Online payment (Supabase Edge Function "payment", Zarinpal). Open when
// the admin panel sets it live, or in test mode for admins only.
const paymentsOpen = (settings) =>
  !salesPaused(settings) &&
  (settings.payments === "live" || (settings.payments === "test" && local.get("admin") === "1"));
const PAYMENT_ERRORS = {
  paused: "Sales are paused for a little while. Your order is saved; you can pay once they reopen.",
  closed: "Online payment isn't open yet. Your order is saved, and we'll email you when you can pay.",
  not_configured: "Online payment isn't open yet. Your order is saved, and we'll email you when you can pay.",
  gateway: "The bank gateway didn't answer. Try again in a moment.",
  not_payable: "This order can't be paid any more. See its status in your orders.",
  signed_out: "Your session has ended. Log in again to pay.",
};
const payment = async (body, session) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: timeout(30000),
    });
    return await res.json();
  } catch (e) {
    return { error: "network" };
  }
};
// Sends the member to the bank. Returns a message if that can't happen.
const payOrder = async (orderId) => {
  const session = await verifiedSession();
  if (!session) return PAYMENT_ERRORS.signed_out;
  const answer = await payment({ action: "start", order_id: orderId }, session);
  if (answer.url) {
    location.href = answer.url;
    return "";
  }
  return PAYMENT_ERRORS[answer.error] || "Couldn't reach the payment service. Check your connection and try again.";
};

// Mobile numbers typed with Persian or Arabic digits, spaces or dashes.
const cleanPhone = (text) =>
  text
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[\s().-]/g, "");

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
(async function planPrices() {
  const boxes = [...document.querySelectorAll(".plan__amounts")];
  if (!boxes.length) return;

  // Prices are set in Rials in the admin panel; dollars and euros follow
  // the exchange rates there (marked "≈").
  const { settings } = await site;
  const plans = boxes.map((box) => pricesOf({ price_irr: settings[`plan_${box.dataset.plan}_irr`] ?? null }, settings));
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const CODES = ["USD", "EUR", "IRR"].filter((code) => plans.every((plan) => plan.prices[code] != null));
  if (!CODES.length) {
    boxes.forEach((box) => (box.closest(".plan__price").hidden = true));
    return;
  }
  const tickers = boxes.map((box, b) =>
    CODES.map((code, i) => {
      const span = document.createElement("span");
      span.className = "card__amount" + (i === 0 ? " is-active" : "");
      span.textContent = priceText(plans[b], code);
      box.append(span);
      return span;
    })
  );

  let mode = "auto";
  let current = 0;
  // Each box is as wide as the price it shows, so "/ month" sits right after.
  const fit = () =>
    boxes.forEach((box, b) => (box.style.width = `${tickers[b][current].offsetWidth}px`));
  const show = (i) => {
    if (i === current || i < 0) return;
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
    if (document.hidden || calm.matches || mode !== "auto" || CODES.length < 2) return;
    show((current + 1) % CODES.length);
  }, 2600);

  // Members: subscriptions can't be bought yet, so no sign-up button.
  if (local.get("session"))
    document.querySelectorAll(".plan__button").forEach((button) => {
      button.removeAttribute("href");
      button.classList.add("is-soon");
      button.textContent = "Opens soon";
    });
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
  captcha_failed: "We couldn't check that you're not a robot. Reload the page and try again.",
  otp_disabled: "Codes aren't switched on yet. Try again later.",
  over_request_rate_limit: "Too many tries. Wait a minute and try again.",
  over_email_send_rate_limit: "Too many emails sent. Wait a while and try again.",
};
const explainAuthError = (error) =>
  // Passwords found in known data leaks (HaveIBeenPwned), when that check is on.
  (error.code === "weak_password" && (error.reasons || []).includes("pwned") ? LEAKED_PASSWORD : "") ||
  AUTH_ERRORS[error.code] ||
  (error.status ? error.message : "Couldn't reach the server. Check your connection and try again.");

// Whether a password is in a known data leak, from HaveIBeenPwned's free
// Pwned Passwords API (Supabase's own check needs its Pro plan). Only the
// first 5 characters of the password's SHA-1 leave the browser; the match
// happens here. If the check can't run, the password is let through.
const LEAKED_PASSWORD = "This password has shown up in a data leak elsewhere, so it isn't safe. Choose a different one.";
const leakedPassword = async (password) => {
  try {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password))), (b) =>
      b.toString(16).padStart(2, "0")
    )
      .join("")
      .toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: timeout(5000),
    });
    if (!res.ok) return false;
    const suffix = hash.slice(5);
    return (await res.text()).split("\n").some((line) => {
      const [rest, count] = line.trim().split(":");
      return rest === suffix && Number(count) > 0;
    });
  } catch (e) {
    return false;
  }
};

// Checks a form's fields; returns what to fix, or "".
const formProblem = (form) => {
  for (const input of form.querySelectorAll("input")) {
    if (input.validity.valid || input.closest("[hidden]")) continue;
    const name = input.closest(".field").querySelector(".field__label").textContent;
    input.focus();
    if (input.validity.valueMissing) return `Enter your ${name.toLowerCase()}.`;
    if (input.validity.typeMismatch) return "Enter an email address like name@example.com.";
    if (input.name === "code") return "Enter the code from the email.";
    if (input.validity.tooShort) return `Use at least ${input.minLength} characters for your password.`;
    return `Check your ${name.toLowerCase()}.`;
  }
  return "";
};

// Remembers the member here and goes to the home page, or back to the page
// that sent them to log in (see goLogin).
const signedInGoHome = async (user) => {
  local.set("hasAccount", "1");
  cacheProfile(await fetchProfile(user));
  const next = local.get("next");
  local.set("next", null);
  const target = next && /^[a-z0-9-]+\.html([?#][^\s]*)?$/i.test(next) ? next : "index.html";
  setTimeout(() => (location.href = target), 700);
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

  // Cloudflare Turnstile against bots, once TURNSTILE_SITE_KEY is set and
  // Supabase has CAPTCHA protection on with the matching secret key (Auth →
  // Attack Protection). Every sign-up, login, emailed code and reset asks
  // for a fresh token; the widget stays invisible unless Cloudflare wants
  // the visitor to tick a box. Rejects with Error("captcha") if it can't.
  const captcha = (() => {
    if (!TURNSTILE_SITE_KEY) return async () => undefined;
    const box = auth.querySelector(".auth__captcha");
    const ready = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      setTimeout(reject, 15000);
      document.head.append(script);
    });
    let widget;
    let waiting = null;
    const settle = (ok, value) => {
      if (!waiting) return;
      const { resolve, reject } = waiting;
      waiting = null;
      if (ok) resolve(value);
      else reject(new Error("captcha"));
    };
    return async () => {
      try {
        await ready;
      } catch (e) {
        throw new Error("captcha");
      }
      return new Promise((resolve, reject) => {
        settle(false);
        waiting = { resolve, reject };
        if (widget === undefined)
          widget = turnstile.render(box, {
            sitekey: TURNSTILE_SITE_KEY,
            execution: "execute",
            appearance: "interaction-only",
            theme: "dark",
            language: LANG,
            callback: (token) => settle(true, token),
            "error-callback": () => settle(false),
            "timeout-callback": () => settle(false),
          });
        else turnstile.reset(widget);
        turnstile.execute(widget);
        setTimeout(() => settle(false), 120000);
      });
    };
  })();

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
        ? `We emailed a code to ${email}. Enter it with your new password.`
        : `We emailed a code to ${email}. Enter it to continue.`;
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
    let captchaToken;
    try {
      captchaToken = await captcha();
    } catch (e) {
      return { error: { code: "captcha_failed" } };
    }
    try {
      if (purpose === "signup") return await account.auth.resend({ type: "signup", email, options: { captchaToken } });
      if (purpose === "recovery") return await account.auth.resetPasswordForEmail(email, { captchaToken });
      return await account.auth.signInWithOtp({ email, options: { shouldCreateUser: false, captchaToken } });
    } catch (e) {
      return { error: {} };
    }
  };

  const sendFailed = (error) =>
    error && error.status >= 500
      ? "We couldn't send the email right now. Try again later, or contact us."
      : explainAuthError(error);

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/[^0-9۰-۹]/g, "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).slice(0, 10);
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
    if (pending.purpose === "recovery" && (await leakedPassword(form.querySelector("#code-password").value))) {
      busy(form, false);
      form.querySelector("#code-password").focus();
      return say(messageOf(form), LEAKED_PASSWORD);
    }
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
      result = await account.auth.signInWithPassword({ email, password, options: { captchaToken: await captcha() } });
    } catch (e) {
      result = { error: e && e.message === "captcha" ? { code: "captcha_failed" } : {} };
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
    if (await leakedPassword(form.querySelector('input[name="password"]').value)) {
      busy(form, false);
      form.querySelector('input[name="password"]').focus();
      return say(messageOf(form), LEAKED_PASSWORD);
    }
    say(messageOf(form), "Creating your account…", true);
    let result;
    try {
      result = await account.auth.signUp({
        email,
        password: form.querySelector('input[name="password"]').value,
        options: { data: { name: form.querySelector('input[name="name"]').value.trim() }, captchaToken: await captcha() },
      });
    } catch (e) {
      result = { error: e && e.message === "captcha" ? { code: "captcha_failed" } : {} };
    }
    busy(form, false);
    const { data, error } = result;
    if (error) return say(messageOf(form), error.status >= 500 ? sendFailed(error) : explainAuthError(error));
    // An email that already has an account comes back with no identities.
    if (data.user && data.user.identities && !data.user.identities.length)
      return say(messageOf(form), AUTH_ERRORS.user_already_exists);
    local.set("hasAccount", "1");
    if (data.session) {
      // Email confirmation is off in Supabase: the account opened at once
      // and no email went out. Drop that session and send a login code.
      await account.auth.signOut({ scope: "local" });
      const sent = await sendCode("login", email);
      if (sent.error) return say(messageOf(form), sendFailed(sent.error));
      say(messageOf(form), "");
      return askForCode("login", email);
    }
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
    // Stretch Google's button over ours when ours is wider than 400px.
    const fit = () => {
      const drawn = slot.firstElementChild && slot.firstElementChild.offsetWidth;
      if (drawn) slot.style.setProperty("--sx", Math.max(1, fallback.offsetWidth / drawn).toFixed(3));
    };
    new ResizeObserver(fit).observe(wrap);
    setTimeout(fit, 1000);
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

  // ---------- Library: every work the member has paid for ----------
  // Released works are theirs now; pre-orders arrive on release day.
  const showLibrary = async (userId) => {
    const { data, error } = await account
      .from("orders")
      .select("work_id, test, paid_at")
      .eq("user_id", userId)
      .in("status", ["paid", "processing", "completed"])
      .order("paid_at", { ascending: false });
    if (error || !data.length) return;
    const works = await catalog;
    const cards = data
      .map((order) => {
        const work = works.find((w) => w.id === order.work_id);
        if (!work) return null;
        const card = posterCard(work);
        const note = document.createElement("span");
        note.className = "poster-card__note";
        note.textContent =
          (work.status === "released" ? "Yours" : "Pre-ordered · arrives on release day") + (order.test ? " · test" : "");
        card.append(note);
        return card;
      })
      .filter(Boolean);
    if (!cards.length) return;
    const grid = document.createElement("div");
    grid.className = "poster-grid";
    grid.append(...cards);
    document.getElementById("panel-library").replaceChildren(grid);
  };

  // ---------- Orders ----------
  const ORDER_STATUS = {
    awaiting_payment: "Awaiting payment",
    paid: "Paid",
    processing: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  let canPay = false;
  const orderRow = (order, works) => {
    const make = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };
    const work = works.find((w) => w.id === order.work_id);
    const row = make("li", "order");
    const thumb = make(work ? "a" : "span", "order__thumb");
    if (work) {
      thumb.href = `work.html?id=${encodeURIComponent(work.id)}`;
      thumb.setAttribute("aria-label", order.title);
      if (work.images[0]) {
        const img = make("img");
        img.src = work.images[0];
        img.alt = "";
        img.loading = "lazy";
        thumb.append(img);
      }
    }
    const text = make("div", "order__text");
    const title = make("strong", "", order.title);
    title.translate = false;
    text.append(title, make("span", "", `Order ${order.number} · ${dateText(order.created_at)}`));
    if (order.ref_id) text.append(make("span", "selectable", `Reference ${order.ref_id}`));
    const side = make("div", "order__side");
    const status = make("span", "order-status", ORDER_STATUS[order.status] || order.status);
    status.dataset.status = order.status;
    side.append(make("span", "order__amount", money.IRR(order.amount_irr)), status);
    if (order.status === "awaiting_payment" && canPay) {
      const pay = make("button", "order__pay", "Pay now");
      pay.type = "button";
      pay.addEventListener("click", async () => {
        pay.disabled = true;
        pay.textContent = "Taking you to the bank…";
        const problem = await payOrder(order.id);
        if (!problem) return;
        pay.disabled = false;
        pay.textContent = "Pay now";
        text.append(make("span", "order__problem", problem));
      });
      side.append(pay);
    }
    if (order.status === "awaiting_payment") {
      // Press twice: the first press asks.
      const cancel = make("button", "order__cancel", "Cancel order");
      cancel.type = "button";
      cancel.addEventListener("click", async () => {
        if (!cancel.classList.contains("is-asking")) {
          cancel.classList.add("is-asking");
          cancel.textContent = "Tap again to cancel";
          setTimeout(() => {
            cancel.classList.remove("is-asking");
            if (!cancel.disabled) cancel.textContent = "Cancel order";
          }, 4000);
          return;
        }
        cancel.disabled = true;
        const { data, error } = await account
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", order.id)
          .select("id, number, work_id, title, amount_irr, status, created_at, ref_id")
          .single();
        if (error) {
          cancel.disabled = false;
          cancel.classList.remove("is-asking");
          cancel.textContent = "Couldn't cancel. Try again";
          return;
        }
        row.replaceWith(orderRow(data, works));
      });
      side.append(cancel);
    }
    row.append(thumb, text, side);
    return row;
  };
  const showOrders = async (userId) => {
    const { data, error } = await account
      .from("orders")
      .select("id, number, work_id, title, amount_irr, status, created_at, ref_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !data.length) return;
    const works = await catalog;
    canPay = paymentsOpen((await site).settings);
    const list = document.createElement("ol");
    list.className = "order-list";
    list.append(...data.map((order) => orderRow(order, works)));
    document.getElementById("panel-orders").replaceChildren(list);
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
  page.querySelector('[data-profile="email"]').textContent = local.get("email") || "";
  if (local.get("since"))
    page.querySelector('[data-profile="since"]').textContent = dateText(local.get("since"), { month: "long", year: "numeric" });
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
  local.set("email", user.email || null);
  local.set("since", user.created_at || null);

  showMyList(user.id);
  showOrders(user.id);
  showLibrary(user.id);
  // Admins get a way into the admin panel: shown at once if this browser
  // knows them as an admin, then confirmed by the database.
  const adminLink = document.createElement("a");
  adminLink.href = "admin.html";
  adminLink.textContent = "Manage works";
  if (local.get("admin") === "1") page.querySelector(".profile-head__plan").append(adminLink);
  account
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) return;
      local.set("admin", data ? "1" : null);
      if (data) page.querySelector(".profile-head__plan").append(adminLink);
      else adminLink.remove();
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
    ["session", "name", "avatar", "admin", "email", "since"].forEach((key) => local.set(key, null));
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

  // Buying: works with a Rial price go to checkout ("Pre-order" until
  // they're out). A member with an open order is shown that instead.
  const buy = page.querySelector('[data-action="buy"]');
  const buyLabel = buy.querySelector("span");
  const buySoon = page.querySelector('[data-slot="buy-soon"]');
  if (work.prices && work.prices.IRR != null) {
    buy.href = `checkout.html?id=${encodeURIComponent(work.id)}`;
    buyLabel.textContent = work.status === "released" ? "Buy" : "Pre-order now";
    // While sales are paused the button gives way to a note, unless the
    // member already has an order for it (shown below).
    const paused = salesPaused((await site).settings);
    buy.hidden = paused;
    if (paused) {
      buySoon.textContent = "Sales paused for now";
      buySoon.hidden = false;
    }
    verifiedSession().then(async (session) => {
      if (!session) return;
      const { data } = await account
        .from("orders")
        .select("status")
        .eq("user_id", session.user.id)
        .eq("work_id", work.id)
        .in("status", ["awaiting_payment", "paid", "processing", "completed"])
        .limit(1);
      if (!data || !data.length) return;
      const paid = data[0].status !== "awaiting_payment";
      buy.hidden = false;
      buySoon.hidden = true;
      buy.href = paid ? "profile.html#library" : "profile.html#orders";
      buy.classList.add("is-ordered");
      buyLabel.textContent = paid ? "In your library" : "Ordered · awaiting payment";
    });
  } else buySoon.hidden = !prices.length;

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
      listButton.addEventListener("click", goLogin);
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
    local.set("admin", null);
    location.replace("status.html?reason=forbidden");
    return;
  }
  gate.hidden = true;
  // Lets this browser see the site while maintenance mode is on.
  local.set("admin", "1");

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

  // Published, waiting for its time, or a draft.
  const liveState = (work) =>
    !work.published ? "draft" : work.publish_at && new Date(work.publish_at) > new Date() ? "scheduled" : "live";
  const whenText = (iso) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tehran",
    });

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
        const state = liveState(work);
        const badge = make(
          "span",
          `admin-badge${state === "live" ? " is-on" : state === "scheduled" ? " is-scheduled" : ""}`,
          state === "live" ? "Published" : state === "scheduled" ? `Scheduled · ${whenText(work.publish_at)}` : "Draft"
        );
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
    publishAt: $("w-publish-at"),
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
    fields.publishAt.value = toLocalInput(w.publish_at);
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
    viewLink.hidden = !(row && liveState(row) === "live");
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
      publish_at: fromLocalInput(fields.publishAt.value),
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
    const state = liveState(result.data);
    say(
      state === "live"
        ? "Saved. It's live on the site."
        : state === "scheduled"
          ? `Saved. It goes live on ${whenText(result.data.publish_at)} (Tehran time).`
          : row.publish_at
            ? "Saved as a draft. Tick “Show on the site” for the time to take effect."
            : "Saved as a draft.",
      true
    );
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

  // ---------- Maintenance mode ----------
  const upkeep = page.querySelector(".admin-maintenance");
  const upkeepMessage = upkeep.querySelector(".admin-message");
  const upkeepOn = upkeep.querySelector("#maintenance-on");
  const upkeepNote = upkeep.querySelector("#maintenance-note");
  const upkeepNoteFa = upkeep.querySelector("#maintenance-note-fa");
  account
    .from("site_settings")
    .select("maintenance, maintenance_note, maintenance_note_fa")
    .eq("id", 1)
    .maybeSingle()
    .then(({ data }) => {
      if (!data) return;
      upkeepOn.checked = data.maintenance;
      upkeepNote.value = data.maintenance_note || "";
      upkeepNoteFa.value = data.maintenance_note_fa || "";
    });
  upkeep.addEventListener("submit", async (event) => {
    event.preventDefault();
    upkeepMessage.classList.add("is-ok");
    upkeepMessage.textContent = "Saving…";
    const { error } = await account
      .from("site_settings")
      .update({
        maintenance: upkeepOn.checked,
        maintenance_note: upkeepNote.value.trim() || null,
        maintenance_note_fa: upkeepNoteFa.value.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    upkeepMessage.classList.toggle("is-ok", !error);
    upkeepMessage.textContent = error
      ? "Not saved. Check your connection and try again."
      : upkeepOn.checked
        ? "Maintenance mode is on. Visitors now see the maintenance page; you still see the site."
        : "Maintenance mode is off. The site is open to everyone.";
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

  // ---------- Payments and subscription prices ----------
  const payForm = page.querySelector(".admin-payments");
  const payMessage = payForm.querySelector(".admin-message");
  const payMode = payForm.querySelector("#payments-mode");
  const salesMode = payForm.querySelector("#sales-open");
  const planBasic = payForm.querySelector("#plan-basic");
  const planPremium = payForm.querySelector("#plan-premium");
  account
    .from("site_settings")
    .select("payments, sales_open, plan_basic_irr, plan_premium_irr")
    .eq("id", 1)
    .maybeSingle()
    .then(({ data }) => {
      if (!data) return;
      payMode.value = data.payments || "off";
      salesMode.value = data.sales_open === false ? "paused" : "open";
      planBasic.value = data.plan_basic_irr ?? "";
      planPremium.value = data.plan_premium_irr ?? "";
    });
  // Zarinpal only takes requests from registered IPs; the payment function
  // sends them from the database, so that's the IP to register.
  account.rpc("server_ip").then(({ data, error }) => {
    payForm.querySelector('[data-slot="server-ip"]').textContent = error || !data ? "couldn't check" : data;
  });
  // Checks the order emails: a sample receipt to the studio inbox.
  const mailButton = payForm.querySelector('[data-action="email-test"]');
  const mailNote = payForm.querySelector('[data-slot="email-test"]');
  mailButton.addEventListener("click", async () => {
    mailButton.disabled = true;
    mailNote.textContent = "Sending…";
    const answer = await payment({ action: "email-test" }, await verifiedSession());
    mailButton.disabled = false;
    mailNote.textContent = answer.ok
      ? answer.via === "resend"
        ? `Sent through Resend to ${answer.to}. Check that inbox, and the spam folder.`
        : answer.resend_error
          ? `Resend refused it (${answer.resend_error}), so Gmail sent it to ${answer.to} instead.`
          : `Sent through Gmail to ${answer.to}. Check that inbox, and the spam folder.`
      : answer.error === "no_password"
        ? "Not sent: neither RESEND_API_KEY nor SMTP_PASSWORD is set in Supabase (Edge Functions → Secrets)."
        : answer.error === "send_failed"
          ? `Sending failed: ${answer.detail}`
          : "Not sent: couldn't reach the payment function. Try again.";
  });
  payForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const basic = number(planBasic);
    const premium = number(planPremium);
    if ([basic, premium].some((n) => n !== null && !(n > 0))) {
      payMessage.classList.remove("is-ok");
      payMessage.textContent = "Prices must be numbers above 0, or empty.";
      return;
    }
    payMessage.classList.add("is-ok");
    payMessage.textContent = "Saving…";
    const { error } = await account
      .from("site_settings")
      .update({
        payments: payMode.value,
        sales_open: salesMode.value === "open",
        plan_basic_irr: basic,
        plan_premium_irr: premium,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    payMessage.classList.toggle("is-ok", !error);
    payMessage.textContent = error
      ? "Not saved. Check your connection and try again."
      : salesMode.value === "paused"
        ? "Saved. Sales are paused: no new orders or payments until you reopen them."
        : { off: "Saved. Online payment is off.", test: "Saved. Test payments are on for admins.", live: "Saved. Online payment is live." }[payMode.value];
  });

  // ---------- Orders ----------
  // Newest first. The status is the only thing that can change here; the
  // buyer sees it in their profile.
  const ORDER_STATUS = {
    awaiting_payment: "Awaiting payment",
    paid: "Paid",
    processing: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const orderList = page.querySelector(".admin-orders__list");
  const noOrders = page.querySelector(".admin-orders__empty");
  const orderRow = (order) => {
    const row = make("li", "admin-order");
    const main = make("div", "admin-order__main");
    main.append(
      make("strong", "", `#${order.number} · ${order.title}${order.test ? " (test)" : ""}`),
      make("span", "", `${money.IRR(order.amount_irr)} · ${whenText(order.created_at)}`)
    );
    if (order.ref_id)
      main.append(make("span", "selectable", `Zarinpal ref ${order.ref_id}${order.card_pan ? ` · card ${order.card_pan}` : ""}`));
    const buyer = make("div", "admin-order__buyer selectable");
    const mail = make("a", "", order.email);
    mail.href = `mailto:${order.email}`;
    const tel = make("a", "", order.phone);
    tel.href = `tel:${order.phone}`;
    tel.dir = "ltr";
    buyer.append(make("span", "", order.name), mail, tel);
    const pick = make("select", "admin-order__status");
    pick.setAttribute("aria-label", `Status of order ${order.number}`);
    Object.entries(ORDER_STATUS).forEach(([value, label]) => {
      const option = make("option", "", label);
      option.value = value;
      pick.append(option);
    });
    pick.value = order.status;
    pick.dataset.status = order.status;
    pick.addEventListener("change", async () => {
      pick.disabled = true;
      const { error } = await account.from("orders").update({ status: pick.value }).eq("id", order.id);
      if (error) pick.value = order.status;
      else order.status = pick.value;
      pick.dataset.status = order.status;
      pick.disabled = false;
      // The buyer's email for the new status (receipt, in progress, done),
      // once per status.
      if (!error && ["paid", "processing", "completed"].includes(order.status)) {
        note.textContent = "Emailing the buyer…";
        const answer = await payment({ action: "status-email", order_id: order.id }, await verifiedSession());
        note.textContent = answer.sent
          ? `Emailed the buyer: ${ORDER_STATUS[order.status].toLowerCase()}.`
          : answer.failed
            ? "The email didn't go out yet. It's tried again every 15 minutes."
            : answer.error
              ? "The email didn't go out. Check the test email above."
              : "No new email: the buyer already had this one.";
        if (answer.failed) loadOrders();
      }
    });
    const note = make("span", "admin-order__note");
    const side = make("div", "admin-order__side");
    side.append(pick, note);
    // Emails that didn't go out: retried every 15 minutes for a day, or now.
    if (order.email_pending && order.email_pending.length) {
      const warn = make("div", "admin-order__mail");
      const names = order.email_pending.map((kind) => EMAIL_NAMES[kind] || kind).join(", ");
      warn.append(
        make(
          "span",
          "",
          `Email not sent: ${names}. ${order.email_tries >= 96 ? "Automatic retries have stopped." : `Tried ${order.email_tries} time${order.email_tries === 1 ? "" : "s"}; retrying every 15 minutes.`}`
        )
      );
      if (order.email_error) warn.title = order.email_error;
      const again = make("button", "admin-button", "Send again");
      again.type = "button";
      again.addEventListener("click", async () => {
        again.disabled = true;
        again.textContent = "Sending…";
        const answer = await payment({ action: "retry-emails", order_id: order.id }, await verifiedSession());
        if (!answer.error) return loadOrders(); // the row comes back without the warning, or with the new count
        again.disabled = false;
        again.textContent = "Send again";
        note.textContent = "Couldn't reach the payment function. Try again.";
      });
      warn.append(again);
      side.append(warn);
      row.classList.add("has-mail-problem");
    }
    row.append(main, buyer, side);
    return row;
  };
  const EMAIL_NAMES = { placed: "order received", paid: "receipt", processing: "in progress", completed: "completed" };
  const mailSummary = page.querySelector('[data-slot="mail-problems"]');
  const loadOrders = () =>
    account
      .from("orders")
      .select("id, number, title, amount_irr, name, email, phone, status, created_at, ref_id, card_pan, test, email_pending, email_error, email_tries")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) {
          noOrders.textContent = "Orders couldn't be loaded. Reload the page to try again.";
          noOrders.hidden = false;
          return;
        }
        orderList.replaceChildren(...data.map(orderRow));
        noOrders.hidden = data.length > 0;
        const stuck = data.filter((order) => order.email_pending && order.email_pending.length).length;
        mailSummary.textContent = stuck
          ? `${stuck} order${stuck === 1 ? " has" : "s have"} emails that didn't go out (marked below). They're retried every 15 minutes.`
          : "";
        mailSummary.hidden = !stuck;
      });
  loadOrders();

  showList();
})();

// Checkout (checkout.html?id=<id>) — one work, for members. The order is
// saved as "awaiting payment"; the database fills in the title, price and
// email itself, so nothing here can change what's charged. When online
// payment is open, the member goes on to Zarinpal, which sends them back to
// checkout.html?order=<order id>&Authority=…&Status=OK|NOK.
(async function checkoutPage() {
  const page = document.querySelector(".checkout");
  if (!page) return;
  const gate = page.querySelector(".checkout__gate");
  const form = page.querySelector(".checkout__form");
  const missing = page.querySelector(".checkout__missing");
  const done = page.querySelector(".checkout__done");
  const message = form.querySelector(".auth__message");
  const submit = form.querySelector('[type="submit"]');
  const show = (section) => {
    gate.hidden = true;
    [missing, form, done].forEach((el) => (el.hidden = el !== section));
  };
  const say = (text, ok) => {
    message.textContent = text;
    message.classList.toggle("is-ok", Boolean(ok));
  };

  // The closing screen: "placed" (payment not open, or it didn't start),
  // "paid", or "failed" (back from the bank without paying).
  const doneSlot = (name) => done.querySelector(`[data-slot="${name}"]`);
  const retry = done.querySelector('[data-action="pay-again"]');
  const finish = (state, { number, ref, note = "" }) => {
    const TEXT = {
      placed: [
        "Your order is in",
        "It’s waiting for payment. Online payment opens soon, and we’ll email you when you can pay. You can follow or cancel it in your profile.",
      ],
      paid: ["Payment received", "Thank you! The order is paid and shows in your profile. Keep the reference number for any questions."],
      failed: [
        "The payment didn’t go through",
        "Your order is saved. If money left your account, the bank returns it within 72 hours. You can try again now, or later from your orders.",
      ],
    }[state];
    done.dataset.state = state;
    doneSlot("done-title").textContent = TEXT[0];
    doneSlot("done-text").textContent = TEXT[1];
    const numberLine = doneSlot("done-number");
    numberLine.replaceChildren();
    if (number != null) numberLine.append(`Order number ${number}`);
    if (ref) {
      const refText = document.createElement("span");
      refText.className = "selectable";
      refText.textContent = `Reference ${ref}`;
      numberLine.append(" · ", refText);
    }
    doneSlot("done-message").textContent = note;
    retry.hidden = state !== "failed";
    doneSlot("orders-link").classList.toggle("empty__button--accent", state !== "failed");
    show(done);
    scrollTo(0, 0);
  };

  // ---------- Back from the bank ----------
  const params = new URLSearchParams(location.search);
  const returning = params.get("order");
  if (returning) {
    gate.textContent = "Checking your payment…";
    const answer = await payment({
      action: "verify",
      order_id: returning,
      authority: params.get("Authority") || "",
      status: params.get("Status") || "",
    });
    // Reloading shouldn't ask the bank again.
    history.replaceState(null, "", `checkout.html?order=${encodeURIComponent(returning)}`);
    if (answer.error === "not_found" || answer.error === "bad_request") return show(missing);
    if (answer.error) {
      gate.textContent = "Couldn't reach the payment service. Reload the page in a moment to check again.";
      return;
    }
    if (answer.paid) return finish("paid", { number: answer.number, ref: answer.ref_id });
    finish("failed", { number: answer.number });
    retry.addEventListener("click", async () => {
      retry.disabled = true;
      doneSlot("done-message").classList.add("is-ok");
      doneSlot("done-message").textContent = "Taking you to the bank…";
      const problem = await payOrder(returning);
      if (!problem) return;
      retry.disabled = false;
      doneSlot("done-message").classList.remove("is-ok");
      doneSlot("done-message").textContent = problem;
    });
    return;
  }

  const session = await verifiedSession();
  if (!session) return goLogin();
  const user = session.user;
  const id = new URLSearchParams(location.search).get("id");
  const work = (await catalog).find((w) => w.id === id);
  if (!work || !work.prices || work.prices.IRR == null) return show(missing);

  // Already ordered: that order is in the profile.
  const { data: open } = await account
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .eq("work_id", work.id)
    .in("status", ["awaiting_payment", "paid", "processing", "completed"])
    .limit(1);
  if (open && open.length) return location.replace("profile.html#orders");

  document.title = `Checkout · ${work.title} · SauFox Entertainment`;
  form.querySelectorAll(".checkout-card__step").forEach((step) => (step.textContent = digits(step.textContent)));
  const back = form.querySelector('[data-slot="back"]');
  back.href = `work.html?id=${encodeURIComponent(work.id)}`;

  // Summary
  const poster = form.querySelector(".checkout-summary__poster");
  if (work.images[0]) poster.src = work.images[0];
  else poster.hidden = true;
  form.querySelector(".checkout-summary__kind").textContent = work.kind;
  form.querySelector(".checkout-summary__name").textContent = work.title;
  form.querySelector(".checkout-summary__edition").textContent =
    work.status === "released" ? "Digital edition" : "Pre-order · in your Library on release day";
  const rials = work.prices.IRR;
  form.querySelector('[data-slot="price"]').textContent = money.IRR(rials);
  const total = form.querySelector('[data-slot="total"]');
  total.textContent = money.IRR(rials);
  const tomans = document.createElement("small");
  tomans.textContent = LANG === "fa" ? `${num(Math.round(rials / 10))} تومان` : `${num(Math.round(rials / 10))} Tomans`;
  total.append(tomans);
  const others = ["USD", "EUR"].filter((code) => work.prices[code] != null).map((code) => `≈ ${money[code](work.prices[code])}`);
  if (others.length) {
    const approx = form.querySelector('[data-slot="approx"]');
    approx.textContent = `About ${others.join(" / ")}. You pay in Rials.`;
    approx.hidden = false;
  }

  // Buyer
  const nameInput = form.querySelector("#checkout-name");
  const phoneInput = form.querySelector("#checkout-phone");
  const agree = form.querySelector('[name="agree"]');
  form.querySelector('[data-slot="email"]').textContent = user.email;
  nameInput.value = local.get("name") || (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || "";
  phoneInput.value = local.get("phone") || "";

  // Payment: straight on to the bank when it's open.
  const { settings } = await site;
  const canPay = paymentsOpen(settings);
  if (salesPaused(settings)) {
    submit.disabled = true;
    say(SALES_PAUSED);
  }
  if (canPay) {
    form.querySelector('[data-slot="pay-note"]').textContent =
      settings.payments === "test"
        ? "Test mode: you'll go to Zarinpal's sandbox, and no real money moves. Only admins see this."
        : "After you place the order, you'll go to Zarinpal's secure page to pay, then come back here.";
    submit.textContent = "Place order and pay";
  }
  show(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const phone = cleanPhone(phoneInput.value);
    if (!name) {
      nameInput.focus();
      return say("Enter your full name.");
    }
    if (!/^\+?[0-9]{8,15}$/.test(phone)) {
      phoneInput.focus();
      return say("Enter a mobile number we can reach you on, such as 0912 345 6789.");
    }
    if (!agree.checked) {
      agree.focus();
      return say("Accept the terms of purchase to place the order.");
    }
    submit.disabled = true;
    say("Placing your order…", true);
    const { data, error } = await account
      .from("orders")
      .insert({ work_id: work.id, name, phone })
      .select("id, number")
      .single();
    if (error) {
      submit.disabled = false;
      if (error.code === "23505") return location.replace("profile.html#orders");
      if (error.code === "SF001") {
        submit.disabled = true;
        return say(SALES_PAUSED);
      }
      if (error.code === "P0001") return say("This work isn't on sale right now. Reload the page to see its latest details.");
      return say("Your order wasn't placed. Check your connection and try again.");
    }
    local.set("phone", phone);
    if (!canPay) {
      payment({ action: "placed", order_id: data.id }, session); // the "order received" email
      return finish("placed", { number: data.number });
    }
    say("Taking you to the bank…", true);
    const problem = await payOrder(data.id);
    if (problem) finish("placed", { number: data.number, note: problem });
  });
})();

// Status page (404.html, status.html?reason=…) — page not found, no access,
// maintenance, can't reach the server, or a general error. Maintenance and
// outages check again by themselves and go back when the site is up.
(function statusPage() {
  const page = document.querySelector(".status");
  if (!page) return;

  const params = new URLSearchParams(location.search);
  const reason = page.dataset.reason === "404" ? "404" : params.get("reason") || "error";
  // Only an address on this site to go back to.
  const back = (() => {
    const from = params.get("from") || "";
    return from.startsWith("/") && !from.startsWith("//") ? from : "/index.html";
  })();

  const STATES = {
    404: {
      mark: "404",
      title: "This page isn't here",
      text: "The link may be broken, or the page may have moved.",
      actions: [["Back to home", "/index.html", true]],
    },
    forbidden: {
      mark: "403",
      title: "You don't have access to this page",
      text: "It's only open to certain accounts. If yours is one of them, log in with it.",
      actions: [["Log in", "/login.html", true], ["Back to home", "/index.html"]],
    },
    maintenance: {
      mark: "SauFox",
      title: "We'll be right back",
      text: "We're making some improvements to the site. It'll be back shortly.",
      hint: "This page checks every minute and takes you back when the site is open.",
      actions: [],
    },
    offline: {
      mark: "SauFox",
      title: "Can't reach our servers",
      text: "Check your internet connection. If it's working, our servers may be busy; we'll keep trying.",
      hint: "Trying again every 20 seconds…",
      actions: [["Try again", back, true]],
    },
    error: {
      mark: "500",
      title: "Something went wrong",
      text: "It's on our side. Try again in a moment.",
      actions: [["Try again", back, true], ["Back to home", "/index.html"]],
    },
  };
  const state = STATES[reason] || STATES.error;
  page.dataset.reason = STATES[reason] ? reason : "error";

  page.querySelector(".status__mark").textContent = state.mark;
  page.querySelector(".status__title").textContent = state.title;
  page.querySelector(".status__text").textContent = state.text;
  page.querySelector(".status__hint").textContent = state.hint || "";
  document.title = `${state.title} · SauFox Entertainment`;
  const actions = page.querySelector(".status__actions");
  state.actions.forEach(([label, href, primary]) => {
    const link = document.createElement("a");
    link.className = primary ? "status__button status__button--primary" : "status__button";
    link.href = href;
    link.textContent = label;
    actions.append(link);
  });
  actions.hidden = !state.actions.length;

  const settings = async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?select=maintenance,maintenance_note,maintenance_note_fa&id=eq.1`, {
      headers: { apikey: SUPABASE_KEY },
      signal: timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json())[0] || {};
  };

  if (reason === "maintenance") {
    const note = page.querySelector(".status__note");
    const check = () =>
      settings()
        .then((s) => {
          if (!s.maintenance) return location.replace(back);
          const text = (LANG === "fa" && s.maintenance_note_fa) || s.maintenance_note || "";
          note.textContent = text;
          note.hidden = !text;
        })
        .catch(() => {});
    check();
    setInterval(check, 60000);
  }

  if (reason === "offline") {
    setInterval(() => settings().then(() => location.replace(back)).catch(() => {}), 20000);
  }
})();
