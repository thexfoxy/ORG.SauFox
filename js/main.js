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

// Section 2 — Hero: collage of random artwork from the studio's releases.
// Placeholders for now: replace or extend WORKS with real artwork
// (portrait images work best).
const WORKS = Array.from({ length: 14 }, (_, i) =>
  `assets/works/placeholder-${String(i + 1).padStart(2, "0")}.svg`
);

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

  build();
  narrow.addEventListener("change", build);
  setInterval(swap, SWAP_EVERY);
})();


// Section 4 — Work cards. Placeholder catalogue until the real one exists.
// images: 1-based positions in WORKS.
// status: released | preorder | coming | production
const CATALOG = [
  { title: "Ember Road", kind: "Game", images: [2, 7, 13], prices: { USD: 19.99, EUR: 18.49, IRR: 12500000 }, status: "released" },
  { title: "Paper Foxes", kind: "Animated series", images: [6, 1, 11], prices: { USD: 9.99, EUR: 9.29, IRR: 6200000 }, status: "preorder" },
  { title: "The Quiet Hour", kind: "Short film", images: [3, 10, 14], prices: { USD: 4.99, EUR: 4.59, IRR: 3100000 }, status: "coming" },
  { title: "Salt and Ash", kind: "Novel", images: [4, 9, 12], prices: { USD: 14.99, EUR: 13.89, IRR: 9400000 }, status: "production" },
  { title: "Lantern Tide", kind: "Game", images: [5, 8, 1], prices: { USD: 24.99, EUR: 23.19, IRR: 15600000 }, status: "released" },
  { title: "Nine Winters", kind: "Feature film", images: [10, 3, 6], prices: { USD: 7.99, EUR: 7.39, IRR: 5000000 }, status: "released" },
  { title: "Kettle Spirits", kind: "Animated short", images: [11, 2, 9], prices: { USD: 3.99, EUR: 3.69, IRR: 2500000 }, status: "coming" },
  { title: "Ashen Crown", kind: "Novel", images: [12, 5, 7], prices: { USD: 12.99, EUR: 11.99, IRR: 8100000 }, status: "preorder" },
  { title: "Glass Orchard", kind: "Game", images: [13, 4, 10], prices: { USD: 29.99, EUR: 27.79, IRR: 18700000 }, status: "production" },
  { title: "Night Train to Kerman", kind: "Feature film", images: [14, 6, 2], prices: { USD: 8.99, EUR: 8.29, IRR: 5600000 }, status: "coming" },
  { title: "Moth and Moon", kind: "Novel", images: [1, 12, 8], prices: { USD: 11.99, EUR: 11.09, IRR: 7500000 }, status: "released" },
  { title: "Copper Sky", kind: "Short film", images: [9, 14, 5], prices: { USD: 2.99, EUR: 2.79, IRR: 1900000 }, status: "released" },
];

(function workCards() {
  const section = document.querySelector(".works");
  const track = section && section.querySelector(".works__track");
  if (!track) return;

  const hero = document.querySelector(".hero");
  const empty = section.querySelector(".works__empty");
  const count = section.querySelector(".works__count");
  const range = section.querySelector("#max-price");
  const maxOut = section.querySelector(".works__max");
  const currencyButtons = [...section.querySelectorAll("[data-currency]")];
  const arrows = [...section.querySelectorAll(".works__arrow")];
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
    const slides = work.images.map((n, i) => {
      const img = el("img", "card__slide" + (i === 0 ? " is-active" : ""));
      img.src = WORKS[n - 1];
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
  const filterCurrency = () => (mode === "auto" ? "USD" : mode);

  currencyButtons.forEach((button) =>
    button.addEventListener("click", () => {
      const fraction = (range.value - range.min) / (range.max - range.min || 1);
      mode = button.dataset.currency;
      currencyButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      if (mode !== "auto") cards.forEach((c) => c.showCurrency(CURRENCIES.indexOf(mode)));
      setupRange(fraction);
    })
  );

  // ---------- Max price filter ----------
  // The slider works in the chosen currency (USD while on Auto); switching
  // currency keeps the handle where it was.
  const setupRange = (fraction = 1) => {
    const code = filterCurrency();
    const values = CATALOG.map((w) => w.prices[code]);
    const stepSize = code === "IRR" ? 100000 : 0.5;
    const min = Math.floor(Math.min(...values) / stepSize) * stepSize;
    const max = Math.ceil(Math.max(...values) / stepSize) * stepSize;
    range.min = min;
    range.max = max;
    range.step = stepSize;
    range.value = min + fraction * (max - min);
    applyFilter();
  };

  const applyFilter = () => {
    const code = filterCurrency();
    const limit = Number(range.value);
    maxOut.textContent = money[code](limit);
    let shown = 0;
    cards.forEach(({ work, card }) => {
      const fits = work.prices[code] <= limit;
      card.hidden = !fits;
      if (fits) shown++;
    });
    count.textContent = shown === cards.length ? `${shown} works` : `${shown} of ${cards.length} works`;
    empty.hidden = shown > 0;
    track.scrollLeft = 0;
    updateArrows();
  };

  range.addEventListener("input", applyFilter);

  // ---------- Sliding: arrows and mouse drag ----------
  const cardStep = () => {
    const first = cards.find((c) => !c.card.hidden);
    if (!first) return 0;
    return first.card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
  };

  const updateArrows = () => {
    const end = track.scrollWidth - track.clientWidth - 2;
    arrows[0].disabled = track.scrollLeft <= 2;
    arrows[1].disabled = track.scrollLeft >= end;
  };

  arrows.forEach((arrow) =>
    arrow.addEventListener("click", () => track.scrollBy({ left: Number(arrow.dataset.dir) * cardStep() }))
  );
  track.addEventListener("scroll", updateArrows, { passive: true });

  let drag = null;
  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = { x: event.clientX, left: track.scrollLeft, moved: false };
  });
  window.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      track.classList.add("is-dragging");
    }
    if (drag.moved) track.scrollLeft = drag.left - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    track.classList.remove("is-dragging");
    // Swallow the click that ends a drag so it doesn't hit a card button.
    if (moved) track.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true });
  });

  // ---------- Fade under the hero ----------
  // The hero's bottom edge (see its mask in css/style.css), in its
  // 1440 x 520 viewBox: flat at y=370 up to x=460, a cubic down to
  // (1200, 520), then flat. The row gets a mask that is transparent above
  // that edge and fades in over FADE px below it.
  const FADE = 90;
  const P = [[1200, 520], [900, 520], [780, 370], [460, 370]];
  const heroEdgeY = (fraction) => {
    const x = fraction * 1440;
    if (x <= 460) return 370;
    if (x >= 1200) return 520;
    const at = (t, k) =>
      (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t ** 2 * P[2][k] + t ** 3 * P[3][k];
    let lo = 0;
    let hi = 1; // x falls as t rises
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid, 0) > x) lo = mid;
      else hi = mid;
    }
    return at((lo + hi) / 2, 1);
  };

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

  setupRange();
  updateMask();
  new ResizeObserver(updateMask).observe(track);
  window.addEventListener("resize", updateMask);
  if (document.fonts) document.fonts.ready.then(updateMask);
})();
