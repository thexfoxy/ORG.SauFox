// SauFox Entertainment — site scripts

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

  try {
    const avatar = localStorage.getItem("saufox.avatar");
    if (avatar) chip.querySelector("img").src = avatar;
  } catch (e) {}

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

// Section 2 — Hero: collage of random artwork from the studio's releases.
// WORKS and CATALOG come from js/content.js.

(function heroCollage() {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const narrow = window.matchMedia("(max-width: 700px)");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const SWAP_EVERY = 4500;

  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const art = (src) => {
    const el = document.createElement("span");
    el.className = "hero__art";
    el.style.backgroundImage = `url("${src}")`;
    el.dataset.src = src;
    return el;
  };

  const build = () => {
    const count = narrow.matches ? 5 : 7;
    hero.style.setProperty("--n", count);
    hero.replaceChildren(
      ...shuffle(WORKS)
        .slice(0, count)
        .map((src, i) => {
          const panel = document.createElement("div");
          panel.className = "hero__panel";
          panel.style.setProperty("--i", i);
          panel.append(art(src));
          return panel;
        })
    );
  };

  // Every few seconds one random panel crossfades to a work not on screen.
  const swap = () => {
    if (document.hidden || calm.matches) return;
    const panels = [...hero.children];
    const shown = new Set(panels.map((p) => p.lastElementChild.dataset.src));
    const unused = WORKS.filter((src) => !shown.has(src));
    if (!unused.length) return;

    const panel = panels[Math.floor(Math.random() * panels.length)];
    const next = art(unused[Math.floor(Math.random() * unused.length)]);
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

  build();
  clipPanels();
  narrow.addEventListener("change", () => {
    build();
    clipPanels();
  });
  new ResizeObserver(clipPanels).observe(hero);
  setInterval(swap, SWAP_EVERY);
})();


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

    const media = el("div", "card__media");
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
    media.append(...slides, caption, dots);

    const price = el("div", "card__price");
    const priceTrack = el("div", "card__price-track");
    const amounts = CURRENCIES.map((code, i) => {
      const amount = el("span", "card__amount" + (i === 0 ? " is-active" : ""), money[code](work.prices[code]));
      priceTrack.append(amount);
      return amount;
    });
    price.append(el("span", "card__price-label", "Price"), priceTrack);

    const status = el("span", `card__status card__status--${work.status}`, STATUS[work.status]);

    card.append(media, price, status);
    track.append(card);

    // Image slider: every 4s, paused while the pointer is on the image.
    let slide = 0;
    let paused = false;
    const showSlide = (i) => {
      slide = i;
      step(slides, i);
      step(dotButtons, i);
    };
    dotButtons.forEach((dot, i) => dot.addEventListener("click", () => showSlide(i)));
    media.addEventListener("pointerenter", () => (paused = true));
    media.addEventListener("pointerleave", () => (paused = false));

    // Price: cycles every 2.6s in "auto" mode; staggered per card.
    let currency = 0;
    const showCurrency = (i) => {
      if (i === currency) return;
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

    return { work, card, showCurrency };
  });

  // ---------- Currency buttons ----------
  currencyButtons.forEach((button) =>
    button.addEventListener("click", () => {
      mode = button.dataset.currency;
      currencyButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      if (mode !== "auto") cards.forEach((c) => c.showCurrency(CURRENCIES.indexOf(mode)));
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

  // ---------- Sliding: drag, like a touch screen, on every device ----------
  // Phones use native touch scrolling. With a mouse the row follows the
  // pointer, then glides on with the release speed and settles on a card.
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

    // Swallow the click that ends a drag so it doesn't hit a card button.
    track.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true });

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
  const isField = (el) => el instanceof Element && el.closest("input, textarea, [contenteditable]");
  document.addEventListener("contextmenu", (e) => { if (!isField(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (e.target instanceof HTMLImageElement) e.preventDefault(); });
  ["copy", "cut"].forEach((type) =>
    document.addEventListener(type, (e) => { if (!isField(e.target)) e.preventDefault(); })
  );
})();

// Login page — background strips, curved art layers, Login / Sign Up tabs
// with sliding forms, and password reveal.
// There is no account server yet: a valid form only marks this browser as
// signed in (localStorage) so the header shows the profile button.
(function loginPage() {
  const auth = document.querySelector(".auth");
  if (!auth) return;

  const shuffled = WORKS.slice().sort(() => Math.random() - 0.5);

  // Background strips
  const bg = document.querySelector(".login-bg");
  const count = window.matchMedia("(max-width: 760px)").matches ? 4 : 6;
  bg.style.setProperty("--n", count);
  shuffled.slice(0, count).forEach((src, i) => {
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
    band.style.backgroundImage = `url("${shuffled[count + i]}")`;
  });
  auth.querySelector(".auth__art").style.backgroundImage = `url("${shuffled[count + 3]}")`;

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

  Object.entries(forms).forEach(([key, form]) =>
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = form.querySelector(".auth__message");
      const error = problem(form);
      if (error) return say(message, error);

      try {
        localStorage.setItem("saufox.session", form.querySelector('input[type="email"]').value);
        localStorage.setItem("saufox.hasAccount", "1");
        const name = form.querySelector('input[name="name"]');
        if (name) localStorage.setItem("saufox.name", name.value.trim());
        if (!localStorage.getItem("saufox.since")) localStorage.setItem("saufox.since", new Date().toISOString());
      } catch (e) {}
      say(message, key === "login" ? "Welcome back. Taking you home…" : "Account created. Taking you home…", true);
      setTimeout(() => (location.href = "index.html"), 1100);
    })
  );

  const socialMessage = auth.querySelector(".auth__message--social");
  auth.querySelectorAll(".social").forEach((button) =>
    button.addEventListener("click", () =>
      say(socialMessage, `${button.dataset.provider} sign-in isn't connected yet. Use your email for now.`)
    )
  );
})();

