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

// ---------- Work routes ----------
const workUrl = SauFoxRoutes.workUrl;
const currentWorkId = () => SauFoxRoutes.workId(location.href);
const workReturn = (hash) => {
  const url = new URL(SauFoxRoutes.canonical(location.href) || location.href, location.href);
  if (hash !== undefined) url.hash = hash;
  return url.pathname + url.search + url.hash;
};
if (document.querySelector('.title-page')) {
  const clean = SauFoxRoutes.canonical(location.href);
  if (clean && clean !== location.pathname + location.search + location.hash) location.replace(clean);
}

// ---------- Clean addresses, fresh pages ----------
// Links never show ".html" (GitHub Pages serves /work for work.html; the
// home page is "/"), including links the scripts add later. The inline
// script in each <head> cleans the address bar itself.
(function cleanLinks() {
  const PAGE = /^(?:\.\/|\/)?([a-z0-9-]+)\.html(?=$|[?#])(.*)$/i;
  const tidy = (el) => {
    const name = el.tagName === "FORM" ? "action" : "href";
    const raw = el.getAttribute(name) || "";
    if (raw.startsWith("#") && location.pathname.startsWith("/works/")) {
      el.setAttribute(name, location.pathname + location.search + raw);
      return;
    }
    const m = PAGE.exec(raw);
    if (m) el.setAttribute(name, (m[1].toLowerCase() === "index" ? "/" : "/" + m[1]) + m[2]);
  };
  const SELECT = "a[href], form[action]";
  document.querySelectorAll(SELECT).forEach(tidy);
  new MutationObserver((records) =>
    records.forEach((r) => {
      if (r.type === "attributes") return r.target.matches(SELECT) && tidy(r.target);
      r.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches(SELECT)) tidy(node);
        node.querySelectorAll(SELECT).forEach(tidy);
      });
    })
  ).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["href", "action"] });
})();

// Coming back to the site's tab after a while, or with Back, loads the page
// afresh from the top, so it shows what changed meanwhile (a comment posted
// in another tab, a new price). Nothing is lost: the sign-in and settings
// live in localStorage, which a reload doesn't touch. It waits while the
// visitor is in the middle of something (typed text, an open box, a playing
// video) and never happens on sign-in, checkout, admin or launcher pages.
(function freshPages() {
  // Only when the page comes back from the browser's back/forward cache (the
  // Back button), so a returning visitor sees fresh data and starts at the
  // top. Switching to another browser tab and back does NOT reload — that
  // was more annoying than helpful.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    history.replaceState(history.state, "", location.pathname + location.search);
    location.reload();
  });
})();

// ---------- Language ----------
// English, or Persian (right to left). The inline script in each page's
// <head> picks the language before first paint and hides a Persian page
// until its text is in. Here every English text and label listed in FA
// (js/fa.js) becomes Persian, now and whenever the scripts add more. Parts
// marked translate="no" (work titles, names, emails) are left alone.
const LANG = document.documentElement.lang === "fa" && typeof FA !== "undefined" ? "fa" : "en";

const faDigits = (text) => String(text).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const isolateNumbers = (text) => (LANG === "fa" ? SauFoxNumbers.isolate(text) : String(text));
const digits = (text) => isolateNumbers(LANG === "fa" ? faDigits(text) : text);
const num = (n, decimals = 0) =>
  isolateNumbers(n.toLocaleString(LANG === "fa" ? "fa-IR" : "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
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
  return out === undefined ? text : text.replace(trimmed, isolateNumbers(out));
};

(function translatePage() {
  if (LANG !== "fa") return;
  const SKIP = "script, style, textarea, [translate='no']";
  const ATTRS = ["placeholder", "aria-label", "title", "alt", "data-hover-text"];

  const translateText = (node) => {
    if (!node.parentElement || node.parentElement.closest(SKIP)) return;
    const translated = t(node.nodeValue);
    const next = /[آ-ی]/.test(translated) ? isolateNumbers(translated) : translated;
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
    const next = LANG === "fa" ? "en" : "fa";
    local.set("lang", next);
    // An address that names the language (?lang=fa) gets the new one.
    const url = new URL(location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", next);
      location.replace(url.href);
    } else location.reload();
  });
});

// Search engines and link previews. Each page's <head> has its English
// description, canonical address and ?lang=fa twin; in Persian the texts
// are translated, and an address with ?lang=fa is its own canonical one.
// Pages built from data (a work) call pageMeta with their own details.
const SITE_URL = "https://saufoxentertainment.ir";
const FA_URL = /[?&]lang=fa(&|$)/.test(location.search);
const setMeta = (selector, attr, value) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    const [, tag, key, name] = selector.match(/^(\w+)\[(\w+)="([^"]+)"\]/);
    el = document.createElement(tag);
    el.setAttribute(key, name);
    document.head.append(el);
  }
  el.setAttribute(attr, value);
};
const pageMeta = ({ path, title, description, image } = {}) => {
  const head = document.head;
  if (path) {
    const url = SITE_URL + path;
    const fa = url + (url.includes("?") ? "&" : "?") + "lang=fa";
    setMeta('link[rel="canonical"]', "href", FA_URL ? fa : url);
    setMeta('link[hreflang="en"]', "href", url);
    setMeta('link[hreflang="fa"]', "href", fa);
    setMeta('link[hreflang="x-default"]', "href", url);
    head.querySelectorAll("link[hreflang]").forEach((link) => (link.rel = "alternate"));
    setMeta('meta[property="og:url"]', "content", FA_URL ? fa : url);
  } else if (FA_URL) {
    const canonical = head.querySelector('link[rel="canonical"]');
    const fa = head.querySelector('link[hreflang="fa"]');
    if (canonical && fa) canonical.href = fa.href;
    const og = head.querySelector('meta[property="og:url"]');
    if (og && fa) og.content = fa.href;
  }
  if (title) setMeta('meta[property="og:title"]', "content", t(title));
  if (description) {
    setMeta('meta[name="description"]', "content", t(description));
    setMeta('meta[property="og:description"]', "content", t(description));
  }
  if (image) setMeta('meta[property="og:image"]', "content", new URL(image, SITE_URL + "/").href);
  if (LANG === "fa") {
    ['meta[name="description"]', 'meta[property="og:description"]', 'meta[property="og:title"]'].forEach((selector) => {
      const el = head.querySelector(selector);
      if (el) el.content = t(el.content);
    });
    const locale = head.querySelector('meta[property="og:locale"]');
    const other = head.querySelector('meta[property="og:locale:alternate"]');
    if (locale && other) [locale.content, other.content] = ["fa_IR", "en_US"];
  }
};
if (!document.querySelector(".title-page")) pageMeta();

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
const TURNSTILE_SITE_KEY = "0x4AAAAAAFDsz8h-Njtg3UzM";
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

// ---------- Cast & crew ----------
// Each person has a name, a photo, any number of roles and, for actors and
// voices, the character(s) they play (works.credits: { name, photo, roles,
// character }). Where they show follows from the roles: anyone who directs
// or writes leads, actors and voices are the cast, the rest the crew.
// Credits from before (one role, perhaps a group, "as <character>") are
// read the same way.
const creditTaxonomy = SauFoxCredits;
const CAST = /^(actor|actress|cast|voice|voice actor|voice actress|narrator|as .+|voice of .+|بازیگر|صداپیشه|گوینده|راوی|در نقش .+)$/i;
const creditRoles = (credit) => {
  if (Array.isArray(credit.roles)) return credit.roles.filter(Boolean);
  if (credit.group === "director_writer") return ["Director", "Writer"];
  const role = String(credit.role || "").trim();
  if (!role) return [];
  // An old cast entry's role was the character played.
  if (credit.group === "cast" && !CAST.test(role)) return [`as ${role}`];
  return role.split(/\s*(?:,|&|\/|\band\b)\s*/i).filter(Boolean);
};
// Roles that play a character, so the admin panel asks which one.
const PLAYS = { test: creditTaxonomy.plays };
// A credit as { name, photo, roles, character }: "as Anna" roles become
// the character (with an Actor role if nothing else says so).
const readCredit = (credit) => {
  let roles = creditRoles(credit);
  const played = roles.filter((r) => /^(as|در نقش)\s+/i.test(r)).map((r) => r.replace(/^(as|در نقش)\s+/i, ""));
  roles = roles.filter((r) => !/^(as|در نقش)\s+/i.test(r));
  if (played.length && !roles.some((r) => PLAYS.test(r))) roles.unshift("Actor");
  const character = [credit.character, ...played].filter(Boolean).join(", ");
  return { name: credit.name || "", photo: credit.photo || "", roles: creditTaxonomy.unique(roles), character, department: credit.department || "" };
};
// AI tools that helped make the work: listed inside the crew, apart.
const AI = /^(ai|ai assistant|ai model|دستیار هوش مصنوعی|هوش مصنوعی)$/i;
// "lead" (directs or writes), "ai" (an AI assistant), "cast" (only acts or
// voices) or "crew".
const creditPlace = (roles, department = "") => creditTaxonomy.department({ roles, department });

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
  heroFeatured: Boolean(row.hero_featured),
  stills: row.stills || [],
  trailerDate: row.trailer_date,
  trailer: row.trailer || "",
  youtube: row.youtube_url || "",
  youtubeThumb: row.youtube_thumb_url || "",
  synopsis: (LANG === "fa" && row.synopsis_fa) || row.synopsis || "",
  genres: row.genres || [],
  platforms: row.platforms || [],
  rating: row.rating || "",
  credits: (row.credits || []).map(readCredit).filter((credit) => credit.name),
  created: row.created_at || "",
  // Both languages' texts, for search (browse.html).
  text: [row.synopsis, row.synopsis_fa, row.status_text, row.status_text_fa].filter(Boolean).join(" "),
  // Members' reviews: the average of their stars, and how many there are.
  reviews: row.review_count || 0,
  score: row.review_count ? row.review_sum / row.review_count : null,
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
    const [rows, settings, plans] = await Promise.all([
      get("works?select=*&published=eq.true&order=sort.asc,created_at.asc"),
      get("site_settings?select=usd_irr,eur_irr,maintenance,maintenance_note,maintenance_note_fa,payments,sales_open&id=eq.1").catch(() => []),
      get("plans?select=id,rank,discount_percent,free_kinds,on_sale,plan_prices(days,price_irr)&order=rank.asc").catch(() => []),
    ]);
    // Each plan's prices by length: { 7: rials, 30: rials, … } (none = not offered).
    plans.forEach((plan) => {
      plan.prices = {};
      (plan.plan_prices || []).forEach((row) => row.price_irr != null && (plan.prices[row.days] = row.price_irr));
      delete plan.plan_prices;
    });
    const rates = { ...(settings[0] || {}), plans };
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
const site = document.querySelector(".hero, .works, .plans, .title-page, .login-bg, .profile-page, .checkout, .browse, .news")
  ? loadSite()
  : Promise.resolve({ works: [], settings: {}, offline: false });
const catalog = site.then((data) => data.works);

// Behind every page built from the catalogue: a collage of the studio's
// artwork, faint and heavily blurred, so the dark background isn't flat.
// Added once the page has loaded, so it never slows the first view. Not on
// the login page (it has its own artwork).
(async function pageBackdrop() {
  if (!document.querySelector(".hero, .works, .plans, .title-page, .profile-page, .checkout, .browse, .news")) return;
  const works = await catalog;
  const pictures = [...new Set(works.flatMap((w) => [w.hero, ...w.images, ...w.stills]).filter(Boolean))];
  if (!pictures.length) return;
  if (document.readyState !== "complete") await new Promise((resolve) => addEventListener("load", resolve, { once: true }));
  const layer = document.createElement("div");
  layer.className = "page-backdrop";
  layer.setAttribute("aria-hidden", "true");
  // Enough tiles to fill the grid, each picture used in turn.
  const TILES = 24;
  for (let i = 0; i < TILES; i++) {
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.setAttribute("fetchpriority", "low");
    img.src = pictures[(i * 7) % pictures.length];
    layer.append(img);
  }
  layer.addEventListener("load", () => layer.classList.add("is-in"), { capture: true, once: true });
  document.body.prepend(layer);
})();

// Maintenance and outages, on the pages built from the catalogue: visitors
// go to the status page (which comes back here when the site is up).
// Admins see the site as usual, with a reminder bar.
(async function siteStatus() {
  if (!document.querySelector(".hero, .works, .title-page, .profile-page, .checkout, .browse")) return;
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
  // Keep the full local path and any selected options after signing in.
  local.set("next", location.pathname + location.search + location.hash);
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
  payment_review: "Payment received for review. Do not pay again; contact support with your order number.",
  storage: "The payment record could not be saved. Retry this page; do not start another payment.",
  paused: "Sales are paused for a little while. Your order is saved; you can pay once they reopen.",
  closed: "Online payment isn't open yet. Your order is saved, and we'll email you when you can pay.",
  not_configured: "Online payment isn't open yet. Your order is saved, and we'll email you when you can pay.",
  gateway: "The bank gateway didn't answer. Try again in a moment.",
  not_payable: "This order can't be paid any more. See its status in your orders.",
  signed_out: "Your session has ended. Log in again to pay.",
};
const callFunction = async (name, body, session) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
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
const payment = (body, session) => callFunction("payment", body, session);
// Files of the works a member owns (Edge Function "library").
const library = (body, session) => callFunction("library", body, session);
const PLATFORMS = { windows: "Windows", mac: "macOS", linux: "Linux", android: "Android", other: "Download" };
const fileSize = (bytes) => {
  if (!(bytes > 0)) return "";
  const [value, unit] =
    bytes >= 1e9 ? [bytes / 1e9, LANG === "fa" ? "گیگابایت" : "GB"] : [bytes / 1e6, LANG === "fa" ? "مگابایت" : "MB"];
  return `${num(value, value < 10 ? 1 : 0)} ${unit}`;
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

// ---------- Subscriptions ----------
// Iron, Gold and Titanium (public.plans; settings.plans), each sold for
// 7 days, 1, 3 or 6 months or a year at its own price (public.plan_prices;
// plan.prices by days). A paid plan order gives the member that many days;
// the database takes the plan's discount off every work they order.
const PLAN_NAMES = { iron: "Iron", gold: "Gold", titanium: "Titanium" };
const planName = (id) => PLAN_NAMES[id] || id;
const PLAN_LENGTHS = [
  [7, "7 days"],
  [30, "1 month"],
  [90, "3 months"],
  [180, "6 months"],
  [365, "1 year"],
];
const lengthName = (days) => (PLAN_LENGTHS.find(([d]) => d === Number(days)) || [0, `${days} days`])[1];
// The free-viewing line for a plan's free_kinds.
const FREE_LINES = {
  novel: "Read every novel free in the online reader",
  animation: "Watch every animation free",
  film: "Watch every film free",
  "animation,novel": "Watch every animation free, and read every novel",
  "film,novel": "Watch every film free, and read every novel",
  "animation,film": "Watch every film and animation free",
  "animation,film,novel": "Watch every film and animation free, and read every novel",
};
const freeLine = (kinds) => FREE_LINES[[...(kinds || [])].sort().join(",")] || "";
// Which of animation / film / novel a work is (same as private.kind_class).
const kindClass = (kind) =>
  /film|movie/i.test(kind) ? "film" : /anim/i.test(kind) ? "animation" : /novel|book/i.test(kind) ? "novel" : "";
// The signed-in member's plan: { plan, ends_at, discount_percent,
// free_kinds } or null. Asked once per page, and remembered in this
// browser for the pages that don't talk to the account (the home page).
let membershipAsk = null;
const myMembership = () =>
  (membershipAsk ||= (async () => {
    if (!local.get("session")) return null;
    const session = await verifiedSession();
    if (!session) return null;
    const { data, error } = await account.rpc("my_membership");
    if (error) return savedMembership();
    local.set("plan", data ? JSON.stringify({ plan: data.plan, ends_at: data.ends_at }) : null);
    return data;
  })());
const savedMembership = () => {
  try {
    const saved = local.get("session") && JSON.parse(local.get("plan") || "null");
    return saved && new Date(saved.ends_at) > new Date() ? saved : null;
  } catch (e) {
    return null;
  }
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
// Header backdrop (WebGL): slow smoke in the site's dark silver with faint
// orange embers drifting through it, and a soft warm light under the
// mouse. Drawn at half resolution and ~30 fps, paused while the tab is
// hidden; one still frame for reduced motion; nothing without WebGL.
(function headerShader() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const canvas = document.createElement("canvas");
  canvas.className = "site-header__shader";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) return;
  const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec3 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
vec2 uv=gl_FragCoord.xy/r;
vec2 p=vec2(gl_FragCoord.x/r.y,uv.y)*1.4;
float T=t*.035;
vec2 q=vec2(fbm(p+vec2(T,0.)),fbm(p+vec2(-T,T*.5)+5.2));
float s=fbm(p*1.1+2.2*q+vec2(T*1.6,0.));
vec3 c=vec3(.059,.059,.067);
c+=vec3(.78,.79,.84)*smoothstep(.42,.95,s)*.11;
float e=smoothstep(.64,.95,fbm(p*2.6+q*3.-vec2(0.,T*7.)));
c+=vec3(1.,.48,.1)*e*.2*(1.-uv.y*.5);
vec2 d=(gl_FragCoord.xy-m.xy)/r.y;
c+=vec3(1.,.62,.32)*exp(-dot(d,d)*2.)*.09*m.z;
gl_FragColor=vec4(c,1.);}`;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, "r");
  const uT = gl.getUniformLocation(prog, "t");
  const uM = gl.getUniformLocation(prog, "m");
  header.prepend(canvas);

  const SCALE = 0.5;
  const size = () => {
    canvas.width = Math.max(1, Math.round(header.clientWidth * SCALE));
    canvas.height = Math.max(1, Math.round(header.clientHeight * SCALE));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  // The mouse light eases in and out.
  const mouse = { x: 0, y: 0, on: 0, want: 0 };
  header.addEventListener("pointermove", (event) => {
    const box = header.getBoundingClientRect();
    mouse.x = (event.clientX - box.left) * SCALE;
    mouse.y = (box.bottom - event.clientY) * SCALE;
    mouse.want = 1;
  });
  header.addEventListener("pointerleave", () => (mouse.want = 0));

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = performance.now() - Math.random() * 60000;
  let last = 0;
  let frame = 0;
  const draw = (now) => {
    frame = still ? 0 : requestAnimationFrame(draw);
    if (now - last < 33) return;
    last = now;
    mouse.on += (mouse.want - mouse.on) * 0.08;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, (now - start) / 1000);
    gl.uniform3f(uM, mouse.x, mouse.y, mouse.on);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  size();
  new ResizeObserver(() => {
    size();
    if (still) draw(performance.now() + 1000);
  }).observe(header);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(frame);
    if (!document.hidden && !still) frame = requestAnimationFrame(draw);
  });
  frame = requestAnimationFrame(draw);
})();

// The eNamad seal loads from eNamad's own server, which is often slow or
// out of reach (outside Iran, behind a VPN). A failed image is tried again
// twice; if it still won't come, a plain badge takes its place, linking to
// the same verification page, so the spot is never empty.
(function trustSeals() {
  document.querySelectorAll(".site-footer__seals a").forEach((link) => {
    const img = link.querySelector("img");
    if (!img) return;
    const src = img.getAttribute("src");
    let tries = 0;
    const fallback = () => {
      if (link.querySelector(".seal-badge")) return;
      img.hidden = true;
      const badge = document.createElement("span");
      badge.className = "seal-badge";
      badge.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 12.2l2.4 2.4 4.6-4.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const text = document.createElement("span");
      text.className = "seal-badge__text";
      const name = document.createElement("strong");
      name.textContent = t("eNamad");
      const note = document.createElement("small");
      note.textContent = t("Trust seal · Verify");
      text.append(name, note);
      badge.append(text);
      link.append(badge);
      link.setAttribute("aria-label", t("eNamad trust seal"));
    };
    const failed = () => {
      if (tries >= 2) return fallback();
      tries += 1;
      setTimeout(() => (img.src = `${src}&retry=${tries}`), 2500 * tries);
    };
    img.addEventListener("error", failed);
    img.addEventListener("load", () => {
      // eNamad sometimes answers with an empty 1×1 picture instead of an error.
      if (img.naturalWidth < 20) failed();
    });
    // Already finished before this script ran.
    if (img.complete && (img.naturalWidth < 20)) failed();
    // Still nothing after 12 seconds: show the badge (the image, if it
    // turns up later, takes the spot back).
    setTimeout(() => {
      if (!img.complete || img.naturalWidth < 20) fallback();
    }, 12000);
    img.addEventListener("load", () => {
      if (img.naturalWidth >= 20) {
        img.hidden = false;
        const badge = link.querySelector(".seal-badge");
        if (badge) badge.remove();
      }
    });
  });
})();

// Once a visit: support and order help live in the customer portal only.
// Not on the pages where it would get in the way (sign-in, checkout, the
// admin panel, status pages).
(function portalNotice() {
  if (/\/(login|checkout|admin|launcher|download|status|portal-signin|support|404)(\.html)?$/.test(location.pathname)) return;
  if (document.querySelector(".status, .admin")) return;
  try {
    if (sessionStorage.getItem("saufox.portal-notice")) return;
  } catch (e) {
    return;
  }
  const PORTAL = "https://portal.saufoxentertainment.ir/";
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A floating box over the top of the page, not a modal: it leaves by itself after 10s
  // (the timer bar pauses while the pointer is on it).
  const note = document.createElement("aside");
  note.className = "portal-notice";
  note.setAttribute("role", "status");
  note.innerHTML = `
    <span class="portal-notice__mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20a3 3 0 0 1-3 2h-3"/></svg>
    </span>
    <div class="portal-notice__body">
      <p class="portal-notice__kicker">${t("Customer portal")}</p>
      <p class="portal-notice__title">${t("No support is given outside the customer portal")}</p>
      <p class="portal-notice__lead">${t("To follow up an order or get help, please use the customer portal only. Messages sent anywhere else may not reach our team.")}</p>
      <a class="portal-notice__go" href="${PORTAL}">${t("Open the customer portal")}</a>
    </div>
    <button class="portal-notice__x" type="button" aria-label="${t("Close")}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <span class="portal-notice__bar" aria-hidden="true"></span>`;
  const seen = () => {
    try {
      sessionStorage.setItem("saufox.portal-notice", "1");
    } catch (e) {}
  };
  let gone = false;
  const close = () => {
    if (gone) return;
    gone = true;
    seen();
    if (calm) return note.remove();
    note.classList.add("is-leaving");
    setTimeout(() => note.remove(), 350);
  };
  note.querySelector(".portal-notice__x").addEventListener("click", close);
  note.querySelector(".portal-notice__go").addEventListener("click", seen);
  note.querySelector(".portal-notice__bar").addEventListener("animationend", close);
  setTimeout(() => {
    document.body.append(note);
    seen();
    if (calm) setTimeout(close, 10000);
  }, calm ? 400 : 1200);
})();

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