// Profile page — name, email and membership date from this browser's
// sign-in, tabs, and settings (photo, name, default currency, log out).
(function profilePage() {
  const page = document.querySelector(".profile-page");
  if (!page) return;

  const store = {
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

  const DEFAULT_AVATAR = document.querySelector(".profile-avatar__img").getAttribute("src");
  const email = store.get("session") || "";
  const fallbackName = email.split("@")[0] || "SauFox fan";

  // ---------- Header info ----------
  const showName = (name) =>
    page.querySelectorAll('[data-profile="name"]').forEach((el) => (el.textContent = name));
  const showAvatar = (src) =>
    document.querySelectorAll(".profile-avatar__img, .profile-chip img").forEach((img) => (img.src = src));

  if (!store.get("since")) store.set("since", new Date().toISOString());
  const since = new Date(store.get("since"));
  page.querySelector('[data-profile="email"]').textContent = email;
  page.querySelector('[data-profile="since"]').textContent = since.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  showName(store.get("name") || fallbackName);
  showAvatar(store.get("avatar") || DEFAULT_AVATAR);

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

  // ---------- Settings ----------
  const form = page.querySelector(".settings");
  const message = form.querySelector(".auth__message");
  const nameInput = form.querySelector("#settings-name");
  const fileInput = form.querySelector("#avatar-input");
  const preview = form.querySelector(".profile-avatar__img");
  const currencyButtons = [...form.querySelectorAll("[data-currency]")];

  let pendingAvatar = store.get("avatar");
  let currency = store.get("currency") || "auto";

  nameInput.value = store.get("name") || fallbackName;
  preview.src = pendingAvatar || DEFAULT_AVATAR;

  const pressCurrency = () =>
    currencyButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.currency === currency)));
  pressCurrency();
  currencyButtons.forEach((b) =>
    b.addEventListener("click", () => {
      currency = b.dataset.currency;
      pressCurrency();
    })
  );

  const say = (text, ok) => {
    message.textContent = text;
    message.classList.toggle("is-ok", Boolean(ok));
  };

  // Photos are shrunk to 320px on the long side so they fit in storage.
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
      pendingAvatar = canvas.toDataURL("image/jpeg", 0.85);
      preview.src = pendingAvatar;
      URL.revokeObjectURL(img.src);
      say("Photo ready. Save changes to keep it.", true);
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return say("Enter your name.");
    }
    const saved = store.set("name", name) && store.set("avatar", pendingAvatar) && store.set("currency", currency);
    if (!saved) return say("Your browser didn't let us save. Try a smaller photo.");
    showName(name);
    showAvatar(pendingAvatar || DEFAULT_AVATAR);
    say("Saved.", true);
  });

  form.querySelector('[data-action="logout"]').addEventListener("click", () => {
    store.set("session", null);
    location.href = "index.html";
  });
})();