// ---------- YouTube ----------
// A YouTube link as https://www.youtube.com/watch?v=<id> (from watch, youtu.be,
// shorts, live or embed links); "" for nothing, null if it isn't one.
const youtubeId = (url) => {
  const match = String(url || "").match(
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/
  );
  return match ? match[1] : "";
};
const youtubeUrl = (text) => {
  const value = String(text || "").trim();
  if (!value) return "";
  const id = youtubeId(value);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
};
// A thumbnail that opens the video on YouTube. The thumbnail uploaded in the
// admin panel comes from this site (YouTube's own images need a VPN in Iran);
// without one, YouTube's is tried, and a plain dark frame stays if it fails.
const youtubeCard = (url, thumb, label = "Watch on YouTube") => {
  const link = document.createElement("a");
  link.className = "yt-card";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  const frame = document.createElement("span");
  frame.className = "yt-card__frame";
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.src = thumb || `https://i.ytimg.com/vi/${youtubeId(url)}/hqdefault.jpg`;
  img.addEventListener("error", () => img.remove());
  const play = document.createElement("span");
  play.className = "yt-card__play";
  play.innerHTML =
    '<svg viewBox="0 0 68 48" aria-hidden="true"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z" fill="#f00"/><path d="M45 24 27 14v20z" fill="#fff"/></svg>';
  frame.append(img, play);
  const text = document.createElement("span");
  text.className = "yt-card__label";
  text.textContent = label;
  link.append(frame, text);
  return link;
};

// The hero's bottom edge, shared by the hero and the work cards. Same shape
// as the hero's mask in css/style.css, in its 1440 x 520 viewBox: flat at
// y=370 up to x=460, a cubic down to (1200, 520), then flat. Takes x as a
// fraction of the hero's width, returns y in viewBox units.
const heroEdgeY = (() => {
  const P = [[1200, 520], [900, 520], [780, 370], [460, 370]];
  const at = (t, k) =>
    (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t ** 2 * P[2][k] + t ** 3 * P[3][k];
  // Phones drop the curve (css/style.css) so the artwork shows whole.
  const phone = window.matchMedia("(max-width: 700px)");
  return (fraction) => {
    if (phone.matches) return 520;
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
// work (up to five, seven on wide screens), or a single full-width image
// while there is one work. The main work (chosen in the admin panel, else the
// one with the newest news post, else a random one) takes the left 72% with
// its banner nearly whole,
// and its card stays open (an eye button hides it, remembered in this
// browser); the rest share the right side in equal strips. Works with a news
// post come first: their panel shows the work's art, a "News" tag, and links
// to the latest post about it. On a mouse, a strip on the right widens
// within that side and a card opens on it with the post's or work's details
// and its YouTube video (thumbnail -> YouTube).
(async function heroCollage() {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const CATALOG = await catalog;

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const SWAP_EVERY = 4500;
  const MAX_PANELS = window.innerWidth >= 1100 ? 6 : window.innerWidth >= 700 ? 5 : 4;

  const withArt = CATALOG.filter((work) => work.hero || work.images[0]);
  const artOf = (work) => work.hero || work.images[0];
  if (!withArt.length) return;

  // The latest post about each work, newest first.
  let posts = [];
  try {
    posts = await getNews(`${NEWS_LIST}&work_id=not.is.null&limit=20`);
  } catch (e) {}
  const newsFor = new Map();
  posts.forEach((post) => {
    if (!newsFor.has(post.work_id) && withArt.some((w) => w.id === post.work_id)) newsFor.set(post.work_id, post);
  });

  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // The main work chosen in the admin panel, then works with news (newest
  // first), then the rest with key art, shuffled.
  const chosen = withArt.find((w) => w.heroFeatured);
  const newsWorks = [...newsFor.keys()].map((id) => withArt.find((w) => w.id === id)).filter((w) => w !== chosen);
  const others = shuffle(withArt.filter((w) => w !== chosen && !newsFor.has(w.id) && w.hero));
  const picks = [...(chosen ? [chosen] : []), ...newsWorks, ...others].slice(0, MAX_PANELS);
  const count = picks.length;
  if (!count) return;
  // The featured work first (on the left), the rest in a random order.
  const order = [0, ...shuffle(picks.slice(1).map((_, i) => i + 1))];

  const art = (work) => {
    const el = document.createElement("span");
    el.className = "hero__art";
    el.style.backgroundImage = `url("${artOf(work)}")`;
    if (work.heroFocus) el.style.backgroundPosition = work.heroFocus;
    el.dataset.work = work.id;
    return el;
  };
  const STATUS = { released: "Released", preorder: "Pre-order", coming: "Coming soon", production: "In production" };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  // The glass card: the post's details (or the work's), its YouTube video,
  // and a link on.
  const card = (work, post) => {
    const box = make("div", "hero__card");
    const top = make("p", "hero__card-top");
    if (post) top.append(make("span", "hero__badge", t("News")), make("span", "", dateText(post.published_at)));
    else top.append(make("span", "hero__badge hero__badge--work", t(work.kind)), make("span", "", t(STATUS[work.status] || "")));
    const title = make("strong", "hero__card-title", post ? newsField(post, "title") : work.title);
    title.dir = "auto";
    title.translate = false;
    box.append(top, title);
    const about = post ? newsBlurb(post) : work.statusText || work.synopsis;
    if (about) {
      const text = make("p", "hero__card-text", about);
      text.dir = "auto";
      text.translate = false;
      box.append(text);
    }
    if (post) {
      const on = make("p", "hero__card-work");
      const name = make("span", "", work.title);
      name.translate = false;
      on.append(`${t(work.kind)} · `, name);
      box.append(on);
    }
    // The post's video, or else the work's (its trailer).
    const video = post && post.youtube_url ? [post.youtube_url, post.youtube_thumb_url] : work.youtube ? [work.youtube, work.youtubeThumb] : null;
    if (video) box.append(youtubeCard(video[0], video[1]));
    const more = make("a", "hero__card-more", post ? t("Read the news") : t("See the work"));
    more.href = post ? `news.html?post=${encodeURIComponent(post.slug)}` : workUrl(work.id);
    box.append(more);
    return box;
  };
  const EYE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  const EYE_OFF =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // The cards live in a layer just after the hero, outside its clipped
  // strips and curved mask, so a card is never cut off; each lines up with
  // its panel.
  const layer = make("div", "hero-cards");
  hero.after(layer);
  const cards = [];
  // Where a panel goes, and what it shows.
  const point = (panel, work) => {
    const post = newsFor.get(work.id);
    const link = panel.querySelector(".hero__link");
    link.href = post ? `news.html?post=${encodeURIComponent(post.slug)}` : workUrl(work.id);
    link.setAttribute("aria-label", post ? newsField(post, "title") : work.title);
    panel.classList.toggle("has-news", Boolean(post));
    const i = Number(panel.dataset.index);
    // The featured panel has its card (or the eye button) instead of a tag.
    panel.querySelector(".hero__tag").hidden = !post || i === 0;
    const next = card(work, post);
    // The featured work's card stays open, with an eye button to hide it.
    if (i === 0) {
      next.classList.add("is-pinned");
      const hide = make("button", "hero__eye");
      hide.type = "button";
      hide.innerHTML = EYE_OFF;
      hide.setAttribute("aria-label", t("Hide the news"));
      hide.title = t("Hide the news");
      hide.addEventListener("click", () => pin(false));
      next.querySelector(".hero__card-top").append(hide);
    }
    if (cards[i]) cards[i].replaceWith(next);
    else layer.append(next);
    cards[i] = next;
  };
  // Shown in the card's place while it's hidden: brings it back.
  const peek = make("button", "hero__peek");
  peek.type = "button";
  peek.innerHTML = EYE;
  peek.setAttribute("aria-label", t("Show the news"));
  peek.title = t("Show the news");
  peek.addEventListener("click", () => pin(true));
  layer.append(peek);
  let pinned = local.get("heroCard") !== "hidden";
  let hovered = -1;

  hero.style.setProperty("--n", count);
  hero.dataset.count = count;
  hero.replaceChildren(
    ...order.map((k, i) => {
      const work = picks[k];
      const panel = make("div", "hero__panel");
      panel.style.setProperty("--i", i);
      panel.dataset.index = i;
      const link = make("a", "hero__link");
      const tag = make("span", "hero__tag", t("News"));
      panel.append(art(work), link, tag);
      point(panel, work);
      return panel;
    })
  );
  const panels = [...hero.children];

  // ---------- Layout ----------
  // Each panel's share of the width: the main one 72%, the others an equal
  // share of the rest; a hovered strip on the right takes 55% of that side
  // while its neighbours narrow.
  const FEATURED = 0.72;
  const shares = (index) => {
    const n = panels.length;
    if (n === 1) return [1];
    const rest = 1 - FEATURED;
    return panels.map((_, i) =>
      i === 0 ? FEATURED : index > 0 && n > 2 ? (i === index ? rest * 0.55 : (rest * 0.45) / (n - 2)) : rest / (n - 1)
    );
  };
  const weights = shares(-1);
  let targets = weights.slice();
  let frame = 0;

  // Clip each panel to exactly what shows: its slanted strip, cut off along
  // the curved bottom edge, with its artwork box under the strip. Besides
  // looking the same as the mask, the clip keeps the hero from catching
  // clicks and drags meant for the cards that slide in underneath its curve.
  const layout = () => {
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    if (!W || !H) return;
    const css = getComputedStyle(hero);
    const slant = (parseFloat(css.getPropertyValue("--slant")) / 100) * W;
    const gap = parseFloat(css.getPropertyValue("--gap"));
    const total = W + slant;
    const sum = weights.reduce((a, b) => a + b, 0);
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

    let left = 0;
    panels.forEach((panel, i) => {
      const width = (total * weights[i]) / sum;
      const a = left;
      const b = left + width;
      left = b;
      const x0 = i === 0 ? -0.3 * W : a;
      const x1 = i === panels.length - 1 ? 1.3 * W : b;
      const [rx, ry] = meet(x1 - gap, x1 - slant - gap);
      const [lx, ly] = meet(x0 + gap, x0 - slant + gap);
      const points = [[x0 + gap, 0], [x1 - gap, 0], [rx, ry]];
      for (let x = rx - 8; x > lx; x -= 8) points.push([x, curve(x)]);
      points.push([lx, ly]);
      panel.style.clipPath = `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
      [...panel.querySelectorAll(".hero__art")].forEach((el) => {
        el.style.left = `${(a - slant).toFixed(1)}px`;
        el.style.width = `${(width + slant).toFixed(1)}px`;
      });
      // The tag and card sit in the strip's top corner, clear of the slant.
      const start = Math.max(a, 0) + gap + 18;
      panel.querySelector(".hero__tag").style.left = `${start.toFixed(1)}px`;
      const box = cards[i];
      box.style.top = `${18 - H}px`;
      box.style.left = `${Math.min(start, W - box.offsetWidth - 18).toFixed(1)}px`;
      if (i === 0) {
        peek.style.top = `${18 - H}px`;
        peek.style.left = `${start.toFixed(1)}px`;
      }
    });
  };

  // Eases the widths toward their targets, one frame at a time.
  const step = () => {
    let moving = false;
    weights.forEach((w, i) => {
      const next = w + (targets[i] - w) * 0.16;
      weights[i] = Math.abs(targets[i] - next) < 0.002 ? targets[i] : next;
      if (weights[i] !== targets[i]) moving = true;
    });
    layout();
    frame = moving ? requestAnimationFrame(step) : 0;
  };
  // Which cards are open: the hovered panel's, and the featured one's
  // unless it's been hidden.
  const showCards = () => {
    cards.forEach((box, i) => {
      const open = i === 0 ? pinned : i === hovered;
      box.classList.toggle("is-open", open);
      panels[i].classList.toggle("is-open", open);
    });
    peek.hidden = pinned;
    // A hovered strip's card covers its neighbours' tags; they step aside.
    hero.classList.toggle("is-hovering", hovered > 0);
  };
  const pin = (show) => {
    pinned = show;
    local.set("heroCard", show ? null : "hidden");
    showCards();
    (show ? cards[0].querySelector(".hero__eye") : peek).focus({ preventScroll: true });
  };
  const aim = (index) => {
    hovered = index;
    targets = shares(index);
    showCards();
    if (calm.matches) {
      targets.forEach((w, i) => (weights[i] = w));
      return layout();
    }
    if (!frame) frame = requestAnimationFrame(step);
  };
  const inside = (node) => node && (hero.contains(node) || layer.contains(node));
  panels.forEach((panel, i) => {
    panel.addEventListener("pointerenter", () => hover.matches && aim(i));
    panel.addEventListener("focusin", () => aim(i));
  });
  // Moving from a panel onto its card (or back) keeps it open.
  hero.addEventListener("pointerleave", (event) => !inside(event.relatedTarget) && aim(-1));
  layer.addEventListener("pointerleave", (event) => !inside(event.relatedTarget) && aim(-1));
  layer.addEventListener("focusout", (event) => !inside(event.relatedTarget) && aim(-1));
  hero.addEventListener("focusout", (event) => !inside(event.relatedTarget) && aim(-1));

  // With more works than panels, every few seconds one random panel that
  // isn't news or under the pointer crossfades to a work not on screen.
  const swap = () => {
    if (document.hidden || calm.matches) return;
    const shown = new Set(panels.map((p) => [...p.querySelectorAll(".hero__art")].pop().dataset.work));
    const options = withArt.filter((work) => work.hero && !shown.has(work.id) && !newsFor.has(work.id));
    const free = panels.filter(
      (p) => p.dataset.index !== "0" && !p.classList.contains("has-news") && !p.matches(":hover") && !cards[p.dataset.index].classList.contains("is-open")
    );
    if (!options.length || !free.length) return;
    const panel = free[Math.floor(Math.random() * free.length)];
    const work = options[Math.floor(Math.random() * options.length)];
    const next = art(work);
    next.classList.add("is-entering");
    panel.querySelector(".hero__link").before(next);
    point(panel, work);
    layout();
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove("is-entering")));
    setTimeout(() => {
      while (panel.querySelectorAll(".hero__art").length > 1) panel.querySelector(".hero__art").remove();
    }, 1600);
  };

  showCards();
  layout();
  new ResizeObserver(layout).observe(hero);
  if (withArt.filter((w) => w.hero).length > count) setInterval(swap, SWAP_EVERY);
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
    link.href = workUrl(work.id);
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
    setCoverScore(media, work.score, work.reviews);

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
  // (Only the currency group hides; the search box beside it stays.)
  const controls = section.querySelector(".works__controls .works__group");
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

// The average score in a cover's corner (home cards, poster cards, the work
// page's poster), once a work has ratings: "★ 8.4".
const coverScore = (score, count) => {
  if (!count) return null;
  const badge = document.createElement("span");
  badge.className = "cover-score";
  badge.translate = false;
  badge.setAttribute("aria-label", `${scoreText(score)}/10`);
  const star = document.createElement("span");
  star.className = "cover-score__star";
  star.textContent = "★";
  const value = document.createElement("b");
  value.textContent = scoreText(score);
  badge.append(star, value);
  return badge;
};
// Puts (or refreshes, or removes) the badge in a cover.
const setCoverScore = (frame, score, count) => {
  if (!frame) return;
  const old = frame.querySelector(":scope > .cover-score");
  const next = coverScore(score, count);
  if (old) old.remove();
  if (next) frame.append(next);
};

// A small poster card linking to a work's page (category rows, My List).
const posterCard = (work) => {
  const link = document.createElement("a");
  link.className = "poster-card";
  link.href = workUrl(work.id);
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
  setCoverScore(frame, work.score, work.reviews);
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

  // Top rated: by average score out of 10, pulled towards 6 while a work
  // has few ratings, so one 10 doesn't top the list.
  const ranked = (w) => (w.score * w.reviews + 6 * 3) / (w.reviews + 3);
  const rows = [
    ["Top rated", (w) => w.reviews > 0, (a, b) => ranked(b) - ranked(a)],
    ["Coming soon", (w) => ["coming", "preorder", "production"].includes(w.status)],
    ...KINDS,
  ];
  rows.forEach(([name, test, order]) => {
    const works = CATALOG.filter(test);
    if (order) works.sort(order);
    if (name === "Top rated" && works.length < 2) return;
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

// Section 5 — Subscriptions: the length buttons (7 days to a year) pick
// which prices show; prices use the same currency ticker as the work cards
// and follow the currency chosen there ("auto" keeps cycling).
(async function planPrices() {
  const boxes = [...document.querySelectorAll(".plan__amounts")];
  if (!boxes.length) return;

  // Prices are set in Rials in the admin panel; dollars and euros follow
  // the exchange rates there (marked "≈").
  const { settings } = await site;
  const rows = settings.plans || [];
  const rowOf = (id) => rows.find((row) => row.id === id) || {};
  const PER = { 7: "/ 7 days", 30: "/ month", 90: "/ 3 months", 180: "/ 6 months", 365: "/ year" };
  const offered = PLAN_LENGTHS.map(([d]) => d).filter((d) => rows.some((row) => row.prices && row.prices[d] != null));
  const lengthButtons = [...document.querySelectorAll(".plans__length")];
  lengthButtons.forEach((button) => (button.hidden = !offered.includes(Number(button.dataset.days))));
  let days = Number(local.get("planLength")) || 30;
  if (!offered.includes(days)) days = offered.includes(30) ? 30 : offered[0] || 30;

  // Each plan's lines and button from its settings; the member's own plan
  // is marked, and lower ones are already covered by it.
  const mine = savedMembership();
  const myRank = mine ? rowOf(mine.plan).rank || 0 : 0;
  document.querySelectorAll(".plan").forEach((card) => {
    const row = rowOf(card.dataset.plan);
    if (row.discount_percent != null) {
      const line = card.querySelector('[data-slot="discount"]');
      if (row.discount_percent) line.textContent = `${row.discount_percent}% off every work in the store`;
      else line.closest("li").remove();
    }
    if (row.free_kinds) {
      const line = card.querySelector('[data-slot="free"]');
      if (freeLine(row.free_kinds)) line.textContent = freeLine(row.free_kinds);
      else line.closest("li").remove();
    }
    if (mine && mine.plan === card.dataset.plan) {
      const tag = document.createElement("p");
      tag.className = "plan__current";
      tag.textContent = `Your plan · until ${dateText(mine.ends_at)}`;
      card.querySelector(".plan__blurb").after(tag);
    }
  });

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let mode = "auto";
  let current = 0;
  let CODES = [];
  let tickers = [];
  // Each box is as wide as the price it shows, so "/ month" sits right after.
  const fit = () =>
    boxes.forEach((box, b) => tickers[b] && tickers[b][current] && (box.style.width = `${tickers[b][current].offsetWidth}px`));
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

  // Shows every plan's price, saving and button for the chosen length.
  const render = () => {
    lengthButtons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.days) === days)));
    const plans = boxes.map((box) => pricesOf({ price_irr: (rowOf(box.dataset.plan).prices || {})[days] ?? null }, settings));
    CODES = ["USD", "EUR", "IRR"].filter((code) => plans.some((plan) => plan.prices[code] != null));
    if (mode !== "auto" && CODES.includes(mode)) current = CODES.indexOf(mode);
    if (current >= CODES.length) current = 0;
    tickers = boxes.map((box, b) => {
      box.closest(".plan__price").hidden = plans[b].prices.IRR == null;
      box.replaceChildren();
      return CODES.map((code, i) => {
        const span = document.createElement("span");
        span.className = "card__amount" + (i === current ? " is-active" : "");
        span.textContent = plans[b].prices[code] != null ? priceText(plans[b], code) : "";
        box.append(span);
        return span;
      });
    });
    document.querySelectorAll(".plan").forEach((card) => {
      const row = rowOf(card.dataset.plan);
      const prices = row.prices || {};
      card.querySelector(".plan__per").textContent = PER[days];
      // What the longer lengths save against paying month by month.
      const save = card.querySelector(".plan__save");
      const monthly = prices[30];
      const percent = days > 30 && monthly && prices[days] ? Math.round((1 - prices[days] / ((monthly * days) / 30)) * 100) : 0;
      save.hidden = percent < 1;
      if (percent >= 1) save.textContent = `Save ${percent}% against monthly`;
      const button = card.querySelector(".plan__button");
      button.classList.remove("is-soon");
      button.href = `checkout.html?plan=${encodeURIComponent(card.dataset.plan)}&days=${days}`;
      button.textContent = button.dataset.label || (button.dataset.label = button.textContent);
      const soon = (text) => {
        button.removeAttribute("href");
        button.classList.add("is-soon");
        button.textContent = text;
      };
      if (mine && mine.plan === card.dataset.plan) button.textContent = "Renew";
      else if (row.rank && row.rank < myRank) soon("Included in your plan");
      if (row.on_sale === false) soon("Not on sale right now");
      else if (prices[days] == null) soon("Not offered for this length");
    });
    fit();
  };
  render();
  lengthButtons.forEach((button) =>
    button.addEventListener("click", () => {
      days = Number(button.dataset.days);
      local.set("planLength", String(days));
      render();
    })
  );

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
  const target = SauFoxRoutes.loginReturn(next);
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
    ready.catch(() => {}); // reported when a token is asked for
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
          result = await account.auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce,
            options: { captchaToken: await captcha() },
          });
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
  // Released works are theirs now; pre-orders arrive on release day. Works
  // with files (builds) get a download button for each.
  const DOWNLOAD_ERRORS = {
    limit: "You've downloaded this file many times today. Try again tomorrow, or write to us.",
    not_configured: "Downloads aren't open yet. Try again soon.",
    signed_out: "Your session has ended. Log in again to download.",
  };
  const downloadButton = (build) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "library-item__download";
    const label = `${PLATFORMS[build.platform] || PLATFORMS.other} · v${build.version}`;
    const size = fileSize(build.size_bytes);
    button.textContent = size ? `${label} · ${size}` : label;
    button.addEventListener("click", async () => {
      const item = button.closest(".library-item");
      const problem = item.querySelector(".library-item__problem");
      button.disabled = true;
      problem.textContent = "";
      const answer = await library({ action: "download", build_id: build.id, source: "site" }, await verifiedSession());
      button.disabled = false;
      if (answer.url) location.href = answer.url;
      else problem.textContent = DOWNLOAD_ERRORS[answer.error] || "The download didn't start. Check your connection and try again.";
    });
    return button;
  };
  // A game's key, shown under its card, with a button to copy it.
  const keyLine = (code) => {
    const wrap = document.createElement("div");
    wrap.className = "library-key";
    const value = document.createElement("code");
    value.className = "library-key__code selectable";
    value.textContent = code;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "library-key__copy";
    copy.textContent = t("Copy");
    copy.setAttribute("aria-label", t("Copy key"));
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code);
        copy.textContent = t("Copied");
        setTimeout(() => (copy.textContent = t("Copy")), 1500);
      } catch (e) {
        const range = document.createRange();
        range.selectNodeContents(value);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
    wrap.append(value, copy);
    return wrap;
  };
  const showLibrary = async () => {
    const { data, error } = await account.rpc("my_licenses");
    if (error || !data.length) return;
    const works = await catalog;
    // Only files of owned works come back (row-level security).
    const { data: builds } = await account
      .from("builds")
      .select("id, work_id, platform, version, size_bytes, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false });
    const cards = data
      .map((lic) => {
        const work = works.find((w) => w.id === lic.work_id);
        if (!work) return null;
        const card = posterCard(work);
        const note = document.createElement("span");
        note.className = "poster-card__note";
        note.textContent =
          (work.status === "released" ? "Yours" : "Pre-ordered · arrives on release day") + (lic.mine ? "" : " · gift");
        card.append(note);
        const item = document.createElement("div");
        item.className = "library-item";
        item.append(card, keyLine(lic.code));
        // The newest file for each platform.
        const files = (builds || [])
          .filter((b) => b.work_id === work.id)
          .filter((b, i, all) => all.findIndex((other) => other.platform === b.platform) === i);
        if (files.length) {
          const problem = document.createElement("span");
          problem.className = "library-item__problem";
          problem.setAttribute("role", "status");
          item.append(...files.map(downloadButton), problem);
        }
        return item;
      })
      .filter(Boolean);
    if (!cards.length) return;
    const grid = document.createElement("div");
    grid.className = "poster-grid";
    grid.append(...cards);
    (document.querySelector(".library-body") || document.getElementById("panel-library")).replaceChildren(grid);
  };

  // Redeeming a key from the library tab.
  const redeem = document.querySelector(".redeem");
  if (redeem) {
    const REDEEM_ERRORS = {
      SF030: "Log in again to add a key.",
      SF031: "That key isn't valid. Check it and try again.",
      SF032: "That key is already on another account.",
    };
    const message = redeem.querySelector(".redeem__message");
    redeem.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = redeem.elements.code.value.trim();
      if (code.replace(/[^A-Za-z0-9]/g, "").length < 8) return (message.textContent = t("Enter your game key."));
      const button = redeem.querySelector(".redeem__button");
      button.disabled = true;
      message.classList.remove("is-ok");
      const { data, error } = await account.rpc("redeem_license", { p_code: code });
      button.disabled = false;
      if (error) return (message.textContent = t(REDEEM_ERRORS[error.code] || "That key couldn't be added. Try again."));
      const row = data && data[0];
      message.classList.add("is-ok");
      message.textContent = row && row.already ? t("That game is already in your library.") : t("Added to your library.");
      redeem.reset();
      showLibrary();
    });
  }

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
      thumb.href = workUrl(work.id);
      thumb.setAttribute("aria-label", order.title);
      if (work.images[0]) {
        const img = make("img");
        img.src = work.images[0];
        img.alt = "";
        img.loading = "lazy";
        thumb.append(img);
      }
    }
    if (order.plan_id) {
      thumb.classList.add("order__thumb--plan", `is-${order.plan_id}`);
      thumb.textContent = planName(order.plan_id);
    }
    const text = make("div", "order__text");
    const title = make("strong", "", order.plan_id ? `${planName(order.plan_id)} plan` : order.title);
    title.translate = Boolean(order.plan_id); // work titles stay as they are
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
          .select("id, number, work_id, plan_id, title, amount_irr, status, created_at, ref_id")
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
      .select("id, number, work_id, plan_id, title, amount_irr, status, created_at, ref_id")
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
  showLibrary();
  // The member's plan, beside their email.
  myMembership().then((mine) => {
    if (!mine) return;
    const head = page.querySelector(".profile-head__plan");
    const badge = head.querySelector(".plan-badge");
    badge.textContent = `${planName(mine.plan)} plan · until ${dateText(mine.ends_at)}`;
    badge.classList.add(`is-${mine.plan}`);
    const link = head.querySelector("a");
    if (link) {
      link.href = `checkout.html?plan=${encodeURIComponent(mine.plan)}`;
      link.textContent = "Renew";
    }
  });
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

  // ---------- Account: email, password, deleting it ----------
  const accountForm = (name) => {
    const f = page.querySelector(`[data-form="${name}"]`);
    const note = f.querySelector(".auth__message");
    return {
      form: f,
      button: f.querySelector('[type="submit"]'),
      say: (text, ok) => {
        note.textContent = text;
        note.classList.toggle("is-ok", Boolean(ok));
      },
    };
  };

  // Email: Supabase sends a confirmation link (to the new address, and to
  // the old one too when secure email change is on); it changes once
  // they're followed.
  const email = accountForm("email");
  email.form.querySelector('[data-slot="current-email"]').textContent = user.email;
  email.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const next = email.form.querySelector("#new-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return email.say("Enter a valid email address.");
    if (next.toLowerCase() === (user.email || "").toLowerCase()) return email.say("That's already your email.");
    email.button.disabled = true;
    email.say("Sending…", true);
    const { error } = await account.auth.updateUser({ email: next });
    email.button.disabled = false;
    if (error)
      return email.say(
        /already|exists|registered/i.test(error.message)
          ? "Another account already uses that email."
          : "Your email wasn't changed. Check your connection and try again."
      );
    email.form.reset();
    email.say("We've emailed a confirmation link. Your email changes once you follow it (check both inboxes).", true);
  });

  // Password: same rules as sign-up. If Supabase asks to confirm it's
  // really them, a code is emailed and the form asks for it.
  const password = accountForm("password");
  const codeRow = password.form.querySelector('[for="password-code"]');
  const codeInput = password.form.querySelector("#password-code");
  password.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const first = password.form.querySelector("#new-password").value;
    const again = password.form.querySelector("#new-password-again").value;
    if (first.length < 8) return password.say("Use at least 8 characters.");
    if (first !== again) return password.say("The two passwords don't match.");
    password.button.disabled = true;
    password.say("Checking…", true);
    if (await leakedPassword(first)) {
      password.button.disabled = false;
      return password.say(LEAKED_PASSWORD);
    }
    const nonce = codeRow.hidden ? undefined : codeInput.value.trim();
    const { error } = await account.auth.updateUser(nonce ? { password: first, nonce } : { password: first });
    if (error && !nonce && /reauthenticat/i.test(`${error.code} ${error.message}`)) {
      await account.auth.reauthenticate();
      codeRow.hidden = false;
      codeInput.focus();
      password.button.disabled = false;
      return password.say("For your security, we've emailed you a code. Enter it and press Change password again.", true);
    }
    password.button.disabled = false;
    if (error)
      return password.say(
        /same|different/i.test(error.message)
          ? "That's your current password. Choose a new one."
          : nonce
            ? "That code didn't work. Check it and try again."
            : "Your password wasn't changed. Check your connection and try again."
      );
    password.form.reset();
    codeRow.hidden = true;
    password.say("Password changed.", true);
  });

  // Deleting the account (Edge Function "account"): type the email to confirm.
  const remove = accountForm("delete");
  remove.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const typed = remove.form.querySelector("#delete-confirm").value.trim();
    if (typed.toLowerCase() !== (user.email || "").toLowerCase()) return remove.say("Type your account's email exactly to confirm.");
    remove.button.disabled = true;
    remove.say("Deleting your account…", true);
    const answer = await callFunction("account", { action: "delete", confirm: typed }, await verifiedSession());
    if (!answer.ok) {
      remove.button.disabled = false;
      return remove.say(
        answer.error === "admin"
          ? "Admin accounts can't be deleted here."
          : answer.error === "signed_out"
            ? "Your session has ended. Log in again, then try once more."
            : "Your account wasn't deleted. Try again in a moment."
      );
    }
    try {
      await account.auth.signOut({ scope: "local" });
    } catch (e) {}
    ["session", "name", "avatar", "admin", "email", "since", "hasAccount", "phone", "currency"].forEach((key) => local.set(key, null));
    location.replace("index.html");
  });
})();

// Title page (work.html?id=<id>) — one page per work in the catalogue: key art,
// name, poster, facts, trailer and buy actions, a countdown to the trailer,
// synopsis, gallery and credits. Sections without data stay hidden.
(async function titlePage() {
  const page = document.querySelector(".title-page");
  if (!page) return;
  const CATALOG = await catalog;

  const id = currentWorkId();
  const work = CATALOG.find((w) => w.id === id);
  if (!work) {
    page.querySelectorAll(":scope > section:not(.title-missing)").forEach((s) => (s.hidden = true));
    page.querySelector(".title-missing").hidden = false;
    document.title = "Not found · SauFox Entertainment";
    setMeta('meta[name="robots"]', "content", "noindex");
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
  pageMeta({
    path: workUrl(work.id),
    title: `${work.title} · SauFox Entertainment`,
    description: work.synopsis || `${work.title} — ${work.kind} by SauFox Entertainment.`,
    image: work.images[0],
  });

  // Key art, kicker and name
  const art = page.querySelector(".title-hero__art");
  art.style.backgroundImage = `url("${work.hero || work.images[0]}")`;
  if (work.heroFocus) art.style.backgroundPosition = work.heroFocus;
  const kicker = page.querySelector(".title-head__kicker");
  kicker.append(work.kind, " \u00b7 ", make("b", "", STATUS[work.status] || ""));
  page.querySelector(".title-head__name").textContent = work.title;

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
    const detail = make("dd", "", label === "Age rating" && /^\d+\+?$/.test(value) ? digits(value) : value);
    if (label === "Age rating") detail.dir = "ltr";
    row.append(make("dt", "", label), detail);
    factList.append(row);
  });
  factList.hidden = !factList.children.length;

  // Members: the work's price with their plan's discount (as the database
  // works it out), and whether their plan lets them watch or read it free.
  myMembership().then(async (mine) => {
    if (!mine) return;
    const note = make("p", `member-price is-${mine.plan}`);
    if ((mine.free_kinds || []).includes(kindClass(work.kind))) {
      note.append(make("strong", "", kindClass(work.kind) === "novel" ? "Free to read with your plan" : "Free to watch with your plan"));
    } else if (work.prices && work.prices.IRR != null) {
      const { data } = await account.rpc("price_for", { work: work.id });
      if (!data || !data.member_discount) return;
      note.append(make("strong", "", `Your ${planName(mine.plan)} price: ${money.IRR(data.total)}`), ` (${mine.discount_percent}% off)`);
    } else return;
    factList.after(note);
  });

  // Actions: the trailer once it's out, otherwise its date; buying isn't
  // open yet.
  const play = page.querySelector('[data-action="trailer"]');
  const trailerSoon = page.querySelector('[data-slot="trailer-soon"]');
  // The trailer on YouTube: its thumbnail, under the actions.
  if (youtubeId(work.youtube)) {
    const video = youtubeCard(work.youtube, work.youtubeThumb, "Watch the trailer on YouTube");
    video.classList.add("title-video");
    page.querySelector(".title-actions").after(video);
  }
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
      const { data: owned, error: ownershipError } = await account.rpc("owns_work", { p_work: work.id });
      if (ownershipError) return;
      if (owned) {
        buy.hidden = false; buySoon.hidden = true;
        buy.href = "profile.html#library"; buy.classList.add("is-ordered");
        buyLabel.textContent = "In your library";
        return;
      }
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
      buy.href = "profile.html#orders";
      buy.classList.add("is-ordered");
      buyLabel.textContent = paid ? "View order" : "Ordered · awaiting payment";
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

  // Cast & crew: whoever directs or writes first, larger and set apart, with
  // all their roles; then the crew, then the cast. Every section keeps the
  // admin panel's order; each group
  // showing a dozen people until it's opened. Without a photo, the
  // person's initials stand in.
  if (work.credits && work.credits.length) {
    const box = page.querySelector(".title-credits__groups");
    const SHOWN = 12;
    const person = (credit, lead) => {
      const cast = !lead && creditPlace(credit.roles, credit.department) === "cast";
      const item = make("li", lead ? "credit credit--lead" : cast ? "credit credit--cast" : "credit");
      const face = make("span", "credit__face");
      if (credit.photo) {
        const img = make("img");
        img.src = credit.photo;
        img.alt = "";
        img.loading = "lazy";
        face.append(img);
      } else {
        const initials = credit.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word[0])
          .join("");
        face.append(make("span", "credit__initials", initials.toUpperCase()));
        face.translate = false;
      }
      const text = make("span", "credit__text");
      const name = make("strong", "credit__name", credit.name);
      name.translate = false;
      name.dir = "auto";
      // Each role in this page's language when it's a known one.
      // In the AI Assistant section the heading already says so; the role
      // line shows what else they did.
      const other = creditPlace(credit.roles, credit.department) === "ai" ? credit.roles.filter((r) => !AI.test(r)) : [];
      const shownRoles = other.length ? other : credit.roles;
      const role = make("span", "credit__role", shownRoles.map((r) => t(r)).join(" · "));
      role.translate = false;
      role.dir = "auto";
      // A lead's job reads first, as a label. The cast show the character
      // they play, with their own name smaller under it.
      if (lead) {
        role.className = "credit__label";
        text.append(role, name);
        if (credit.character && credit.roles.some(PLAYS.test)) {
          const character = make("span", "credit__role", credit.character);
          character.translate = false;
          character.dir = "auto";
          text.append(character);
        }
      } else if (credit.character && credit.roles.some(PLAYS.test)) {
        const character = make("strong", "credit__character", credit.character);
        character.translate = false;
        character.dir = "auto";
        name.className = "credit__player";
        text.append(character, name, role);
      } else text.append(name, role);
      item.append(face, text);
      return item;
    };
    const leads = work.credits.filter(creditTaxonomy.isLead);
    if (leads.length) {
      const list = make("ul", "title-credits__leads");
      list.append(...leads.map((credit) => person(credit, true)));
      box.append(list);
    }
    const leadSet = new Set(leads);
    const groups = creditTaxonomy.groups.map((department) => [department, work.credits.filter((credit) =>
      !leadSet.has(credit) && creditPlace(credit.roles, credit.department) === department.id
    )]).filter(([, people]) => people.length);
    groups.forEach(([department, people]) => {
      const group = make("div", "title-credits__group");
      group.dataset.department = department.id;
      group.append(make("h3", "title-credits__heading", department.en));
      const list = make("ul", department.id === "cast" ? "title-credits__list title-credits__list--cast" : "title-credits__list");
      list.append(...people.map((credit) => person(credit)));
      group.append(list);
      if (people.length > SHOWN) {
        list.classList.add("is-folded");
        const more = make("button", "title-credits__more", `Show all ${people.length}`);
        more.type = "button";
        more.addEventListener("click", () => {
          list.classList.remove("is-folded");
          more.remove();
        });
        group.append(more);
      }
      box.append(group);
    });
    page.querySelector('[data-slot="credits-count"]').textContent = digits(work.credits.length);
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

// "Notify me" on a work that isn't out yet: the member gets an email when
// it's released (and when its trailer arrives, if that comes first). The
// database queues the emails; the payment function sends them.
(async function notifyButton() {
  const button = document.querySelector('[data-action="notify"]');
  if (!button || !account) return;
  const id = currentWorkId();
  const work = (await catalog).find((w) => w.id === id);
  if (!work || work.status === "released") return;
  const label = button.querySelector("span");
  const show = (on) => {
    button.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "We'll email you" : "Notify me";
    button.title = on
      ? "You'll get an email when it's out. Press again to stop."
      : "Get an email when it's out, and when the trailer arrives.";
  };
  show(false);
  button.hidden = false;
  const session = await verifiedSession();
  if (session) {
    const { data } = await account
      .from("work_alerts")
      .select("work_id")
      .eq("user_id", session.user.id)
      .eq("work_id", work.id)
      .maybeSingle();
    show(Boolean(data));
  }
  button.addEventListener("click", async () => {
    const now = await verifiedSession();
    if (!now) {
      local.set("next", workReturn());
      location.href = "login.html";
      return;
    }
    const on = button.getAttribute("aria-pressed") === "true";
    button.disabled = true;
    const { error } = on
      ? await account.from("work_alerts").delete().eq("user_id", now.user.id).eq("work_id", work.id)
      : await account.from("work_alerts").insert({ work_id: work.id, lang: LANG });
    button.disabled = false;
    if (!error || error.code === "23505") show(!on);
  });
})();

// Scores are out of 10, as on IMDb: a gold star, the score, then "/10".
const starsFor = (score, className = "stars") => {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = "★";
  el.setAttribute("aria-hidden", "true");
  return el;
};
const scoreText = (score) => num(score, 1);
// A count as IMDb writes it: 950, 1.2K, 3.4M.
const compact = (n) =>
  n >= 1e6 ? `${num(n / 1e6, 1)}${LANG === "fa" ? " میلیون" : "M"}` : n >= 1e3 ? `${num(n / 1e3, 1)}${LANG === "fa" ? " هزار" : "K"}` : num(n);
// An average keeps one decimal (8.0); one person's rating is whole (9).
const scoreOf = (score, className = "score", whole = false) => {
  const el = document.createElement("span");
  el.className = className;
  el.translate = false;
  el.dir = "ltr";
  const value = document.createElement("b");
  value.textContent = whole ? num(score) : scoreText(score);
  const out = document.createElement("small");
  out.textContent = `/${digits(10)}`;
  el.append(starsFor(score), value, out);
  return el;
};

// Ratings and reviews on a work's page (work.html#reviews). Members write
// one each: stars and a comment once the work is released, a comment
// before. The database fills in their name, whether they bought it, and
// the work's totals; the studio can hide a review or reply to it.
(async function reviewsSection() {
  const section = document.querySelector(".title-reviews");
  if (!section || !account) return;
  const id = currentWorkId();
  const work = (await catalog).find((w) => w.id === id);
  if (!work) return;
  const released = work.status === "released";
  const PAGE = 10;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const form = section.querySelector(".review-form");
  const bodyInput = form.querySelector("textarea");
  const message = form.querySelector(".auth__message");
  const submit = form.querySelector(".review-form__submit");
  const formRate = form.querySelector(".review-form__rate");
  const list = section.querySelector(".reviews__list");
  const empty = section.querySelector(".reviews__empty");
  const more = section.querySelector(".reviews__more");
  const say = (text, ok) => {
    message.textContent = text;
    message.classList.toggle("is-ok", Boolean(ok));
  };

  section.querySelector("#reviews-title").textContent = released ? "Ratings & reviews" : "Comments";
  form.querySelector(".review-form__title").textContent = released ? "Your review" : "Your comment";
  // (Text boxes are left out of the page translation, so this one's done here.)
  bodyInput.placeholder = t(released ? "What did you think?" : "Your thoughts or questions about it…");
  empty.textContent = released ? "No reviews yet. Be the first." : "No comments yet. Be the first.";
  section.querySelector(".reviews__login span").textContent = released ? "to rate and review." : "to comment.";
  section.hidden = false;

  // ---------- Beside the title, as on IMDb: the SauFox rating and yours ----------
  // "Your rating" opens a box of ten stars; rating needs no written review.
  let box = null;
  const showAverage = (score, count) => {
    if (!box) return;
    const average = box.querySelector(".title-rating__average");
    average.hidden = !count;
    if (!count) return;
    const value = average.querySelector(".title-rating__value");
    const total = make("small", "title-rating__count", compact(count));
    total.translate = false;
    value.replaceChildren(scoreOf(score, "score score--head"), total);
  };
  const showMine = () => {
    if (!box) return;
    const mine = box.querySelector(".title-rating__mine");
    if (!released) return mine.replaceChildren(make("span", "stars stars--empty", "☆"), make("span", "", "Opens at release"));
    const value = own && own.rating;
    mine.classList.toggle("is-rated", Boolean(value));
    if (value) {
      const rated = make("span", "score score--mine");
      rated.translate = false;
      rated.dir = "ltr";
      rated.append(make("span", "stars", "★"), make("b", "", digits(value)), make("small", "", `/${digits(10)}`));
      mine.replaceChildren(rated);
    } else mine.replaceChildren(make("span", "stars stars--empty", "☆"), make("span", "", "Rate"));
  };
  const rateDialog = () => {
    const dialog = make("dialog", "rate-dialog");
    const close = make("button", "rate-dialog__close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    const big = make("div", "rate-dialog__big");
    const bigValue = make("b", "", "?");
    bigValue.translate = false;
    big.append(make("span", "", "★"), bigValue);
    const title = make("strong", "rate-dialog__work", work.title);
    title.translate = false;
    const stars = make("div", "rate-dialog__stars");
    stars.setAttribute("role", "radiogroup");
    stars.setAttribute("aria-label", "Your rating");
    let pick = (own && own.rating) || 0;
    const show = (value) => {
      bigValue.textContent = value ? digits(value) : "?";
      big.classList.toggle("is-set", Boolean(value));
      stars.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", Number(b.dataset.star) <= value));
    };
    for (let n = 1; n <= 10; n++) {
      const star = make("button", "", "★");
      star.type = "button";
      star.dataset.star = n;
      star.setAttribute("role", "radio");
      star.setAttribute("aria-label", `${n}/10`);
      star.addEventListener("mouseenter", () => show(n));
      star.addEventListener("focus", () => show(n));
      star.addEventListener("click", () => {
        pick = n;
        done.disabled = false;
        stars.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.star) === n)));
        show(n);
      });
      stars.append(star);
    }
    stars.addEventListener("mouseleave", () => show(pick));
    const note = make("p", "auth__message");
    note.setAttribute("role", "status");
    const done = make("button", "rate-dialog__submit", "Rate");
    done.type = "button";
    done.disabled = !pick;
    const clear = make("button", "rate-dialog__clear", "Remove rating");
    clear.type = "button";
    clear.hidden = !(own && own.rating);
    dialog.append(close, big, make("span", "rate-dialog__label", "Rate this"), title, stars, note, done, clear);
    document.body.append(dialog);
    const shut = () => {
      dialog.close();
      dialog.remove();
    };
    close.addEventListener("click", shut);
    dialog.addEventListener("click", (event) => event.target === dialog && shut());
    dialog.addEventListener("close", () => dialog.remove());
    const saved = (data) => {
      own = data;
      if (data && data.rating) ratingOf.set(session.user.id, data.rating);
      else ratingOf.delete(session.user.id);
      fillForm();
      showMine();
      loadPage(true);
      showSummary();
      shut();
    };
    done.addEventListener("click", async () => {
      done.disabled = true;
      note.textContent = "Saving…";
      const { data, error } = own
        ? await account.from("reviews").update({ rating: pick }).eq("id", own.id).select(FIELDS).single()
        : await account.from("reviews").insert({ work_id: work.id, rating: pick }).select(FIELDS).single();
      done.disabled = false;
      if (error) return (note.textContent = "Not saved. Check your connection and try again.");
      saved(data);
    });
    clear.addEventListener("click", async () => {
      clear.disabled = true;
      // A written review stays, without its stars; a bare rating goes.
      const { data, error } = own.body
        ? await account.from("reviews").update({ rating: null }).eq("id", own.id).select(FIELDS).single()
        : await account.from("reviews").delete().eq("id", own.id).then((res) => ({ ...res, data: null }));
      clear.disabled = false;
      if (error) return (note.textContent = "Not saved. Check your connection and try again.");
      saved(data);
    });
    dialog.showModal();
    show(pick);
  };
  // Before release the stars wait ("Opens at release"); comments are open
  // either way, and the last item jumps down to them.
  const rateBox = () => {
    box = make("div", "title-rating");
    const average = make("a", "title-rating__item title-rating__average");
    average.href = "#reviews";
    average.hidden = true;
    average.append(make("span", "title-rating__label", "SauFox rating"), make("span", "title-rating__value"));
    const yours = make("div", "title-rating__item");
    const mine = make("button", "title-rating__mine");
    mine.type = "button";
    mine.addEventListener("click", () => (session ? rateDialog() : needLogin()));
    if (!released) {
      mine.disabled = true;
      mine.classList.add("is-waiting");
    }
    yours.append(make("span", "title-rating__label", "Your rating"), mine);
    const talk = make("a", "title-rating__item title-rating__talk");
    talk.href = "#reviews";
    talk.append(
      make("span", "title-rating__label", released ? "User reviews" : "Comments"),
      make("span", "title-rating__go", "Read and write")
    );
    talk.addEventListener("click", (event) => {
      event.preventDefault();
      section.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", location.pathname + location.search + "#reviews");
    });
    box.append(average, yours, talk);
    document.querySelector(".title-head").append(box);
    showMine();
  };

  // ---------- Summary: average, count and a bar for each star ----------
  const showSummary = async () => {
    // How many comments or reviews there are, beside the title.
    const { count: talked } = await account
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("work_id", work.id)
      .eq("hidden", false);
    const go = box && box.querySelector(".title-rating__go");
    if (go) go.textContent = talked ? `${compact(talked)} · ${t("Read and write")}` : t("Be the first");
    if (!released) return;
    const { data: totals, error: totalsError } = await account.from("works").select("review_count, review_sum").eq("id", work.id).maybeSingle();
    // Couldn't ask: leave what the page already shows.
    if (totalsError || !totals) return;
    const count = totals.review_count || 0;
    const summary = section.querySelector(".reviews__summary");
    summary.hidden = !count;
    // The score beside the title (see rateBox), linking down here.
    const score = count ? totals.review_sum / count : 0;
    showAverage(score, count);
    if (!count) return;
    section.querySelector('[data-slot="score"]').replaceChildren(scoreOf(score, "score score--big"));
    section.querySelector('[data-slot="count"]').textContent =
      count === 1 ? "1 rating" : `${num(count)} ratings`;
    const counts = await Promise.all(
      [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((star) =>
        account
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("work_id", work.id)
          .eq("hidden", false)
          .eq("rating", star)
          .then(({ count: n }) => n || 0)
      )
    );
    const bars = section.querySelector(".reviews__bars");
    bars.replaceChildren(
      ...counts.map((n, i) => {
        const row = make("li", "reviews__bar");
        const fill = make("span", "reviews__bar-fill");
        fill.style.setProperty("--share", `${(n / count) * 100}%`);
        const track = make("span", "reviews__bar-track");
        track.append(fill);
        row.append(make("span", "", `${digits(10 - i)} ★`), track, make("span", "reviews__bar-count", num(n)));
        return row;
      })
    );
  };

  // ---------- The list, newest first ----------
  const reviewItem = (review, mine) => {
    const item = make("li", mine ? "review review--mine" : "review");
    const avatar = make("img", "review__avatar");
    avatar.src = review.author_avatar || "assets/avatar-default.svg";
    avatar.alt = "";
    avatar.loading = "lazy";
    avatar.onerror = () => (avatar.src = "assets/avatar-default.svg");
    const main = make("div", "review__main");
    const head = make("div", "review__head");
    const name = make("strong", "review__name", review.author_name || "Member");
    name.translate = false;
    head.append(name);
    if (review.owner) head.append(make("span", "review__badge", "Bought it"));
    if (review.rating) head.append(scoreOf(review.rating, "score score--small", true));
    head.append(make("time", "review__date", dateText(review.created_at)));
    main.append(head);
    // An author's comment shows their rating (kept on its own row) too.
    const stars = review.rating || ratingOf.get(review.user_id);
    if (!review.rating && stars) head.insertBefore(scoreOf(stars, "score score--small", true), head.querySelector(".review__date"));
    if (review.body) {
      const text = make("p", "review__body", review.body);
      text.dir = "auto";
      main.append(text);
    }
    if (review.reply) {
      const reply = make("div", "review__reply");
      const replyText = make("p", "", review.reply);
      replyText.dir = "auto";
      reply.append(make("strong", "", "SauFox Entertainment"), replyText);
      main.append(reply);
    }
    if (mine && review.hidden) main.append(make("p", "review__note", "The studio has hidden this from others."));
    // Their own: Edit turns the text into a box right here, with Save,
    // Cancel and Delete (pressed twice).
    if (mine) {
      const actions = make("div", "review__actions");
      const edit = make("button", "review__action", "Edit");
      edit.type = "button";
      edit.addEventListener("click", () => editInPlace(review, main, actions));
      actions.append(edit);
      main.append(actions);
    }
    if (mine && review.helpful_count)
      main.append(make("p", "review__helped", review.helpful_count === 1 ? "1 person found this helpful" : `${num(review.helpful_count)} people found this helpful`));
    if (!mine) main.append(reviewActions(review));
    item.append(avatar, main);
    return item;
  };

  const editInPlace = (review, main, actions) => {
    const text = main.querySelector(".review__body");
    const box = make("form", "review-edit");
    box.noValidate = true;
    const input = make("textarea");
    input.rows = 3;
    input.maxLength = 2000;
    input.dir = "auto";
    input.autocomplete = "off";
    input.value = review.body || "";
    const note = make("p", "auth__message");
    note.setAttribute("role", "status");
    const del = make("button", "review-form__delete", "Delete");
    del.type = "button";
    const back = make("button", "review-form__cancel", "Cancel");
    back.type = "button";
    const save = make("button", "review-form__submit", "Save changes");
    save.type = "submit";
    const foot = make("div", "review-form__foot");
    foot.append(note, del, back, save);
    box.append(input, foot);
    if (text) text.replaceWith(box);
    else main.querySelector(".review__head").after(box);
    actions.hidden = true;
    input.focus();
    const close = () => {
      box.replaceWith(text || "");
      actions.hidden = false;
    };
    back.addEventListener("click", close);
    box.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = input.value.trim();
      if (!body && !review.rating) return (note.textContent = t("Write something, or delete it."));
      save.disabled = true;
      const { error } = await account.from("reviews").update({ body: body || null }).eq("id", review.id);
      save.disabled = false;
      if (error) return (note.textContent = t("Not saved. Check your connection and try again."));
      loadPage(true);
    });
    del.addEventListener("click", async () => {
      // Press twice: the first press asks.
      if (!del.dataset.armed) {
        del.dataset.armed = "1";
        del.textContent = t("Tap again to delete");
        setTimeout(() => {
          delete del.dataset.armed;
          del.textContent = t("Delete");
        }, 4000);
        return;
      }
      del.disabled = true;
      // The row with their rating keeps the stars and loses only the text.
      const { error } = review.rating
        ? await account.from("reviews").update({ body: null }).eq("id", review.id)
        : await account.from("reviews").delete().eq("id", review.id);
      del.disabled = false;
      if (error) return (note.textContent = t("Not deleted. Try again."));
      if (own && own.id === review.id) own.body = null;
      loadPage(true);
      showSummary();
    });
  };

  // ---------- "Helpful" and "Report" under others' reviews ----------
  const voted = new Set();
  const reported = new Set();
  const needLogin = () => {
    local.set("next", workReturn("#reviews"));
    location.href = "login.html";
  };
  const REASONS = [
    ["spam", "Spam or ads"],
    ["offensive", "Offensive or abusive"],
    ["spoiler", "Spoilers"],
    ["other", "Something else"],
  ];
  const reviewActions = (review) => {
    const box = make("div", "review__actions");
    const helpful = make("button", "review__action review__action--helpful");
    helpful.type = "button";
    const showHelpful = () => {
      const on = voted.has(review.id);
      helpful.setAttribute("aria-pressed", String(on));
      helpful.textContent = review.helpful_count ? `Helpful · ${num(review.helpful_count)}` : "Helpful";
    };
    showHelpful();
    helpful.addEventListener("click", async () => {
      if (!session) return needLogin();
      const on = voted.has(review.id);
      helpful.disabled = true;
      const { error } = on
        ? await account.from("review_votes").delete().eq("review_id", review.id).eq("user_id", session.user.id)
        : await account.from("review_votes").insert({ review_id: review.id });
      helpful.disabled = false;
      if (error && error.code !== "23505") return;
      if (on) voted.delete(review.id);
      else voted.add(review.id);
      review.helpful_count = Math.max(0, (review.helpful_count || 0) + (on ? -1 : 1));
      showHelpful();
    });

    const report = make("button", "review__action", reported.has(review.id) ? "Reported" : "Report");
    report.type = "button";
    report.disabled = reported.has(review.id);
    report.addEventListener("click", () => {
      if (!session) return needLogin();
      if (box.querySelector(".report-form")) return;
      const form = make("form", "report-form");
      form.noValidate = true;
      const choices = make("div", "report-form__reasons");
      choices.setAttribute("role", "radiogroup");
      choices.setAttribute("aria-label", "Why are you reporting this?");
      REASONS.forEach(([value, label], i) => {
        const option = make("label", "report-form__reason");
        const radio = make("input");
        radio.type = "radio";
        radio.name = `reason-${review.id}`;
        radio.value = value;
        radio.checked = i === 0;
        option.append(radio, make("span", "", label));
        choices.append(option);
      });
      const note = make("textarea");
      note.rows = 2;
      note.maxLength = 500;
      note.dir = "auto";
      note.placeholder = t("Anything else we should know? (optional)");
      const say = make("p", "auth__message");
      say.setAttribute("role", "status");
      const send = make("button", "review-form__submit", "Send report");
      send.type = "submit";
      const cancel = make("button", "review-form__delete", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", () => form.remove());
      const foot = make("div", "review-form__foot");
      foot.append(say, cancel, send);
      form.append(make("strong", "report-form__title", "Report this review"), choices, note, foot);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        send.disabled = true;
        const reason = form.querySelector("input:checked").value;
        const { error } = await account
          .from("review_reports")
          .insert({ review_id: review.id, reason, note: note.value.trim() || null });
        send.disabled = false;
        if (error && error.code !== "23505") {
          say.textContent = "Not sent. Check your connection and try again.";
          return;
        }
        reported.add(review.id);
        form.remove();
        report.textContent = "Reported. Thanks, we'll take a look.";
        report.disabled = true;
      });
      box.append(form);
      form.querySelector("input").focus();
    });
    box.prepend(helpful, report);
    return box;
  };

  const FIELDS = "id, user_id, rating, body, author_name, author_avatar, owner, hidden, reply, created_at, helpful_count";
  let shown = 0;
  // Their rating (the one row with stars); comments are rows without.
  let own = null;
  let session = null;
  // Authors' ratings, to show beside their comments.
  const ratingOf = new Map();
  const learnRatings = async (rows) => {
    const ids = [...new Set(rows.map((r) => r.user_id))].filter((id) => !ratingOf.has(id));
    if (!released || !ids.length) return;
    const { data } = await account.from("reviews").select("user_id, rating").eq("work_id", work.id).in("user_id", ids).not("rating", "is", null);
    (data || []).forEach((r) => ratingOf.set(r.user_id, r.rating));
  };
  // Newest first, or most helpful first.
  const sortPick = section.querySelector('[data-slot="sort"]');
  sortPick.addEventListener("change", () => loadPage(true));
  // Written comments only (a bare rating counts in the summary instead):
  // the member's own first, then everyone else's.
  const loadPage = async (reset) => {
    let mine = [];
    if (reset) {
      shown = 0;
      if (session) {
        const { data } = await account
          .from("reviews")
          .select(FIELDS)
          .eq("work_id", work.id)
          .eq("user_id", session.user.id)
          .not("body", "is", null)
          .order("created_at", { ascending: false });
        mine = data || [];
      }
    }
    let query = account.from("reviews").select(FIELDS).eq("work_id", work.id).eq("hidden", false).not("body", "is", null);
    if (session) query = query.neq("user_id", session.user.id);
    if (sortPick.value === "helpful") query = query.order("helpful_count", { ascending: false });
    const { data, error } = await query.order("created_at", { ascending: false }).range(shown, shown + PAGE);
    if (error) return;
    const page = data.slice(0, PAGE);
    await learnRatings([...mine, ...page]);
    if (reset) list.replaceChildren(...mine.map((r) => reviewItem(r, true)));
    list.append(...page.map((r) => reviewItem(r, false)));
    shown += page.length;
    more.hidden = data.length <= PAGE;
    empty.hidden = list.children.length > 0;
    sortPick.closest("label").hidden = !reset ? false : list.children.length < 2;
  };
  more.addEventListener("click", () => loadPage(false));

  // ---------- The form: always there, always empty ----------
  // Each post is a new comment. On a released work the form also shows
  // their rating, which opens the ten-star box.
  const fillForm = () => {
    form.hidden = !session;
    bodyInput.value = "";
    submit.textContent = released ? "Post review" : "Post comment";
    formRate.hidden = !released;
    if (!released) return;
    const value = own && own.rating;
    formRate.replaceChildren(
      make("span", "", value ? "Your rating" : "Rate it too"),
      value ? scoreOf(value, "score score--small", true) : make("span", "stars stars--empty", "☆")
    );
  };
  formRate.addEventListener("click", () => rateDialog());

  session = await verifiedSession();
  if (!session) {
    const login = section.querySelector(".reviews__login");
    login.hidden = false;
    login.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      local.set("next", workReturn("#reviews"));
      location.href = "login.html";
    });
  } else {
    const { data } = await account
      .from("reviews")
      .select(FIELDS)
      .eq("work_id", work.id)
      .eq("user_id", session.user.id)
      .not("rating", "is", null)
      .maybeSingle();
    own = data || null;
    // Which reviews they've already marked helpful or reported.
    const [{ data: votes }, { data: reports }] = await Promise.all([
      account.from("review_votes").select("review_id").eq("user_id", session.user.id),
      account.from("review_reports").select("review_id").eq("user_id", session.user.id),
    ]);
    (votes || []).forEach((v) => voted.add(v.review_id));
    (reports || []).forEach((r) => reported.add(r.review_id));
    fillForm();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = bodyInput.value.trim();
    if (!body) {
      bodyInput.focus();
      return say(released ? "Write your review first." : "Write your comment first.");
    }
    submit.disabled = true;
    say("Saving…", true);
    const { error } = await account.from("reviews").insert({ work_id: work.id, rating: null, body });
    submit.disabled = false;
    if (error)
      return say(
        error.code === "SF004"
          ? "Wait a few seconds before posting again."
          : error.code === "SF005"
            ? "You've reached 20 comments on this work."
            : "Not saved. Check your connection and try again."
      );
    bodyInput.value = "";
    say(released ? "Thanks! Your review is up." : "Thanks! Your comment is up.", true);
    loadPage(true);
  });

  rateBox();
  if (location.hash === "#reviews") section.scrollIntoView();
  loadPage(true);
  showSummary();
})();

// ---------- Studio news ----------
// A post's text in this page's language, or the other one if that's all
// it has.
const newsField = (post, name) =>
  (LANG === "fa" ? post[`${name}_fa`] || post[name] : post[name] || post[`${name}_fa`]) || "";
const getNews = async (query) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/news?${query}`, { headers: { apikey: SUPABASE_KEY }, signal: timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
const NEWS_LIST =
  "select=slug,title,title_fa,summary,summary_fa,body,body_fa,cover_url,work_id,youtube_url,youtube_thumb_url,published_at&published=eq.true&order=published_at.desc";
// A post's short description: its summary, or else the start of its text
// as plain words (headings left out; list marks, bold and links unwrapped).
const newsBlurb = (post) => {
  const summary = newsField(post, "summary");
  if (summary) return summary;
  const text = newsField(post, "body")
    .replace(/^\s*##\s.*$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^\s*-\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 240 ? `${text.slice(0, 240).replace(/\s+\S*$/, "")}…` : text;
};
// A post's picture: its own cover, or else the art of the work it's about.
const newsCover = (post, works = []) => {
  if (post.cover_url) return post.cover_url;
  const work = post.work_id && works.find((w) => w.id === post.work_id);
  return (work && (work.hero || work.images[0])) || "";
};

// Post text, written plainly: a blank line starts a paragraph, "## " a
// heading, "- " a list item; **bold** and [text](https://…) links inside.
// Built as elements, never as HTML, so nothing in it can run.
const richText = (text) => {
  const inline = (line) => {
    const out = document.createDocumentFragment();
    const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|[a-z0-9-]+\.html[^\s)]*)\)/g;
    let last = 0;
    for (const m of line.matchAll(re)) {
      out.append(line.slice(last, m.index));
      if (m[1]) {
        const b = document.createElement("strong");
        b.textContent = m[1];
        out.append(b);
      } else {
        const a = document.createElement("a");
        a.textContent = m[2];
        a.href = m[3];
        if (/^https?:/.test(m[3]) && !m[3].startsWith("https://saufoxentertainment.ir")) {
          a.target = "_blank";
          a.rel = "noopener";
        }
        out.append(a);
      }
      last = m.index + m[0].length;
    }
    out.append(line.slice(last));
    return out;
  };
  const out = document.createDocumentFragment();
  String(text || "")
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .forEach((block) => {
      const lines = block.split("\n");
      let el;
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        el = document.createElement("ul");
        lines.forEach((l) => {
          const li = document.createElement("li");
          li.append(inline(l.replace(/^\s*[-•]\s+/, "")));
          el.append(li);
        });
      } else if (/^#{2,3}\s+/.test(block) && lines.length === 1) {
        el = document.createElement("h2");
        el.append(inline(block.replace(/^#{2,3}\s+/, "")));
      } else {
        el = document.createElement("p");
        lines.forEach((l, i) => {
          if (i) el.append(document.createElement("br"));
          el.append(inline(l));
        });
      }
      el.dir = "auto";
      out.append(el);
    });
  return out;
};

// One post as a card, for the news list and the home page.
const newsCard = (post, works) => {
  const link = document.createElement("a");
  link.className = "news-card";
  link.href = `news.html?post=${encodeURIComponent(post.slug)}`;
  const picture = newsCover(post, works);
  if (picture) {
    const img = document.createElement("img");
    img.className = "news-card__cover";
    img.src = picture;
    img.alt = "";
    img.loading = "lazy";
    link.append(img);
  }
  const text = document.createElement("span");
  text.className = "news-card__text";
  const date = document.createElement("time");
  date.className = "news-card__date";
  date.dateTime = post.published_at;
  date.textContent = dateText(post.published_at);
  const title = document.createElement("strong");
  title.className = "news-card__title";
  title.textContent = newsField(post, "title");
  title.dir = "auto";
  title.translate = false;
  text.append(date, title);
  const summary = newsBlurb(post);
  if (summary) {
    const p = document.createElement("span");
    p.className = "news-card__summary";
    p.textContent = summary;
    p.dir = "auto";
    p.translate = false;
    text.append(p);
  }
  link.append(text);
  return link;
};

// News (news.html) — the list, or one post with ?post=<slug>.
(async function newsPage() {
  const page = document.querySelector(".news");
  if (!page) return;
  const slug = new URLSearchParams(location.search).get("post");
  const listView = page.querySelector(".news__list-view");
  const missing = page.querySelector(".news-missing");

  if (slug) {
    listView.hidden = true;
    let post;
    try {
      [post] = await getNews(
        `select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}&limit=1`
      );
    } catch (e) {}
    if (!post) {
      missing.hidden = false;
      setMeta('meta[name="robots"]', "content", "noindex");
      return;
    }
    const view = page.querySelector(".news-post");
    const title = newsField(post, "title");
    view.querySelector(".news-post__date").textContent = dateText(post.published_at);
    const heading = view.querySelector(".news-post__title");
    heading.textContent = title;
    heading.dir = "auto";
    heading.translate = false;
    const cover = view.querySelector(".news-post__cover");
    const picture = newsCover(post, await catalog);
    if (picture) {
      cover.src = picture;
      cover.hidden = false;
    }
    const body = view.querySelector(".news-post__body");
    body.translate = false;
    body.append(richText(newsField(post, "body") || newsField(post, "summary")));
    // The post's video: its thumbnail opens it on YouTube.
    if (youtubeId(post.youtube_url)) {
      const video = youtubeCard(post.youtube_url, post.youtube_thumb_url);
      video.classList.add("news-post__video");
      body.after(video);
    }
    const work = post.work_id && (await catalog).find((w) => w.id === post.work_id);
    if (work) {
      const link = view.querySelector(".news-post__work");
      link.href = workUrl(work.id);
      link.textContent = t(`See ${work.title}`);
      link.hidden = false;
    }
    document.title = `${title} · ${t("SauFox Entertainment")}`;
    setMeta('meta[property="og:type"]', "content", "article");
    pageMeta({
      path: `/news.html?post=${encodeURIComponent(post.slug)}`,
      title: `${title} · SauFox Entertainment`,
      description: newsField(post, "summary") || title,
      image: picture || undefined,
    });
    view.hidden = false;
    return;
  }

  // The list, 12 at a time.
  const list = page.querySelector(".news__list");
  const more = page.querySelector(".news__more");
  const PAGE = 12;
  let shown = 0;
  const load = async () => {
    let posts = [];
    try {
      posts = await getNews(`${NEWS_LIST}&offset=${shown}&limit=${PAGE + 1}`);
    } catch (e) {}
    const works = await catalog;
    posts.slice(0, PAGE).forEach((post) => {
      const item = document.createElement("li");
      item.append(newsCard(post, works));
      list.append(item);
    });
    shown += Math.min(posts.length, PAGE);
    more.hidden = posts.length <= PAGE;
    page.querySelector(".news__empty").hidden = shown > 0;
  };
  more.addEventListener("click", load);
  load();
})();

// Home page: the latest three posts, once there are any.
(async function latestNews() {
  const section = document.querySelector(".home-news");
  if (!section) return;
  let posts = [];
  try {
    posts = await getNews(`${NEWS_LIST}&limit=3`);
  } catch (e) {}
  if (!posts.length) return;
  const works = await catalog;
  section.querySelector(".home-news__list").replaceChildren(...posts.map((post) => newsCard(post, works)));
  section.hidden = false;
})();

// Search text in either language: lower case, Arabic letters as their Persian
// forms (ي→ی, ك→ک …), no diacritics, zero-width non-joiners as spaces, and
// Persian or Arabic digits as 0-9.
const foldText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/‌/g, " ")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/\s+/g, " ")
    .trim();

// Browse (browse.html) — every published work, searched by title, type,
// genre, platform and story (in both languages), filtered and sorted. The
// choices live in the address, so links and the back button keep them.
(async function browsePage() {
  const page = document.querySelector(".browse");
  if (!page) return;
  const CATALOG = await catalog;
  const STATUS = { released: "Released", preorder: "Pre-order", coming: "Coming soon", production: "In production" };
  const input = page.querySelector('input[name="q"]');
  const picks = Object.fromEntries([...page.querySelectorAll(".browse__filters select")].map((s) => [s.name, s]));
  const grid = page.querySelector(".browse__grid");
  const count = page.querySelector(".browse__count");
  const empty = page.querySelector(".browse__empty");
  const clear = page.querySelector(".browse__clear");

  // Options from what the catalogue actually has; a filter with nothing to
  // choose from stays out of the way.
  const fill = (select, values) => {
    [...new Set(values.filter(Boolean))]
      .sort((a, b) => t(a).localeCompare(t(b), LANG))
      .forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.append(option);
      });
    select.closest("label").hidden = select.options.length <= 2;
  };
  fill(picks.kind, CATALOG.map((w) => w.kind));
  fill(picks.genre, CATALOG.flatMap((w) => w.genres));
  fill(picks.platform, CATALOG.flatMap((w) => w.platforms));
  [...picks.status.options].forEach((o) => {
    if (o.value && !CATALOG.some((w) => w.status === o.value)) o.remove();
  });
  picks.status.closest("label").hidden = picks.status.options.length <= 2;
  if (!CATALOG.some((w) => w.reviews)) picks.sort.querySelector('[value="rating"]').remove();
  if (!CATALOG.some((w) => w.prices && w.prices.IRR != null))
    picks.sort.querySelectorAll('[value^="price"]').forEach((o) => o.remove());

  // Everything a search can match, in both languages.
  const haystack = new Map(
    CATALOG.map((w) => [
      w.id,
      foldText(
        [w.title, w.kind, t(w.kind), STATUS[w.status], t(STATUS[w.status] || ""), ...w.genres, ...w.genres.map(t), ...w.platforms, w.text].join(" ")
      ),
    ])
  );
  const ranked = (w) => (w.score * w.reviews + 6 * 3) / (w.reviews + 3);
  const price = (w) => (w.prices && w.prices.IRR != null ? w.prices.IRR : null);
  const SORTS = {
    featured: () => 0,
    newest: (a, b) => String(b.created).localeCompare(String(a.created)),
    rating: (a, b) => (b.reviews ? ranked(b) : -1) - (a.reviews ? ranked(a) : -1),
    "price-low": (a, b) => (price(a) ?? Infinity) - (price(b) ?? Infinity),
    "price-high": (a, b) => (price(b) ?? -Infinity) - (price(a) ?? -Infinity),
  };

  // Start from the address.
  const params = new URLSearchParams(location.search);
  input.value = params.get("q") || "";
  Object.entries(picks).forEach(([name, select]) => {
    const value = params.get(name);
    if (value && [...select.options].some((o) => o.value === value)) select.value = value;
  });

  const show = () => {
    const words = foldText(input.value).split(" ").filter(Boolean);
    const { kind, status, genre, platform, sort } = Object.fromEntries(Object.entries(picks).map(([k, s]) => [k, s.value]));
    const works = CATALOG.filter(
      (w) =>
        (!kind || w.kind === kind) &&
        (!status || w.status === status) &&
        (!genre || w.genres.includes(genre)) &&
        (!platform || w.platforms.includes(platform)) &&
        words.every((word) => haystack.get(w.id).includes(word))
    ).sort(SORTS[sort] || SORTS.featured);
    grid.replaceChildren(...works.map(posterCard));
    count.textContent = works.length === 1 ? "1 work" : `${num(works.length)} works`;
    empty.hidden = works.length > 0;
    const filtered = words.length || kind || status || genre || platform;
    clear.hidden = !filtered;
    // Keep the address in step, without a history entry per keystroke.
    const next = new URLSearchParams();
    if (params.get("lang")) next.set("lang", params.get("lang"));
    if (input.value.trim()) next.set("q", input.value.trim());
    Object.entries(picks).forEach(([name, select]) => {
      if (select.value && !(name === "sort" && select.value === "featured")) next.set(name, select.value);
    });
    const query = next.toString();
    history.replaceState(null, "", query ? `browse?${query}` : "browse");
  };

  let typing;
  input.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(show, 150);
  });
  page.querySelector(".browse__search").addEventListener("submit", (event) => {
    event.preventDefault();
    show();
    input.blur();
  });
  Object.values(picks).forEach((select) => select.addEventListener("change", show));
  clear.addEventListener("click", () => {
    input.value = "";
    Object.values(picks).forEach((select) => (select.value = select.options[0].value));
    show();
    input.focus();
  });
  show();
})();

// Admin panel (admin.html) — add, edit, order, publish and delete works in
// the Supabase catalogue. Only accounts in the admins table get in, and the
// database refuses changes from anyone else anyway.
// ---------- Support tickets (support.html, and the admin panel) ----------
// A ticket belongs to one member; the studio's replies are marked staff.
// Attachments sit in the private "support" bucket, in the ticket owner's
// folder, and are shown through links that work for an hour.
const TICKET_TOPICS = {
  order: "An order",
  account: "Account and sign-in",
  technical: "Technical problem",
  subscription: "Subscription",
  other: "Something else",
};
const TICKET_STATUS = { open: "Waiting for a reply", answered: "Answered", closed: "Closed" };
const SUPPORT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const supportUpload = async (file, ownerId) => {
  if (!SUPPORT_TYPES.includes(file.type)) throw new Error("Attach an image (JPG, PNG, WebP or GIF) or a PDF.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Files can be up to 5 MB.");
  const safe = (file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file").replace(/^_+/, "");
  const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await account.storage.from("support").upload(path, file, { contentType: file.type });
  if (error) throw new Error("The file didn't upload. Try again.");
  return { attachment: path, attachment_name: file.name.slice(0, 200) };
};
// A file input's chosen name beside it.
const showFileName = (input, label, empty = "") =>
  input.addEventListener("change", () => (label.textContent = input.files[0] ? input.files[0].name : t(empty)));
// The conversation, oldest first. `when` formats a time.
const ticketThread = async (list, messages, when) => {
  const paths = messages.map((m) => m.attachment).filter(Boolean);
  const links = {};
  if (paths.length) {
    const { data } = await account.storage.from("support").createSignedUrls(paths, 3600);
    (data || []).forEach((d) => d.signedUrl && (links[d.path] = d.signedUrl));
  }
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  list.replaceChildren(
    ...messages.map((m) => {
      const item = make("li", m.staff ? "ticket-msg ticket-msg--staff" : "ticket-msg");
      const head = make("div", "ticket-msg__head");
      const who = make("strong", "ticket-msg__who", m.staff ? "SauFox Entertainment" : m.author_name || "Member");
      who.translate = false;
      head.append(who);
      if (m.staff) head.append(make("span", "ticket-msg__tag", "Support"));
      head.append(make("time", "ticket-msg__time", when(m.created_at)));
      const body = make("p", "ticket-msg__body", m.body);
      body.dir = "auto";
      body.translate = false;
      item.append(head, body);
      const url = m.attachment && links[m.attachment];
      if (url) {
        const file = make("a", "ticket-msg__file");
        file.href = url;
        file.target = "_blank";
        file.rel = "noopener";
        if (/\.(jpe?g|png|webp|gif)$/i.test(m.attachment)) {
          const img = make("img");
          img.src = url;
          img.alt = m.attachment_name || "";
          img.loading = "lazy";
          file.append(img);
        } else file.append(make("span", "", `📎 ${m.attachment_name || "File"}`));
        item.append(file);
      }
      return item;
    })
  );
};

// The member's page: their tickets, a new ticket, one ticket's thread.
(async function supportPage() {
  const page = document.querySelector(".support");
  if (!page || !account) return;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const status = page.querySelector(".support__status");
  const newButton = page.querySelector(".support__new");
  const listView = page.querySelector(".support__tickets");
  const list = listView.querySelector(".ticket-list");
  const empty = listView.querySelector(".support__empty");
  const form = page.querySelector(".ticket-form");
  const view = page.querySelector(".ticket");
  const thread = view.querySelector(".ticket-thread");
  const replyForm = view.querySelector(".ticket-reply");
  const when = (iso) =>
    new Date(iso).toLocaleString(LANG === "fa" ? "fa-IR" : "en-GB", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tehran",
    });

  const session = await verifiedSession();
  if (!session) {
    const login = page.querySelector(".support__login");
    login.hidden = false;
    login.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      goLogin();
    });
    return;
  }
  const me = session.user.id;
  const notify = (messageId) => payment({ action: "ticket-email", message_id: messageId }, session);

  // ---------- Which view: list, new, or one ticket (?t=) ----------
  let current = null;
  let poll = 0;
  const go = (params, push = true) => {
    const query = new URLSearchParams(params).toString();
    if (push) history.pushState(null, "", query ? `support?${query}` : "support");
    route();
  };
  const route = () => {
    clearInterval(poll);
    const params = new URLSearchParams(location.search);
    const id = params.get("t");
    status.textContent = "";
    listView.hidden = form.hidden = view.hidden = true;
    newButton.hidden = Boolean(id) || params.has("new");
    page.querySelector(".support__top").hidden = Boolean(id);
    if (id) return openTicket(id);
    if (params.has("new")) return openForm(params.get("order"));
    listView.hidden = false;
    loadList();
  };
  window.addEventListener("popstate", () => route());
  newButton.addEventListener("click", () => go({ new: "" }));
  view.querySelector(".ticket__back").addEventListener("click", (event) => {
    event.preventDefault();
    go({});
  });

  // ---------- The list ----------
  const loadList = async () => {
    const { data, error } = await account
      .from("tickets")
      .select("id, number, subject, category, status, member_unread, updated_at")
      .eq("user_id", me)
      .order("updated_at", { ascending: false });
    if (error) return (status.textContent = t("Your tickets couldn't be loaded. Check your connection and reload the page."));
    list.replaceChildren(
      ...data.map((ticket) => {
        const item = make("li", `ticket-row ticket-row--${ticket.status}${ticket.member_unread ? " is-unread" : ""}`);
        const link = make("a", "ticket-row__link");
        link.href = `support?t=${ticket.id}`;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          go({ t: ticket.id });
        });
        const top = make("span", "ticket-row__top");
        const number = make("span", "ticket-row__number", `#${digits(ticket.number)}`);
        number.translate = false;
        top.append(number, make("span", `ticket-badge ticket-badge--${ticket.status}`, TICKET_STATUS[ticket.status]));
        if (ticket.member_unread) top.append(make("span", "ticket-row__new", "New reply"));
        const subject = make("strong", "ticket-row__subject", ticket.subject);
        subject.dir = "auto";
        subject.translate = false;
        const meta = make("span", "ticket-row__meta", `${t(TICKET_TOPICS[ticket.category] || ticket.category)} · ${when(ticket.updated_at)}`);
        link.append(top, subject, meta);
        item.append(link);
        return item;
      })
    );
    empty.hidden = data.length > 0;
  };

  // ---------- A new ticket ----------
  const topicPick = form.querySelector('[name="category"]');
  topicPick.replaceChildren(...Object.entries(TICKET_TOPICS).map(([value, label]) => new Option(t(label), value)));
  const orderPick = form.querySelector('[name="order"]');
  const formSay = (text, ok) => {
    const m = form.querySelector(".auth__message");
    m.textContent = t(text);
    m.classList.toggle("is-ok", Boolean(ok));
  };
  const formFile = form.querySelector('[name="file"]');
  showFileName(formFile, form.querySelector('[data-slot="file-name"]'), "Up to 5 MB");
  let ordersLoaded = false;
  const openForm = async (orderId) => {
    form.hidden = false;
    form.reset();
    form.querySelector('[data-slot="file-name"]').textContent = t("Up to 5 MB");
    formSay("");
    if (!ordersLoaded) {
      ordersLoaded = true;
      const { data } = await account
        .from("orders")
        .select("id, number, title, plan_id, created_at")
        .eq("user_id", me)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data && data.length) {
        orderPick.replaceChildren(
          new Option("—", ""),
          ...data.map((o) => new Option(`#${digits(o.number)} · ${o.plan_id ? t(`${PLAN_NAMES[o.plan_id] || o.plan_id}`) : o.title}`, o.id))
        );
        form.querySelector('[data-slot="order-field"]').hidden = false;
      }
    }
    if (orderId && [...orderPick.options].some((o) => o.value === orderId)) {
      orderPick.value = orderId;
      topicPick.value = "order";
    }
    form.querySelector('[name="subject"]').focus();
  };
  form.querySelector('[data-action="cancel"]').addEventListener("click", () => go({}));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const subject = form.subject.value.trim();
    const body = form.body.value.trim();
    if (subject.length < 3) return formSay("Give your ticket a short subject.");
    if (!body) return formSay("Write your message.");
    const send = form.querySelector('[type="submit"]');
    send.disabled = true;
    formSay("Sending…", true);
    try {
      const file = formFile.files[0] ? await supportUpload(formFile.files[0], me) : {};
      const { data: ticket, error } = await account
        .from("tickets")
        .insert({ category: topicPick.value, subject, order_id: orderPick.value || null })
        .select("id")
        .single();
      if (error)
        throw new Error(
          error.code === "SF006"
            ? "You have 5 tickets still open. Close one you don't need, or write in it instead."
            : error.code === "SF004"
              ? "Wait a minute before opening another ticket."
              : "Not sent. Check your connection and try again."
        );
      const { data: message } = await account
        .from("ticket_messages")
        .insert({ ticket_id: ticket.id, body, ...file })
        .select("id")
        .single();
      if (message) notify(message.id);
      go({ t: ticket.id });
    } catch (e) {
      formSay(e.message);
    } finally {
      send.disabled = false;
    }
  });

  // ---------- One ticket ----------
  // (Text boxes are left out of the page translation.)
  replyForm.body.placeholder = t("Write your reply…");
  const replyFile = replyForm.querySelector('[name="file"]');
  const replyName = replyForm.querySelector('[data-slot="file-name"]');
  showFileName(replyFile, replyName);
  const replySay = (text, ok) => {
    const m = replyForm.querySelector(".auth__message");
    m.textContent = t(text);
    m.classList.toggle("is-ok", Boolean(ok));
  };
  const closeButton = replyForm.querySelector('[data-action="close-ticket"]');
  const showTicket = (ticket) => {
    current = ticket;
    view.querySelector('[data-slot="number"]').textContent = `${t("Ticket")} #${digits(ticket.number)}`;
    view.querySelector('[data-slot="subject"]').textContent = ticket.subject;
    const meta = view.querySelector('[data-slot="meta"]');
    meta.replaceChildren(
      make("span", `ticket-badge ticket-badge--${ticket.status}`, TICKET_STATUS[ticket.status]),
      make("span", "", t(TICKET_TOPICS[ticket.category] || ticket.category)),
      make("span", "", `${t("Opened")} ${when(ticket.created_at)}`)
    );
    replyForm.querySelector(".ticket-reply__closed").hidden = ticket.status !== "closed";
    closeButton.hidden = ticket.status === "closed";
  };
  const loadThread = async () => {
    const { data } = await account
      .from("ticket_messages")
      .select("id, staff, author_name, body, attachment, attachment_name, created_at")
      .eq("ticket_id", current.id)
      .order("created_at");
    if (data && data.length !== thread.children.length) await ticketThread(thread, data, when);
  };
  const openTicket = async (id) => {
    const { data: ticket } = await account
      .from("tickets")
      .select("id, number, subject, category, status, member_unread, created_at")
      .eq("id", id)
      .maybeSingle();
    if (!ticket) {
      status.textContent = t("This ticket isn't here. It may belong to another account.");
      listView.hidden = false;
      return loadList();
    }
    view.hidden = false;
    thread.replaceChildren();
    showTicket(ticket);
    await loadThread();
    if (ticket.member_unread) account.from("tickets").update({ member_unread: false }).eq("id", ticket.id).then(() => {});
    // New replies show up while the page is open.
    poll = setInterval(async () => {
      if (document.hidden || !current) return;
      const { data } = await account.from("tickets").select("id, number, subject, category, status, member_unread, created_at").eq("id", current.id).maybeSingle();
      if (!data) return;
      showTicket(data);
      await loadThread();
      if (data.member_unread) account.from("tickets").update({ member_unread: false }).eq("id", data.id).then(() => {});
    }, 30000);
  };
  replyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = replyForm.body.value.trim();
    if (!body) return replySay("Write your message.");
    const send = replyForm.querySelector('[type="submit"]');
    send.disabled = true;
    replySay("Sending…", true);
    try {
      const file = replyFile.files[0] ? await supportUpload(replyFile.files[0], me) : {};
      const { data: message, error } = await account
        .from("ticket_messages")
        .insert({ ticket_id: current.id, body, ...file })
        .select("id")
        .single();
      if (error)
        throw new Error(
          error.code === "SF004"
            ? "Wait a few seconds before sending again."
            : error.code === "SF007"
              ? "This ticket is full. Please open a new one."
              : "Not sent. Check your connection and try again."
        );
      notify(message.id);
      replyForm.reset();
      replyName.textContent = "";
      replySay("");
      showTicket({ ...current, status: "open" });
      await loadThread();
    } catch (e) {
      replySay(e.message);
    } finally {
      send.disabled = false;
    }
  });
  closeButton.addEventListener("click", async () => {
    // Press twice: the first press asks.
    if (!closeButton.dataset.armed) {
      closeButton.dataset.armed = "1";
      closeButton.textContent = t("Close it?");
      setTimeout(() => {
        delete closeButton.dataset.armed;
        closeButton.textContent = t("Close ticket");
      }, 4000);
      return;
    }
    closeButton.disabled = true;
    const { error } = await account.from("tickets").update({ status: "closed" }).eq("id", current.id);
    closeButton.disabled = false;
    delete closeButton.dataset.armed;
    closeButton.textContent = t("Close ticket");
    if (error) return replySay("Not changed. Try again.");
    showTicket({ ...current, status: "closed" });
  });

  route(false);
})();

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
  let images = { cover: "", hero: "", thumb: "" };
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
    heroFeatured: $("w-hero-featured"),
    publishAt: $("w-publish-at"),
    irr: $("w-price-irr"),
    usd: $("w-price-usd"),
    eur: $("w-price-eur"),
    heroFocus: $("w-hero-focus"),
    trailerDate: $("w-trailer-date"),
    trailer: $("w-trailer"),
    youtube: $("w-youtube"),
    synopsis: $("w-synopsis"),
    synopsisFa: $("w-synopsis-fa"),
    genres: $("w-genres"),
    platforms: $("w-platforms"),
    rating: $("w-rating"),
  };
  const deleteButton = form.querySelector('[data-action="delete"]');
  const viewLink = form.querySelector('[data-slot="view-link"]');
  const creditsEl = form.querySelector(".admin-credits");
  const suggestions = document.getElementById("credit-roles");
  suggestions.replaceChildren(...creditTaxonomy.roles.map((role) => {
    const option = document.createElement("option");
    option.value = LANG === "fa" ? role.fa : role.en;
    option.label = LANG === "fa" ? role.en : role.fa;
    return option;
  }));
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

  // One person in the cast & crew: photo (click to upload), their roles
  // (any number: type one and press Enter or comma; suggestions come from
  // the common ones), name; moved up with the arrow. Who leads, acts or is
  // crew follows from the roles on the work's page.
  const addCredit = (credit = {}) => {
    const item = make("li", "admin-credit");
    item.dataset.photo = credit.photo || "";
    const photo = make("label", "admin-credit__photo");
    photo.title = "Photo";
    const img = make("img");
    img.alt = "";
    const file = make("input");
    file.type = "file";
    file.accept = "image/jpeg,image/png,image/webp";
    file.hidden = true;
    const showPhoto = () => {
      img.hidden = !item.dataset.photo;
      if (item.dataset.photo) img.src = item.dataset.photo;
      photo.classList.toggle("is-empty", !item.dataset.photo);
    };
    file.addEventListener("change", async () => {
      const chosen = file.files[0];
      file.value = "";
      if (!chosen) return;
      let cropped;
      try {
        cropped = await cropPhoto(chosen);
      } catch (e) {
        say(e.message);
        return;
      }
      if (!cropped) return;
      say("Uploading…", true);
      try {
        item.dataset.photo = await upload(cropped, "person", true);
        showPhoto();
        say("Photo added. Save to keep it.", true);
      } catch (e) {
        say(e.message);
      }
    });
    photo.append(img, file);
    showPhoto();

    // Roles: chips, and a box to type the next one.
    const roles = make("div", "admin-roles");
    const typing = make("input");
    typing.type = "text";
    typing.maxLength = 60;
    typing.placeholder = "Roles: Director, Composer, as Anna…";
    typing.setAttribute("aria-label", "Roles");
    typing.setAttribute("list", "credit-roles");
    const chip = (text) => {
      text = creditTaxonomy.normalize(text);
      const tag = make("span", "admin-roles__chip");
      tag.dataset.role = text;
      const label = make("span", "", t(text));
      label.translate = false;
      const drop = make("button", "", "×");
      drop.type = "button";
      drop.setAttribute("aria-label", `Remove ${text}`);
      drop.addEventListener("click", () => {
        tag.remove();
        hint();
      });
      tag.append(label, drop);
      typing.before(tag);
      hint();
    };
    // The long example only while there are no roles yet.
    const hint = () => {
      if (picker) updatePicker();
      typing.placeholder = roles.querySelector(".admin-roles__chip") ? "Add a role" : "Roles: Director, Composer, Voice actor…";
      // An actor or voice gets a box for the character they play.
      if (character) character.hidden = ![...roles.querySelectorAll(".admin-roles__chip")].some((c) => PLAYS.test(c.dataset.role));
    };
    let character = null;
    let picker = null;
    const commit = () => {
      typing.value
        .split(",")
        .map((part) => creditTaxonomy.normalize(part))
        .filter(Boolean)
        .forEach((part) => {
          if (![...roles.querySelectorAll(".admin-roles__chip")].some((c) => c.dataset.role.toLowerCase() === part.toLowerCase())) chip(part);
        });
      typing.value = "";
    };
    typing.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        commit();
      } else if (event.key === "Backspace" && !typing.value) {
        roles.querySelector(".admin-roles__chip:last-of-type")?.remove();
        hint();
      }
    });
    // Picking a suggestion adds it straight away.
    typing.addEventListener("input", (event) => {
      if (event.inputType === "insertReplacementText" || !event.inputType) commit();
    });
    typing.addEventListener("blur", commit);
    roles.addEventListener("click", (event) => event.target === roles && typing.focus());
    roles.append(typing);
    const read = readCredit(credit);
    character = make("label", "admin-credit__character");
    const characterInput = make("input");
    characterInput.type = "text";
    characterInput.maxLength = 120;
    characterInput.placeholder = "e.g. Anna (several: Anna, The Friar)";
    characterInput.value = read.character;
    characterInput.setAttribute("aria-label", "Character");
    character.append(make("span", "", "Character"), characterInput);
    character.hidden = true;
    read.roles.forEach(chip);
    hint();

    picker = make("div", "admin-credit__picker");
    const categoryLabel = make("label");
    categoryLabel.append(make("span", "", "Role category"));
    const category = make("select");
    category.setAttribute("aria-label", "Role category");
    category.append(new Option(t("All departments"), ""));
    creditTaxonomy.groups.forEach((group) => category.append(new Option(t(group.en), group.id)));
    if (read.roles.length) category.value = creditPlace(read.roles, read.department);
    categoryLabel.append(category);
    const selectionLabel = make("label");
    selectionLabel.append(make("span", "", "Choose a role"));
    const selection = make("select");
    selection.setAttribute("aria-label", "Choose a role");
    selectionLabel.append(selection);
    const displayLabel = make("label");
    displayLabel.append(make("span", "", "Show under"));
    const display = make("select", "admin-credit__department");
    display.setAttribute("aria-label", "Show under");
    display.append(new Option(t("Automatic from roles"), ""));
    creditTaxonomy.groups.forEach((group) => display.append(new Option(t(group.en), group.id)));
    display.value = creditTaxonomy.groups.some((group) => group.id === read.department) ? read.department : "";
    displayLabel.append(display);
    const updatePicker = () => {
      selection.replaceChildren(new Option(t("Choose a role"), ""));
      const chosen = new Set([...roles.querySelectorAll(".admin-roles__chip")].map((tag) => tag.dataset.role));
      creditTaxonomy.groups.filter((group) => !category.value || category.value === group.id).forEach((group) => {
        const options = document.createElement("optgroup");
        options.label = t(group.en);
        group.roles.filter((role) => !chosen.has(role.en)).forEach((role) => options.append(new Option(t(role.en), role.en)));
        if (options.children.length) selection.append(options);
      });
      const guessed = creditPlace([...chosen]);
      display.options[0].textContent = t("Automatic from roles") + " · " + t(creditTaxonomy.groups.find((group) => group.id === guessed).en);
    };
    category.addEventListener("change", updatePicker);
    selection.addEventListener("change", () => {
      if (selection.value) chip(selection.value);
    });
    picker.append(categoryLabel, selectionLabel, displayLabel);
    updatePicker();

    const nameInput = make("input", "admin-credit__name");
    nameInput.type = "text";
    nameInput.placeholder = "Name";
    nameInput.value = credit.name || "";
    nameInput.maxLength = 80;
    nameInput.setAttribute("aria-label", "Name");
    // Up past the previous person in the same section (leads, crew, AI or cast),
    // since that's the order the work's page shows.
    const up = make("button", "admin-icon", "↑");
    up.type = "button";
    up.setAttribute("aria-label", "Move up in its section");
    up.title = "Move up in its section";
    const placeOf = (row) =>
      creditPlace(
        [...row.querySelectorAll(".admin-roles__chip")]
          .map((c) => c.dataset.role)
          .concat(row.querySelector(".admin-roles input").value.split(",").map((r) => r.trim()))
          .filter(Boolean),
        row.querySelector(".admin-credit__department").value
      );
    up.addEventListener("click", () => {
      const mine = placeOf(item);
      let before = item.previousElementSibling;
      while (before && placeOf(before) !== mine) before = before.previousElementSibling;
      if (!before) return;
      before.before(item);
      item.classList.remove("is-moved");
      void item.offsetWidth;
      item.classList.add("is-moved");
      up.focus();
    });
    const remove = make("button", "admin-icon", "✕");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove this person");
    remove.addEventListener("click", () => item.remove());
    item.append(photo, nameInput, roles, up, remove, picker, character);
    creditsEl.append(item);
    return nameInput;
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
    fields.heroFeatured.checked = Boolean(w.hero_featured);
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
    images = { cover: w.cover_url || "", hero: w.hero_url || "", thumb: w.youtube_thumb_url || "" };
    fields.youtube.value = w.youtube_url || "";
    stills = (w.stills || []).slice();
    creditsEl.replaceChildren();
    (w.credits || []).forEach((c) => addCredit(c));
    renderImages();
    renderStills();
    deleteButton.hidden = !row;
    resetDelete();
    viewLink.hidden = !(row && liveState(row) === "live");
    if (row) viewLink.href = workUrl(row.id);
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
  const MAX_WIDTH = { cover: 900, hero: 1920, still: 1600, thumb: 1280, person: 400 };
  const toWebp = async (file, maxWidth) => {
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file: JPG, PNG or WebP.");
    const bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image couldn't be opened. Try another file."));
      img.src = URL.createObjectURL(file);
    });
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(bitmap.src);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  };
  // A person's photo is cropped to a square first: drag to move it, zoom
  // with the slider or the wheel, rotate by quarter turns. Resolves with a
  // 400×400 WebP, or null when cancelled.
  const CROP_OUT = 400;
  const cropPhoto = async (file) => {
    if (!file.type.startsWith("image/")) throw new Error("Choose an image file: JPG, PNG or WebP.");
    const source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image couldn't be opened. Try another file."));
      img.src = URL.createObjectURL(file);
    });

    const dialog = make("dialog", "admin-crop");
    const title = make("h3", "admin-crop__title", "Crop the photo");
    const hint = make("p", "admin-crop__hint", "Drag to move the photo. Zoom until the face fills the circle.");
    const stage = make("div", "admin-crop__stage");
    const canvas = make("canvas");
    stage.append(canvas);
    const zoomRow = make("label", "admin-crop__zoom");
    const zoom = make("input");
    zoom.type = "range";
    zoom.min = "1";
    zoom.max = "4";
    zoom.step = "0.01";
    zoom.value = "1";
    zoomRow.append(make("span", "", "Zoom"), zoom);
    const actions = make("div", "admin-crop__actions");
    const rotate = make("button", "admin-button", "Rotate");
    const cancel = make("button", "admin-button", "Cancel");
    const done = make("button", "admin-button admin-button--primary", "Use photo");
    [rotate, cancel, done].forEach((b) => (b.type = "button"));
    actions.append(rotate, cancel, done);
    dialog.append(title, hint, stage, zoomRow, actions);
    document.body.append(dialog);

    // View state: the image is drawn centred at (x, y) from the middle of
    // the square, scaled so the short side covers it at zoom 1.
    let turn = 0;
    let scale = 1;
    let x = 0;
    let y = 0;
    const size = () => canvas.clientWidth || 320;
    const dims = () => (turn % 2 ? [source.height, source.width] : [source.width, source.height]);
    const base = (side) => {
      const [w, h] = dims();
      return side / Math.min(w, h);
    };
    // Keeps the square covered: the image can't be dragged past an edge.
    const clamp = (side) => {
      const [w, h] = dims();
      const k = base(side) * scale;
      const maxX = Math.max(0, (w * k - side) / 2);
      const maxY = Math.max(0, (h * k - side) / 2);
      x = Math.min(maxX, Math.max(-maxX, x));
      y = Math.min(maxY, Math.max(-maxY, y));
    };
    const paint = (target, side) => {
      const ctx = target.getContext("2d");
      const k = base(side) * scale;
      ctx.save();
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, side, side);
      ctx.translate(side / 2 + x * (side / size()), side / 2 + y * (side / size()));
      ctx.rotate((turn * Math.PI) / 2);
      ctx.drawImage(source, (-source.width * k) / 2, (-source.height * k) / 2, source.width * k, source.height * k);
      ctx.restore();
    };
    const draw = () => {
      const side = size();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(side * ratio);
      canvas.height = Math.round(side * ratio);
      clamp(side);
      paint(canvas, canvas.width);
    };

    let drag = null;
    canvas.addEventListener("pointerdown", (e) => {
      drag = { px: e.clientX, py: e.clientY, x, y };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      x = drag.x + e.clientX - drag.px;
      y = drag.y + e.clientY - drag.py;
      draw();
    });
    const stop = () => (drag = null);
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    const setZoom = (value) => {
      const next = Math.min(4, Math.max(1, value));
      x *= next / scale;
      y *= next / scale;
      scale = next;
      zoom.value = String(next);
      draw();
    };
    zoom.addEventListener("input", () => setZoom(Number(zoom.value)));
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        setZoom(scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
      },
      { passive: false }
    );
    rotate.addEventListener("click", () => {
      turn = (turn + 1) % 4;
      [x, y] = [-y, x];
      draw();
    });

    dialog.showModal();
    draw();

    const answer = await new Promise((resolve) => {
      cancel.addEventListener("click", () => resolve(false));
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        resolve(false);
      });
      done.addEventListener("click", () => resolve(true));
    });
    let blob = null;
    if (answer) {
      const out = document.createElement("canvas");
      out.width = CROP_OUT;
      out.height = CROP_OUT;
      paint(out, CROP_OUT);
      blob = await new Promise((resolve) => out.toBlob(resolve, "image/webp", 0.88));
    }
    dialog.close();
    dialog.remove();
    URL.revokeObjectURL(source.src);
    return blob;
  };

  const upload = async (file, kind, ready = false) => {
    const id = fields.id.value.trim();
    if (!validId(id)) throw new Error("Give the work a title and page address before adding images.");
    const blob = ready ? file : await toWebp(file, MAX_WIDTH[kind]);
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
    const youtube = youtubeUrl(fields.youtube.value);
    const problem =
      (!title && [fields.title, "Enter a title."]) ||
      (!validId(id) && [fields.id, "Use lowercase letters, numbers and dashes for the page address, e.g. the-candlewood."]) ||
      (!kind && [fields.kind, "Enter the type of work, e.g. Game."]) ||
      (trailer === null && [fields.trailer, "Paste the Aparat link, like https://www.aparat.com/v/abc123."]) ||
      (youtube === null && [fields.youtube, "Paste the YouTube link, like https://www.youtube.com/watch?v=abc123 or https://youtu.be/abc123."]) ||
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
      hero_featured: fields.heroFeatured.checked,
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
      youtube_url: youtube || null,
      youtube_thumb_url: images.thumb || null,
      synopsis: fields.synopsis.value.trim() || null,
      synopsis_fa: fields.synopsisFa.value.trim() || null,
      genres: list(fields.genres.value),
      platforms: list(fields.platforms.value),
      rating: fields.rating.value.trim() || null,
      credits: [...creditsEl.children]
        .map((item) => {
          // A role still being typed counts too.
          const pending = item.querySelector(".admin-roles input").value.split(",").map((r) => r.trim());
          const roles = [...item.querySelectorAll(".admin-roles__chip")].map((chip) => chip.dataset.role).concat(pending).filter(Boolean);
          const credit = { name: item.querySelector(".admin-credit__name").value.trim(), roles: creditTaxonomy.unique(roles) };
          const department = item.querySelector(".admin-credit__department").value;
          if (department) credit.department = department;
          const character = item.querySelector(".admin-credit__character");
          if (character.querySelector("input").value.trim()) credit.character = character.querySelector("input").value.trim();
          if (item.dataset.photo) credit.photo = item.dataset.photo;
          return credit;
        })
        .filter((c) => c.name && c.roles.length),
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

  // ---------- Payments ----------
  const payForm = page.querySelector(".admin-payments");
  const payMessage = payForm.querySelector(".admin-message");
  const payMode = payForm.querySelector("#payments-mode");
  const salesMode = payForm.querySelector("#sales-open");
  account
    .from("site_settings")
    .select("payments, sales_open")
    .eq("id", 1)
    .maybeSingle()
    .then(({ data }) => {
      if (!data) return;
      payMode.value = data.payments || "off";
      salesMode.value = data.sales_open === false ? "paused" : "open";
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
    payMessage.classList.add("is-ok");
    payMessage.textContent = "Saving…";
    const { error } = await account
      .from("site_settings")
      .update({
        payments: payMode.value,
        sales_open: salesMode.value === "open",
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

  // ---------- Subscriptions ----------
  const planForm = page.querySelector(".admin-plans");
  const planMessage = planForm.querySelector(".admin-message");
  const planBoxes = [...planForm.querySelectorAll(".admin-plan")];
  const planField = (box, name) => box.querySelector(`[name="${name}"]`);
  const DAYS = PLAN_LENGTHS.map(([d]) => d);
  account
    .from("plans")
    .select("id, discount_percent, free_kinds, on_sale, plan_prices(days, price_irr)")
    .then(({ data }) =>
      (data || []).forEach((row) => {
        const box = planBoxes.find((b) => b.dataset.plan === row.id);
        if (!box) return;
        planField(box, "discount_percent").value = row.discount_percent ?? "";
        (row.plan_prices || []).forEach((price) => {
          const input = planField(box, `price_${price.days}`);
          if (input) input.value = price.price_irr ?? "";
        });
        box.querySelectorAll('[name="free"]').forEach((check) => (check.checked = row.free_kinds.includes(check.value)));
        planField(box, "on_sale").checked = row.on_sale;
      })
    );
  // How many members have each plan now (the highest one counts).
  account
    .from("subscriptions")
    .select("user_id, plan_id")
    .lte("starts_at", new Date().toISOString())
    .gt("ends_at", new Date().toISOString())
    .then(({ data }) => {
      const RANK = { iron: 1, gold: 2, titanium: 3 };
      const best = {};
      (data || []).forEach((s) => {
        if (!best[s.user_id] || RANK[s.plan_id] > RANK[best[s.user_id]]) best[s.user_id] = s.plan_id;
      });
      planBoxes.forEach((box) => {
        const count = Object.values(best).filter((id) => id === box.dataset.plan).length;
        box.querySelector('[data-slot="members"]').textContent = `· ${count} ${count === 1 ? "member" : "members"} now`;
      });
    });
  planForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rows = planBoxes.map((box) => ({
      id: box.dataset.plan,
      prices: DAYS.map((days) => ({ days, price_irr: number(planField(box, `price_${days}`)) })),
      discount_percent: number(planField(box, "discount_percent")) ?? 0,
      free_kinds: [...box.querySelectorAll('[name="free"]:checked')].map((check) => check.value),
      on_sale: planField(box, "on_sale").checked,
    }));
    const wrong = rows.find(
      (row) =>
        row.prices.some((price) => price.price_irr !== null && !(price.price_irr >= 10000)) ||
        !(row.discount_percent >= 0 && row.discount_percent <= 90)
    );
    if (wrong) {
      planMessage.classList.remove("is-ok");
      planMessage.textContent = `${PLAN_NAMES[wrong.id]}: each price is at least 10,000 Rials (or empty), and the discount 0 to 90%.`;
      return;
    }
    planMessage.classList.add("is-ok");
    planMessage.textContent = "Saving…";
    const results = await Promise.all(
      rows.flatMap(({ id, prices, ...row }) => [
        account.from("plans").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id),
        ...prices.map((price) => account.from("plan_prices").update({ price_irr: price.price_irr }).eq("plan_id", id).eq("days", price.days)),
      ])
    );
    const failed = results.some((result) => result.error);
    planMessage.classList.toggle("is-ok", !failed);
    planMessage.textContent = failed ? "Not saved. Check your connection and try again." : "Saved. The home page and checkout use the new prices.";
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
  const orderRow = (order, license) => {
    const row = make("li", "admin-order");
    const main = make("div", "admin-order__main");
    main.append(
      make("strong", "", `#${order.number} · ${order.title}${order.test ? " (test)" : ""}`),
      make(
        "span",
        "",
        `${money.IRR(order.amount_irr)}${order.member_discount_irr ? ` (plan −${money.IRR(order.member_discount_irr)})` : ""}${
          order.coupon_code ? ` (code ${order.coupon_code}, −${money.IRR(order.discount_irr)})` : ""
        } · ${whenText(order.created_at)}`
      )
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
      if (pick.value === "cancelled" && !window.confirm("Cancel this order? Its license and device access will be revoked. This does not refund the bank payment.")) {
        pick.value = order.status; return;
      }
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

    // A game order carries its one-time key. Show it, and let the studio
    // send it to the buyer (which also delivers it: the game then appears in
    // the buyer's library and launcher).
    if (license && gameIds.has(order.work_id) && order.status !== "cancelled") {
      const box = make("div", "admin-order__key");
      const code = make("code", "selectable", license.code);
      code.dir = "ltr";
      const copy = make("button", "admin-button", "Copy");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(license.code);
          copy.textContent = "Copied";
          setTimeout(() => (copy.textContent = "Copy"), 1400);
        } catch (e) {}
      });
      const keyNote = make("span", "admin-order__key-note");
      const sendBtn = make("button", "admin-button admin-button--primary", license.delivered_at ? "Resend key" : "Send key to buyer");
      sendBtn.type = "button";
      if (license.delivered_at) {
        box.classList.add("is-delivered");
        keyNote.textContent = `Sent ${whenText(license.delivered_at)}`;
      }
      sendBtn.addEventListener("click", async () => {
        sendBtn.disabled = true;
        keyNote.textContent = "Sending…";
        const answer = await payment({ action: "send-key", order_id: order.id }, await verifiedSession());
        sendBtn.disabled = false;
        if (answer.sent) {
          license.delivered_at = new Date().toISOString();
          box.classList.add("is-delivered");
          sendBtn.textContent = "Resend key";
          keyNote.textContent = `Sent to ${order.email}`;
        } else {
          keyNote.textContent =
            answer.error === "no_password"
              ? "Email isn't set up yet (see the test email above)."
              : answer.error === "no_license"
                ? "No key for this order."
                : answer.error === "send_failed"
                  ? "The email didn't go out. Try again."
                  : "Couldn't send. Try again.";
        }
      });
      box.append(make("span", "admin-order__key-label", "Game key"), code, copy, sendBtn, keyNote);
      row.append(box);
    }
    return row;
  };
  const EMAIL_NAMES = { placed: "order received", paid: "receipt", processing: "in progress", completed: "completed" };
  const mailSummary = page.querySelector('[data-slot="mail-problems"]');
  // Which works are games (games' keys are sent by hand).
  let gameIds = new Set();
  const loadOrders = async () => {
    const [{ data, error }, { data: licenses }, { data: works }] = await Promise.all([
      account
        .from("orders")
        .select("id, number, title, amount_irr, name, email, phone, status, created_at, ref_id, card_pan, test, email_pending, email_error, email_tries, coupon_code, discount_irr, member_discount_irr, work_id, plan_id")
        .order("created_at", { ascending: false })
        .limit(200),
      account.from("licenses").select("id, order_id, code, delivered_at, work_id"),
      account.from("works").select("id, kind"),
    ]);
    gameIds = new Set((works || []).filter((w) => (w.kind || "").toLowerCase() === "game").map((w) => w.id));
    if (error) {
      noOrders.textContent = "Orders couldn't be loaded. Reload the page to try again.";
      noOrders.hidden = false;
      return;
    }
    const keyOf = {};
    (licenses || []).forEach((l) => l.order_id && (keyOf[l.order_id] = l));
    orderList.replaceChildren(...data.map((order) => orderRow(order, keyOf[order.id])));
    noOrders.hidden = data.length > 0;
    const stuck = data.filter((order) => order.email_pending && order.email_pending.length).length;
    mailSummary.textContent = stuck
      ? `${stuck} order${stuck === 1 ? " has" : "s have"} emails that didn't go out (marked below). They're retried every 15 minutes.`
      : "";
    mailSummary.hidden = !stuck;
  };
  loadOrders();

  // ---------- Discount codes ----------
  const couponForm = page.querySelector(".admin-coupons__form");
  const couponList = page.querySelector(".admin-coupons__list");
  const cf = (name) => couponForm.elements[name];
  const couponSay = (text, ok) => {
    const note = couponForm.querySelector(".admin-message");
    note.textContent = text;
    note.classList.toggle("is-ok", Boolean(ok));
  };
  // Letters and digits that can't be mistaken for each other.
  couponForm.querySelector('[data-action="random-code"]').addEventListener("click", () => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const pick = crypto.getRandomValues(new Uint8Array(8));
    cf("code").value = Array.from(pick, (n) => letters[n % letters.length]).join("");
  });
  const couponRow = (c, uses, titles) => {
    const row = make("li", c.active ? "admin-coupon" : "admin-coupon is-off");
    const main = make("div", "admin-coupon__main");
    const off = c.kind === "percent" ? `${c.value}% off` : `${money.IRR(c.value)} off`;
    const limits = [
      c.work_id ? titles[c.work_id] || c.work_id : "every work",
      `used ${uses}${c.max_uses ? ` of ${c.max_uses}` : ""}`,
      c.per_user > 1 ? `${c.per_user} per member` : "once per member",
      c.starts_at ? `from ${whenText(c.starts_at)}` : "",
      c.ends_at ? `until ${whenText(c.ends_at)}` : "",
      c.note || "",
    ].filter(Boolean);
    const code = make("strong", "selectable", c.code);
    code.dir = "ltr";
    main.append(code, make("span", "", `${off} · ${limits.join(" · ")}`));
    const side = make("div", "admin-file__side");
    const toggle = make("label", "admin-check");
    const box = make("input");
    box.type = "checkbox";
    box.checked = c.active;
    toggle.append(box, make("span", "", "On"));
    box.addEventListener("change", async () => {
      box.disabled = true;
      const { error } = await account.from("coupons").update({ active: box.checked }).eq("code", c.code);
      box.disabled = false;
      if (error) { box.checked = !box.checked; fileSay("Could not publish this file. Check its checksum, size and executable path."); }
      row.classList.toggle("is-off", !box.checked);
    });
    const remove = make("button", "admin-button admin-button--danger", "Delete");
    remove.type = "button";
    remove.hidden = uses > 0;
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      const { error } = await account.from("coupons").delete().eq("code", c.code);
      if (!error) return row.remove();
      remove.disabled = false;
      couponSay("That code has been used, so it can't be deleted. Turn it off instead.");
    });
    side.append(toggle, remove);
    row.append(main, side);
    return row;
  };
  const loadCoupons = async () => {
    const [{ data: coupons }, { data: used }, { data: works }] = await Promise.all([
      account.from("coupons").select("*").order("created_at", { ascending: false }),
      account.from("orders").select("coupon_code").not("coupon_code", "is", null).neq("status", "cancelled"),
      account.from("works").select("id, title").order("sort"),
    ]);
    const titles = Object.fromEntries((works || []).map((w) => [w.id, w.title]));
    const workPick = cf("work_id");
    if (workPick.options.length === 1)
      (works || []).forEach((w) => {
        const option = make("option", "", w.title);
        option.value = w.id;
        workPick.append(option);
      });
    const counts = {};
    (used || []).forEach((o) => (counts[o.coupon_code] = (counts[o.coupon_code] || 0) + 1));
    couponList.replaceChildren(...(coupons || []).map((c) => couponRow(c, counts[c.code] || 0, titles)));
  };
  couponForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = cf("code").value.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,32}$/.test(code)) return couponSay("Codes use 3 to 32 letters, digits or dashes, like LAUNCH20.");
    const kind = cf("kind").value;
    const value = Number(cf("value").value);
    if (!(value > 0) || !Number.isInteger(value) || (kind === "percent" && value > 100))
      return couponSay(kind === "percent" ? "Enter a percentage from 1 to 100." : "Enter the Rials to take off, as a whole number.");
    const optionalNumber = (name) => (cf(name).value.trim() ? Number(cf(name).value) : null);
    const row = {
      code,
      kind,
      value,
      work_id: cf("work_id").value || null,
      max_uses: optionalNumber("max_uses"),
      per_user: optionalNumber("per_user") || 1,
      starts_at: fromLocalInput(cf("starts_at").value),
      ends_at: fromLocalInput(cf("ends_at").value),
      note: cf("note").value.trim() || null,
    };
    if (row.starts_at && row.ends_at && new Date(row.ends_at) <= new Date(row.starts_at))
      return couponSay("The end has to come after the start.");
    couponSay("Saving…", true);
    const { error } = await account.from("coupons").insert(row);
    if (error) return couponSay(error.code === "23505" ? "That code already exists." : "Not saved. Check the values and try again.");
    couponForm.reset();
    couponSay(`Added ${code}.`, true);
    loadCoupons();
  });
  loadCoupons();

  // ---------- News ----------
  const newsBox = page.querySelector(".admin-news");
  const newsList = newsBox.querySelector(".admin-news__list");
  const newsForm = newsBox.querySelector(".admin-news__form");
  const newsSay = (text, ok) => {
    const note = newsForm.querySelector(".admin-message");
    note.textContent = text;
    note.classList.toggle("is-ok", Boolean(ok));
  };
  const nf = (name) => newsForm.elements[name];
  const coverImg = newsForm.querySelector(".admin-news__cover:not(.admin-news__thumb) img");
  const coverRemove = newsForm.querySelector('[data-action="remove-cover"]');
  const thumbImg = newsForm.querySelector(".admin-news__thumb img");
  const thumbRemove = newsForm.querySelector('[data-action="remove-thumb"]');
  const postDelete = newsForm.querySelector('[data-action="delete-post"]');
  const postView = newsForm.querySelector('[data-slot="view-post"]');
  let editingPost = null;
  let cover = null;
  let thumb = null;
  let slugTouched = false;
  const showCover = () => {
    coverImg.hidden = !cover;
    if (cover) coverImg.src = cover;
    coverRemove.hidden = !cover;
    thumbImg.hidden = !thumb;
    if (thumb) thumbImg.src = thumb;
    thumbRemove.hidden = !thumb;
  };
  const postState = (post) =>
    !post.published ? "Draft" : new Date(post.published_at) > new Date() ? `Scheduled · ${whenText(post.published_at)}` : "Live";
  const loadNews = async () => {
    const { data, error } = await account.from("news").select("*").order("published_at", { ascending: false });
    if (error) return;
    newsList.replaceChildren(
      ...data.map((post) => {
        const row = make("li", "admin-news__item");
        const main = make("div", "admin-news__main");
        main.append(
          make("strong", "", post.title_fa || post.title),
          make("span", "", `${postState(post)} · ${whenText(post.published_at)}`)
        );
        const edit = make("button", "admin-button", "Edit");
        edit.type = "button";
        edit.addEventListener("click", () => openPost(post));
        row.append(main, edit);
        return row;
      })
    );
    newsBox.querySelector(".admin-news__empty").hidden = data.length > 0;
  };
  const openPost = async (post) => {
    editingPost = post || null;
    slugTouched = Boolean(post);
    newsForm.reset();
    ["title", "title_fa", "summary", "summary_fa", "body", "body_fa", "slug"].forEach((name) => (nf(name).value = (post && post[name]) || ""));
    const works = nf("work_id");
    if (works.options.length === 1) {
      const { data } = await account.from("works").select("id, title").order("sort");
      (data || []).forEach((w) => {
        const option = make("option", "", w.title);
        option.value = w.id;
        works.append(option);
      });
    }
    works.value = (post && post.work_id) || "";
    nf("published").checked = Boolean(post && post.published);
    nf("published_at").value = toLocalInput(post ? post.published_at : new Date().toISOString());
    nf("slug").disabled = Boolean(post);
    cover = (post && post.cover_url) || null;
    thumb = (post && post.youtube_thumb_url) || null;
    nf("youtube_url").value = (post && post.youtube_url) || "";
    showCover();
    postDelete.hidden = !post;
    postView.hidden = !(post && post.published);
    if (post) postView.href = `news.html?post=${encodeURIComponent(post.slug)}`;
    newsSay("");
    newsForm.hidden = false;
    newsForm.scrollIntoView({ block: "start" });
    nf(post ? "body_fa" : "title_fa").focus();
  };
  const closePost = () => {
    newsForm.hidden = true;
    editingPost = null;
  };
  newsBox.querySelector('[data-action="new-post"]').addEventListener("click", () => openPost(null));
  newsForm.querySelector('[data-action="close-post"]').addEventListener("click", closePost);
  // The address follows the English title (or the Persian one's date) until edited.
  const autoSlug = () => {
    if (editingPost || slugTouched) return;
    nf("slug").value = slug(nf("title").value) || (nf("title_fa").value.trim() ? `news-${new Date().toISOString().slice(0, 10)}` : "");
  };
  nf("title").addEventListener("input", autoSlug);
  nf("title_fa").addEventListener("input", autoSlug);
  nf("slug").addEventListener("input", () => (slugTouched = true));
  // The cover and the YouTube thumbnail upload the same way, to works/news/.
  const newsImage = (input, maxWidth, done) =>
    input.addEventListener("change", async () => {
      const file = input.files[0];
      input.value = "";
      if (!file) return;
      newsSay("Uploading…", true);
      try {
        const blob = await toWebp(file, maxWidth);
        const path = `news/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
        const { error } = await photos.upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (error) throw new Error("The image didn't upload. Check your connection and try again.");
        done(photos.getPublicUrl(path).data.publicUrl);
        showCover();
        newsSay("Image added. Save to keep it.", true);
      } catch (e) {
        newsSay(e.message);
      }
    });
  newsImage(newsForm.querySelector('.admin-news__cover:not(.admin-news__thumb) input[type="file"]'), 1600, (url) => (cover = url));
  newsImage(newsForm.querySelector('.admin-news__thumb input[type="file"]'), 1280, (url) => (thumb = url));
  coverRemove.addEventListener("click", () => {
    cover = null;
    showCover();
  });
  thumbRemove.addEventListener("click", () => {
    thumb = null;
    showCover();
  });
  newsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = (name) => nf(name).value.trim() || null;
    if (!value("title") && !value("title_fa")) return newsSay("Give the post a title, in Persian or English.");
    const address = nf("slug").value.trim();
    if (!validId(address)) return newsSay("The page address can use a-z, 0-9 and dashes, like candlewood-trailer-date.");
    const youtube = youtubeUrl(nf("youtube_url").value);
    if (youtube === null) return newsSay("Paste the YouTube link, like https://www.youtube.com/watch?v=abc123 or https://youtu.be/abc123.");
    const row = {
      title: value("title"),
      title_fa: value("title_fa"),
      summary: value("summary"),
      summary_fa: value("summary_fa"),
      body: value("body"),
      body_fa: value("body_fa"),
      work_id: nf("work_id").value || null,
      cover_url: cover,
      youtube_url: youtube || null,
      youtube_thumb_url: thumb,
      published: nf("published").checked,
      published_at: fromLocalInput(nf("published_at").value) || new Date().toISOString(),
    };
    newsSay("Saving…", true);
    const { data, error } = editingPost
      ? await account.from("news").update(row).eq("id", editingPost.id).select().single()
      : await account.from("news").insert({ ...row, slug: address }).select().single();
    if (error)
      return newsSay(error.code === "23505" ? "Another post already uses that page address." : "Not saved. Check your connection and try again.");
    editingPost = data;
    nf("slug").disabled = true;
    postDelete.hidden = false;
    postView.hidden = !data.published;
    postView.href = `news.html?post=${encodeURIComponent(data.slug)}`;
    newsSay(data.published ? `Saved. ${postState(data)}.` : "Saved as a draft.", true);
    loadNews();
  });
  postDelete.addEventListener("click", async () => {
    // Press twice: the first press asks.
    if (!postDelete.dataset.armed) {
      postDelete.dataset.armed = "1";
      postDelete.textContent = "Delete this post?";
      setTimeout(() => {
        delete postDelete.dataset.armed;
        postDelete.textContent = "Delete";
      }, 4000);
      return;
    }
    const { error } = await account.from("news").delete().eq("id", editingPost.id);
    if (error) return newsSay("Not deleted. Try again.");
    closePost();
    loadNews();
  });
  loadNews();

  // ---------- Reviews and comments ----------
  const reviewList = page.querySelector(".admin-reviews__list");
  const REPORT_REASONS = { spam: "Spam or ads", offensive: "Offensive or abusive", spoiler: "Spoilers", other: "Something else" };
  let reportsFor = {};
  const noReviews = page.querySelector(".admin-reviews__empty");
  const reviewRow = (review, titles) => {
    const row = make("li", review.hidden ? "admin-review is-hidden" : "admin-review");
    const main = make("div", "admin-review__main");
    main.append(
      make(
        "strong",
        "",
        `${titles[review.work_id] || review.work_id} · ${review.rating ? `★ ${review.rating}/10` : "comment"}`
      ),
      make("span", "", `${review.author_name || "Member"}${review.owner ? " · bought it" : ""} · ${whenText(review.created_at)}`)
    );
    if (review.body) {
      const text = make("p", "admin-review__body", review.body);
      text.dir = "auto";
      main.append(text);
    }
    if (review.helpful_count) main.append(make("span", "", `👍 ${review.helpful_count} found it helpful`));
    // Open reports: each reason and note, and a way to close them.
    const open = reportsFor[review.id] || [];
    let dismiss = null;
    if (open.length) {
      row.classList.add("is-reported");
      const box = make("div", "admin-review__reports");
      box.append(
        make(
          "strong",
          "",
          `⚑ ${open.length} report${open.length === 1 ? "" : "s"}${review.hidden ? " · hidden automatically until you look at it" : ""}`
        )
      );
      open.forEach((report) => {
        const line = make("span", "", `${REPORT_REASONS[report.reason] || report.reason}${report.note ? `: ${report.note}` : ""}`);
        line.dir = "auto";
        box.append(line);
      });
      main.append(box);
      dismiss = make("button", "admin-button", "Dismiss reports");
      dismiss.type = "button";
      dismiss.addEventListener("click", async () => {
        dismiss.disabled = true;
        const { error } = await account.from("review_reports").update({ resolved: true }).eq("review_id", review.id).eq("resolved", false);
        if (error) {
          dismiss.disabled = false;
          return;
        }
        box.remove();
        dismiss.remove();
        row.classList.remove("is-reported");
      });
    }
    const reply = make("textarea", "admin-review__reply");
    reply.rows = 2;
    reply.maxLength = 2000;
    reply.dir = "auto";
    reply.placeholder = "Reply as SauFox Entertainment (optional)";
    reply.value = review.reply || "";
    const note = make("span", "admin-order__note");
    const save = make("button", "admin-button", "Save reply");
    save.type = "button";
    save.addEventListener("click", async () => {
      save.disabled = true;
      const { error } = await account.from("reviews").update({ reply: reply.value.trim() || null }).eq("id", review.id);
      save.disabled = false;
      note.textContent = error ? "Not saved. Try again." : reply.value.trim() ? "Reply saved." : "Reply removed.";
    });
    const hide = make("button", "admin-button", review.hidden ? "Show on site" : "Hide");
    hide.type = "button";
    hide.addEventListener("click", async () => {
      hide.disabled = true;
      const { error } = await account.from("reviews").update({ hidden: !review.hidden }).eq("id", review.id);
      hide.disabled = false;
      if (error) return (note.textContent = "Not changed. Try again.");
      review.hidden = !review.hidden;
      row.classList.toggle("is-hidden", review.hidden);
      hide.textContent = review.hidden ? "Show on site" : "Hide";
    });
    const remove = make("button", "admin-button admin-button--danger", "Delete");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!remove.dataset.armed) {
        remove.dataset.armed = "1";
        remove.textContent = "Delete it?";
        setTimeout(() => {
          delete remove.dataset.armed;
          remove.textContent = "Delete";
        }, 4000);
        return;
      }
      remove.disabled = true;
      const { error } = await account.from("reviews").delete().eq("id", review.id);
      if (!error) return row.remove();
      remove.disabled = false;
      note.textContent = "Not deleted. Try again.";
    });
    const actions = make("div", "admin-review__actions");
    actions.append(save, hide, ...(dismiss ? [dismiss] : []), remove, note);
    main.append(reply, actions);
    row.append(main);
    return row;
  };
  Promise.all([
    account.from("works").select("id, title"),
    account
      .from("reviews")
      .select("id, work_id, rating, body, author_name, owner, hidden, reply, created_at, helpful_count, report_count")
      .order("report_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    account.from("review_reports").select("review_id, reason, note, created_at").eq("resolved", false).order("created_at"),
  ]).then(([{ data: works }, { data: reviews, error }, { data: reports }]) => {
    if (error) {
      noReviews.textContent = "Reviews couldn't be loaded. Reload the page to try again.";
      noReviews.hidden = false;
      return;
    }
    const titles = Object.fromEntries((works || []).map((w) => [w.id, w.title]));
    reportsFor = {};
    (reports || []).forEach((r) => (reportsFor[r.review_id] ||= []).push(r));
    reviewList.replaceChildren(...reviews.map((r) => reviewRow(r, titles)));
    noReviews.hidden = reviews.length > 0;
  });

  // ---------- Support tickets: answered on the portal's desk ----------
  // The studio's emails link to admin.html#support, which goes on there.
  if (location.hash === "#support") location.replace("https://portal.saufoxentertainment.ir/#/desk");
  const newCount = page.querySelector('.admin-support [data-slot="support-new"]');
  account
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("studio_unread", true)
    .then(({ count }) => {
      newCount.textContent = count ? `${count} new` : "";
      newCount.hidden = !count;
    });

  // ---------- The admin team: the owner adds and removes admins ----------
  const teamForm = page.querySelector(".admin-team__form");
  const teamList = page.querySelector(".admin-team__list");
  const teamSay = (text, ok) => {
    const note = teamForm.querySelector(".admin-message");
    note.textContent = text;
    note.classList.toggle("is-ok", Boolean(ok));
  };
  const TEAM_ERRORS = {
    SF020: "Only the owner can do this.",
    SF021: "No SauFox account uses that email or name. Ask them to sign up on the site first.",
    SF022: "They're already an admin.",
    SF023: "Not on the owner's account.",
    SF024: "Several accounts use that name. Use their email instead, or find them under Members.",
  };
  const loadTeam = async () => {
    const { data: team, error } = await account.rpc("admin_team");
    if (error) return;
    const owner = team.some((a) => a.role === "owner" && a.user_id === session.user.id);
    teamForm.hidden = !owner;
    if (owner && membersBox.hidden) {
      membersBox.hidden = false;
      loadMembers(true);
    }
    teamList.replaceChildren(
      ...team.map((a) => {
        const row = make("li", "admin-coupon");
        const main = make("div", "admin-coupon__main");
        const name = make("strong", "", a.name || a.email.split("@")[0]);
        const email = make("span", "selectable", a.email);
        email.dir = "ltr";
        main.append(name, email);
        const side = make("div", "admin-file__side");
        side.append(make("span", a.role === "owner" ? "admin-team__role is-owner" : "admin-team__role", a.role === "owner" ? "Owner" : "Admin"));
        if (owner && a.role !== "owner") {
          const remove = make("button", "admin-button admin-button--danger", "Remove");
          remove.type = "button";
          remove.addEventListener("click", async () => {
            // Two clicks, so a slip doesn't take someone's access away.
            if (!remove.dataset.armed) {
              remove.dataset.armed = "1";
              remove.textContent = "Remove access?";
              setTimeout(() => {
                delete remove.dataset.armed;
                remove.textContent = "Remove";
              }, 4000);
              return;
            }
            remove.disabled = true;
            const { error: failed } = await account.rpc("admin_remove", { p_user: a.user_id });
            if (failed) {
              remove.disabled = false;
              return teamSay(TEAM_ERRORS[failed.code] || "Not removed. Try again.");
            }
            teamSay(`${a.email} is no longer an admin.`, true);
            loadTeam();
          });
          side.append(remove);
        }
        row.append(main, side);
        return row;
      })
    );
  };
  teamForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const who = teamForm.elements.who.value.trim();
    if (who.length < 2) return teamSay("Enter their email or their name on the site.");
    const button = teamForm.querySelector('[type="submit"]');
    button.disabled = true;
    const { error } = await account.rpc("admin_add", { p_who: who });
    button.disabled = false;
    if (error) return teamSay(TEAM_ERRORS[error.code] || "Not added. Try again.");
    teamForm.reset();
    teamSay(`${who} is now an admin. They'll see the panel next time they sign in.`, true);
    loadTeam();
    loadMembers(true);
  });

  // ---------- Members: every account, for the owner ----------
  const membersBox = page.querySelector(".admin-members");
  const memberList = membersBox.querySelector(".admin-members__list");
  const memberSearch = membersBox.querySelector(".admin-members__search");
  const memberMore = membersBox.querySelector(".admin-members__more");
  const memberTotal = membersBox.querySelector(".admin-members__total");
  const memberSay = (text, ok) => {
    const note = membersBox.querySelector(".admin-members__message");
    note.textContent = text;
    note.classList.toggle("is-ok", Boolean(ok));
  };
  const PAGE = 50;
  let memberOffset = 0;
  let memberTurn = 0;
  // A button that asks once more before it acts.
  const twice = (label, ask, className, act) => {
    const button = make("button", className, label);
    button.type = "button";
    button.addEventListener("click", async () => {
      if (!button.dataset.armed) {
        button.dataset.armed = "1";
        button.textContent = ask;
        setTimeout(() => {
          delete button.dataset.armed;
          button.textContent = label;
        }, 4000);
        return;
      }
      button.disabled = true;
      await act();
      button.disabled = false;
    });
    return button;
  };
  const memberRow = (m) => {
    const row = make("li", m.locked ? "admin-coupon admin-member is-off" : "admin-coupon admin-member");
    const face = make("img", "admin-member__face");
    face.src = m.avatar_url || "assets/avatar-default.svg";
    face.alt = "";
    face.loading = "lazy";
    face.onerror = () => (face.src = "assets/avatar-default.svg");
    const main = make("div", "admin-coupon__main");
    const name = make("strong", "", m.name || m.email.split("@")[0]);
    name.dir = "auto";
    const email = make("span", "selectable", m.email);
    email.dir = "ltr";
    const facts = [
      `joined ${whenText(m.created_at)}`,
      m.last_sign_in_at ? `last in ${whenText(m.last_sign_in_at)}` : "never signed in",
      m.providers ? `via ${m.providers}` : "",
      m.orders ? `${m.orders} order${m.orders === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    main.append(name, email, make("span", "", facts.join(" · ")));
    const side = make("div", "admin-file__side");
    if (m.role) side.append(make("span", m.role === "owner" ? "admin-team__role is-owner" : "admin-team__role", m.role === "owner" ? "Owner" : "Admin"));
    if (m.locked) side.append(make("span", "admin-team__role is-locked", "Locked"));
    if (m.role !== "owner") {
      if (!m.role) {
        const promote = make("button", "admin-button", "Make admin");
        promote.type = "button";
        promote.addEventListener("click", async () => {
          promote.disabled = true;
          const { error } = await account.rpc("owner_make_admin", { p_user: m.user_id });
          promote.disabled = false;
          if (error) return memberSay(TEAM_ERRORS[error.code] || "Not changed. Try again.");
          memberSay(`${m.email} is now an admin.`, true);
          loadTeam();
          row.replaceWith(memberRow({ ...m, role: "admin" }));
        });
        side.append(promote);
      }
      const doLock = async () => {
        const { error } = await account.rpc("owner_lock", { p_user: m.user_id, p_lock: !m.locked });
        if (error) return memberSay(TEAM_ERRORS[error.code] || "Not changed. Try again.");
        memberSay(m.locked ? `${m.email} can sign in again.` : `${m.email} is locked and signed out everywhere.`, true);
        row.replaceWith(memberRow({ ...m, locked: !m.locked }));
      };
      if (m.locked) {
        const unlock = make("button", "admin-button", "Unlock");
        unlock.type = "button";
        unlock.addEventListener("click", doLock);
        side.append(unlock);
      } else side.append(twice("Lock", "Lock and sign out?", "admin-button", doLock));
      side.append(
        twice("Delete", "Delete forever?", "admin-button admin-button--danger", async () => {
          const { error } = await account.rpc("owner_delete_user", { p_user: m.user_id });
          if (error) return memberSay(TEAM_ERRORS[error.code] || "Not deleted. Try again.");
          memberSay(`${m.email}'s account is deleted.`, true);
          row.remove();
          loadTeam();
        })
      );
    }
    row.append(face, main, side);
    return row;
  };
  const loadMembers = async (fresh) => {
    const turn = ++memberTurn;
    if (fresh) memberOffset = 0;
    const { data, error } = await account.rpc("owner_users", { p_query: memberSearch.value.trim(), p_limit: PAGE, p_offset: memberOffset });
    if (turn !== memberTurn) return;
    if (error) return memberSay("Members couldn't be loaded. Reload the page to try again.");
    const rows = data.map(memberRow);
    if (fresh) memberList.replaceChildren(...rows);
    else memberList.append(...rows);
    memberOffset += data.length;
    const total = data.length ? Number(data[0].total) : fresh ? 0 : memberOffset;
    memberTotal.textContent = `(${total})`;
    memberMore.hidden = memberOffset >= total;
    if (fresh && !data.length) memberSay(memberSearch.value.trim() ? "No account matches that." : "No accounts yet.");
    else if (fresh) memberSay("");
  };
  let memberTimer = 0;
  memberSearch.addEventListener("input", () => {
    clearTimeout(memberTimer);
    memberTimer = setTimeout(() => loadMembers(true), 300);
  });
  memberMore.addEventListener("click", () => loadMembers(false));
  loadTeam();

  // ---------- Files for buyers ----------
  // The file goes straight from this browser into the R2 bucket, through a
  // link the library function signs; then the build is saved here.
  const fileForm = page.querySelector(".admin-files");
  const fileMessage = fileForm.querySelector(".admin-message");
  const fileWork = fileForm.querySelector("#file-work");
  const fileInput = fileForm.querySelector("#file-input");
  const fileVersion = fileForm.querySelector("#file-version");
  const filePlatform = fileForm.querySelector("#file-platform");
  const filePublished = fileForm.querySelector("#file-published");
  const fileEntrypoint = fileForm.querySelector("#file-entrypoint");
  const fileProgress = fileForm.querySelector(".admin-files__progress");
  const fileList = fileForm.querySelector(".admin-files__list");
  const fileSubmit = fileForm.querySelector('[type="submit"]');
  const fileSay = (text, ok) => {
    fileMessage.textContent = text;
    fileMessage.classList.toggle("is-ok", Boolean(ok));
  };
  const FILE_ERRORS = {
    not_configured: "The storage secrets (R2_… / S3_HOST) aren't set in Supabase yet (Edge Functions → Secrets).",
    signed_out: "Your session has ended. Log in again.",
    forbidden: "Only admins can do this.",
  };
  let workTitles = {};
  const fileRow = (build) => {
    const row = make("li", "admin-file");
    const main = make("div", "admin-file__main");
    main.append(
      make("strong", "", `${workTitles[build.work_id] || build.work_id} · ${PLATFORMS[build.platform] || build.platform} · v${build.version}`),
      make("span", "", `${build.file_name}${build.size_bytes ? ` · ${fileSize(build.size_bytes)}` : ""} · ${whenText(build.created_at)}`)
    );
    const side = make("div", "admin-file__side");
    const toggle = make("label", "admin-check");
    const box = make("input");
    box.type = "checkbox";
    box.checked = build.published;
    toggle.append(box, make("span", "", "Published"));
    box.addEventListener("change", async () => {
      box.disabled = true;
      const { error } = await account.from("builds").update({ published: box.checked }).eq("id", build.id);
      if (error) { box.checked = !box.checked; fileSay("Could not publish this file. Check its checksum, size and executable path."); }
      box.disabled = false;
    });
    const remove = make("button", "admin-button admin-button--danger", "Delete");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      // Press twice: the first press asks.
      if (!remove.dataset.armed) {
        remove.dataset.armed = "1";
        remove.textContent = "Delete the file?";
        setTimeout(() => {
          delete remove.dataset.armed;
          remove.textContent = "Delete";
        }, 4000);
        return;
      }
      remove.disabled = true;
      const answer = await library({ action: "delete", build_id: build.id }, await verifiedSession());
      if (answer.ok) return row.remove();
      remove.disabled = false;
      fileSay(FILE_ERRORS[answer.error] || "The file wasn't deleted. Try again.");
    });
    side.append(toggle, remove);
    row.append(main, side);
    return row;
  };
  const loadFiles = async () => {
    const [{ data: works }, { data: builds }] = await Promise.all([
      account.from("works").select("id, title").order("sort"),
      account.from("builds").select("*").order("created_at", { ascending: false }),
    ]);
    workTitles = Object.fromEntries((works || []).map((w) => [w.id, w.title]));
    if (!fileWork.options.length)
      (works || []).forEach((w) => {
        const option = make("option", "", w.title);
        option.value = w.id;
        fileWork.append(option);
      });
    fileList.replaceChildren(...(builds || []).map(fileRow));
  };
  // PUT with progress (fetch can't report upload progress).
  const put = (url, file) =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => e.lengthComputable && (fileProgress.value = e.loaded / e.total);
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
  fileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    const version = fileVersion.value.trim();
    if (!fileWork.value) return fileSay("Choose a work.");
    if (!version) return fileSay("Enter the version, such as 1.0.0.");
    if (!file) return fileSay("Choose the file to upload.");
    if (file.size > 5e9) return fileSay("Files over 5 GB can't be uploaded here. Upload it with rclone or wrangler, then tell Claude.");
    const entrypoint = fileEntrypoint.value.trim();
    if (filePlatform.value === "windows" && (!/^[A-Za-z0-9_-][A-Za-z0-9_ ./-]*[.]exe$/.test(entrypoint) || entrypoint.split("/").some(p => !p || p === "." || p === ".." || /[. ]$/.test(p))))
      return fileSay("Enter the game's executable path inside the ZIP, such as bin/Game.exe.");
    if (filePlatform.value === "windows" && !/\.(zip|exe)$/i.test(file.name)) return fileSay("Windows builds must be ZIP or EXE files.");
    if (!file.size) return fileSay("The file is empty.");
    fileSubmit.disabled = true;
    fileSay("Checking the file…", true);
    let sha256;
    try {
      const { hashFile } = await import("./hash-file.mjs");
      sha256 = await hashFile(file);
    } catch {
      fileSubmit.disabled = false;
      return fileSay("Couldn't check the file. Nothing was uploaded. Try again.");
    }
    fileSay("Getting the upload ready…", true);
    const answer = await library({ action: "upload", work_id: fileWork.value, file_name: file.name }, await verifiedSession());
    if (!answer.url) {
      fileSubmit.disabled = false;
      return fileSay(FILE_ERRORS[answer.error] || "Couldn't start the upload. Try again.");
    }
    fileSay(`Uploading ${file.name}…`, true);
    fileProgress.value = 0;
    fileProgress.hidden = false;
    const uploaded = await put(answer.url, file);
    fileProgress.hidden = true;
    if (!uploaded) {
      fileSubmit.disabled = false;
      return fileSay("The upload failed. Check the bucket's CORS settings and your connection, then try again.");
    }
    const { error } = await account.from("builds").insert({
      work_id: fileWork.value,
      platform: filePlatform.value,
      version,
      file_key: answer.key,
      file_name: file.name,
      size_bytes: file.size,
      sha256,
      entrypoint: filePlatform.value === "windows" ? entrypoint : null,
      published: filePublished.checked,
    });
    fileSubmit.disabled = false;
    if (error) return fileSay("The file is uploaded, but it wasn't saved to the list. Try again.");
    fileSay(filePublished.checked ? "Uploaded. Buyers can download it now." : "Uploaded. Publish it when it's ready for buyers.", true);
    fileForm.reset();
    loadFiles();
  });
  loadFiles();

  showList();
})();

// Checkout (checkout.html?id=<id>) — one work, for members; or a plan
// (checkout.html?plan=iron|gold|titanium&days=7|30|90|180|365). The
// order is saved as "awaiting payment"; the database fills in the title,
// price (less the member's plan discount and any code) and email itself, so
// nothing here can change what's charged. When online payment is open, the
// member goes on to Zarinpal, which sends them back to
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
      paid: plan
        ? ["Payment received", "Thank you! Your plan is on, and its discount now comes off every work. See it in your profile."]
        : ["Payment received", "Thank you! The order is paid and shows in your profile. Keep the reference number for any questions."],
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
  let plan = null;
  const returning = params.get("order");
  if (returning) {
    gate.textContent = "Checking your payment…";
    const answer = await payment({
      action: "verify",
      order_id: returning,
      authority: params.get("Authority") || "",
      status: params.get("Status") || "",
    });
    // Keep the authority on reload: verification is idempotent and a failed
    // database write must be retryable without starting another payment.
    if (answer.error === "not_found" || answer.error === "bad_request") return show(missing);
    if (answer.error) {
      gate.textContent = t(PAYMENT_ERRORS[answer.error] || "Couldn't reach the payment service. Reload the page in a moment to check again.");
      return;
    }
    plan = answer.plan || null;
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
  const { settings } = await site;
  const planId = params.get("plan");
  plan = planId ? (settings.plans || []).find((p) => p.id === planId && p.on_sale && Object.keys(p.prices || {}).length) || null : null;
  // The plan's length (checkout.html?plan=…&days=…): a month unless another is asked for.
  let planDays = Number(params.get("days")) || 30;
  if (plan && plan.prices[planDays] == null) planDays = plan.prices[30] != null ? 30 : Number(Object.keys(plan.prices)[0]);
  const id = params.get("id");
  const work = plan ? null : (await catalog).find((w) => w.id === id);
  if (!plan && (!work || !work.prices || work.prices.IRR == null)) return show(missing);
  if (work) {
    const { data: owned, error } = await account.rpc("owns_work", { p_work: work.id });
    if (error) { show(missing); return; }
    if (owned) return location.replace("profile.html#library");
  }
  const membership = await myMembership();

  // Already ordered: that order is in the profile. (One unpaid plan order
  // at a time, too.)
  let openQuery = account
    .from("orders")
    .select("id")
    .eq("user_id", user.id)
    .in("status", plan ? ["awaiting_payment"] : ["awaiting_payment", "paid", "processing", "completed"])
    .limit(1);
  openQuery = plan ? openQuery.not("plan_id", "is", null) : openQuery.eq("work_id", work.id);
  const { data: open } = await openQuery;
  if (open && open.length) return location.replace("profile.html#orders");

  form.querySelectorAll(".checkout-card__step").forEach((step) => (step.textContent = digits(step.textContent)));
  const back = form.querySelector('[data-slot="back"]');
  const poster = form.querySelector(".checkout-summary__poster");
  let rials;
  let member = 0;
  if (plan) {
    document.title = `Checkout · ${planName(plan.id)} · SauFox Entertainment`;
    back.href = "index.html#plans";
    back.querySelector("span").textContent = "Back to plans";
    poster.replaceWith(Object.assign(document.createElement("span"), { className: `checkout-summary__plan is-${plan.id}`, textContent: planName(plan.id) }));
    form.querySelector(".checkout-summary__kind").textContent = "Subscription";
    const name = form.querySelector(".checkout-summary__name");
    name.textContent = `${planName(plan.id)} plan`;
    name.removeAttribute("translate");
    const mine = membership && membership.plan === plan.id;
    const edition = () =>
      (form.querySelector(".checkout-summary__edition").textContent = mine
        ? `${lengthName(planDays)}, added after your current plan ends on ${dateText(membership.ends_at)}`
        : `${lengthName(planDays)}, starting as soon as you pay`);
    edition();
    form.querySelector(".checkout-coupon").hidden = true;
    rials = plan.prices[planDays];
    // The length can be changed here too.
    const lengthBox = document.createElement("label");
    lengthBox.className = "checkout-length";
    const lengthLabel = document.createElement("span");
    lengthLabel.textContent = "Length";
    const pick = document.createElement("select");
    PLAN_LENGTHS.filter(([d]) => plan.prices[d] != null).forEach(([d, label]) => {
      const option = new Option(`${t(label)} · ${money.IRR(plan.prices[d])}`, d);
      pick.append(option);
    });
    pick.value = String(planDays);
    lengthBox.append(lengthLabel, pick);
    form.querySelector(".checkout-coupon").after(lengthBox);
    pick.addEventListener("change", () => {
      planDays = Number(pick.value);
      rials = plan.prices[planDays];
      form.querySelector('[data-slot="price"]').textContent = money.IRR(rials);
      showTotal(rials);
      edition();
      history.replaceState(null, "", `checkout.html?plan=${encodeURIComponent(plan.id)}&days=${planDays}`);
    });
    // A lower plan than the one running now would add nothing.
    const current = membership && (settings.plans || []).find((p) => p.id === membership.plan);
    if (current && current.rank > plan.rank) {
      submit.disabled = true;
      say(`Your ${planName(current.id)} plan already includes everything in ${planName(plan.id)}.`);
    }
  } else {
    document.title = `Checkout · ${work.title} · SauFox Entertainment`;
    back.href = workUrl(work.id);
    if (work.images[0]) poster.src = work.images[0];
    else poster.hidden = true;
    form.querySelector(".checkout-summary__kind").textContent = work.kind;
    form.querySelector(".checkout-summary__name").textContent = work.title;
    form.querySelector(".checkout-summary__edition").textContent =
      work.status === "released" ? "Digital edition" : "Pre-order · in your Library on release day";
    rials = work.prices.IRR;
    // The member's plan discount, as the database works it out.
    if (membership) {
      const { data } = await account.rpc("price_for", { work: work.id });
      member = (data && data.member_discount) || 0;
    }
  }
  form.querySelector('[data-slot="price"]').textContent = money.IRR(rials);
  if (member) {
    form.querySelector(".checkout-summary__member").hidden = false;
    form.querySelector('[data-slot="member-label"]').textContent = t(
      `${planName(membership.plan)} plan (${membership.discount_percent}% off)`
    );
    form.querySelector('[data-slot="member"]').textContent = `− ${money.IRR(member)}`;
  }
  const total = form.querySelector('[data-slot="total"]');
  const showTotal = (amount) => {
    total.textContent = money.IRR(amount);
    const tomans = document.createElement("small");
    tomans.textContent = LANG === "fa" ? `${num(Math.round(amount / 10))} تومان` : `${num(Math.round(amount / 10))} Tomans`;
    total.append(tomans);
  };
  showTotal(rials - member);

  // Discount code: checked here to show the new total; the database checks
  // it again, and works out the price itself, when the order is saved.
  const couponInput = form.querySelector("#coupon-code");
  const couponApply = form.querySelector('[data-action="apply-coupon"]');
  const couponNote = form.querySelector(".checkout-coupon__note");
  const discountRow = form.querySelector(".checkout-summary__discount");
  const COUPON_REASONS = {
    unknown: "That code isn't valid.",
    expired: "That code has expired.",
    not_started: "That code isn't active yet.",
    used_up: "That code has been used up.",
    already_used: "You've already used that code.",
    other_work: "That code is for a different work.",
    signed_out: "Log in again to use a code.",
  };
  let coupon = null;
  const setCoupon = (quote) => {
    coupon = quote;
    discountRow.hidden = !quote;
    if (quote) {
      form.querySelector('[data-slot="discount-label"]').textContent = t(`Discount (${quote.code})`);
      form.querySelector('[data-slot="discount"]').textContent = `− ${money.IRR(quote.discount)}`;
    }
    showTotal(quote ? quote.total : rials - member);
    couponApply.textContent = t(quote ? "Remove" : "Apply");
  };
  couponApply.addEventListener("click", async () => {
    if (coupon) {
      setCoupon(null);
      couponInput.value = "";
      couponInput.disabled = false;
      couponNote.textContent = "";
      return;
    }
    const code = couponInput.value.trim().toUpperCase();
    if (!code) return couponInput.focus();
    couponApply.disabled = true;
    const { data, error } = await account.rpc("check_coupon", { code, work: work.id });
    couponApply.disabled = false;
    couponNote.classList.toggle("is-ok", Boolean(data && data.ok));
    if (error || !data) return (couponNote.textContent = t("Couldn't check the code. Check your connection and try again."));
    if (!data.ok) return (couponNote.textContent = t(COUPON_REASONS[data.reason] || COUPON_REASONS.unknown));
    couponInput.value = data.code;
    couponInput.disabled = true;
    couponNote.textContent = t(`Code applied: you save ${money.IRR(data.discount)}.`);
    setCoupon(data);
  });
  couponInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      couponApply.click();
    }
  });
  const others = plan ? [] : ["USD", "EUR"].filter((code) => work.prices[code] != null).map((code) => `≈ ${money[code](work.prices[code])}`);
  if (others.length && !member) {
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
      .insert(plan ? { plan_id: plan.id, plan_days: planDays, name, phone } : { work_id: work.id, name, phone, ...(coupon ? { coupon_code: coupon.code } : {}) })
      .select("id, number")
      .single();
    if (error) {
      submit.disabled = false;
      if (error.code === "23505") return location.replace("profile.html#orders");
      if (error.code === "SF002") {
        // The code stopped working meanwhile (used up, expired…).
        const reason = (error.message.match(/coupon: (\w+)/) || [])[1];
        setCoupon(null);
        couponInput.disabled = false;
        couponNote.classList.remove("is-ok");
        couponNote.textContent = t(COUPON_REASONS[reason] || COUPON_REASONS.unknown);
        return say("The discount code no longer works, so the price is back to full. Check it and place the order again.");
      }
      if (error.code === "SF001") {
        submit.disabled = true;
        return say(SALES_PAUSED);
      }
      if (error.code === "SF003") return say("Your current plan already includes this one.");
      if (error.code === "P0001")
        return say(plan ? "This plan isn't on sale right now." : "This work isn't on sale right now. Reload the page to see its latest details.");
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
// portal-signin.html: sends the signed-in member on to the customer portal
// with a one-time sign-in (the same kind the launcher gets). The portal's
// address is fixed here, so the code can't be sent anywhere else.
(async function portalSignin() {
  const page = document.querySelector(".portal-page");
  if (!page) return;
  const PORTAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? `${location.protocol}//${location.hostname}:8767/`
    : "https://portal.saufoxentertainment.ir/";
  const title = page.querySelector(".status__title");
  const text = page.querySelector(".status__text");
  const actions = page.querySelector(".status__actions");
  const session = await verifiedSession();
  if (!session) return goLogin();
  const answer = await callFunction("library", { action: "launcher-token" }, session);
  if (!answer || !answer.token_hash) {
    title.textContent = t("The portal couldn't be opened");
    text.textContent = t("Check your connection and try again.");
    const again = document.createElement("button");
    again.className = "status__button";
    again.type = "button";
    again.textContent = t("Try again");
    again.addEventListener("click", () => location.reload());
    actions.replaceChildren(again);
    return;
  }
  location.replace(`${PORTAL}#signin=${encodeURIComponent(answer.token_hash)}`);
})();

(function statusPage() {
  const page = document.querySelector(".status:not(.launcher-page):not(.portal-page)");
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

// Launcher sign-in (launcher.html?port=…&state=…) — the SauFox launcher on
// this computer opens this page in the browser. Once the member agrees,
// the page sends them back to the launcher's local address with a one-time
// sign-in (see the "library" Edge Function); the launcher makes its own
// session from it, so this browser's session stays here.
(async function launcherPage() {
  const page = document.querySelector(".launcher-page");
  if (!page) return;
  const title = page.querySelector(".status__title");
  const text = page.querySelector(".status__text");
  const actions = page.querySelector(".status__actions");
  const hint = page.querySelector(".status__hint");
  const params = new URLSearchParams(location.search);
  const port = Number(params.get("port"));
  const state = params.get("state") || "";
  if (!(Number.isInteger(port) && port >= 1024 && port <= 65535 && /^[A-Za-z0-9_-]{16,128}$/.test(state))) {
    title.textContent = "This link isn't from the SauFox launcher";
    text.textContent = "Open the launcher and choose Sign in there.";
    return;
  }
  const callback = (query) => `http://127.0.0.1:${port}/callback?${new URLSearchParams({ state, ...query })}`;
  const session = await verifiedSession();
  if (!session) return goLogin();

  title.textContent = "Sign in to the SauFox launcher?";
  text.textContent = `The launcher on this computer will be signed in as ${session.user.email}. Only allow it if you just opened it yourself.`;
  const button = (label, primary) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = primary ? "status__button status__button--primary" : "status__button";
    b.textContent = label;
    return b;
  };
  const allow = button("Allow", true);
  const cancel = button("Cancel");
  actions.replaceChildren(allow, cancel);
  allow.addEventListener("click", async () => {
    allow.disabled = cancel.disabled = true;
    hint.textContent = "Signing the launcher in…";
    const answer = await library({ action: "launcher-token" }, await verifiedSession());
    if (!answer.token_hash) {
      allow.disabled = cancel.disabled = false;
      hint.textContent = "That didn't work. Try again in a moment.";
      return;
    }
    title.textContent = "You're signed in to the launcher";
    text.textContent = "You can close this tab and go back to the launcher.";
    actions.replaceChildren();
    hint.textContent = "";
    location.href = callback({ token_hash: answer.token_hash, email: answer.email });
  });
  cancel.addEventListener("click", () => {
    title.textContent = "Sign-in cancelled";
    text.textContent = "The launcher wasn't signed in. You can close this tab.";
    actions.replaceChildren();
    location.href = callback({ error: "cancelled" });
  });
})();
