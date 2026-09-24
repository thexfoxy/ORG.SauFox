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
  {
    title: "Ember Road",
    kind: "Game",
    images: [2, 7, 13],
    prices: { USD: 19.99, EUR: 18.99, IRR: 12500000 },
    status: "released",
  },
  {
    title: "Paper Foxes",
    kind: "Animated series",
    images: [6, 1, 11],
    prices: { USD: 9.99, EUR: 9.49, IRR: 6200000 },
    status: "preorder",
  },
  {
    title: "The Quiet Hour",
    kind: "Short film",
    images: [3, 10, 14],
    prices: { USD: 4.99, EUR: 4.79, IRR: 3100000 },
    status: "coming",
  },
  {
    title: "Salt and Ash",
    kind: "Novel",
    images: [4, 9, 12],
    prices: { USD: 14.99, EUR: 13.99, IRR: 9400000 },
    status: "production",
  },
];

(function workCards() {
  const grid = document.querySelector(".works__grid");
  if (!grid) return;

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const STATUS = {
    released: "Released",
    preorder: "Pre-order",
    coming: "Coming soon",
    production: "In production",
  };
  const money = {
    USD: (n) => `$${n.toFixed(2)}`,
    EUR: (n) => `€${n.toFixed(2)}`,
    IRR: (n) => `${n.toLocaleString("en-US")} Rials`,
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

  CATALOG.forEach((work, index) => {
    const card = el("article", "card");

    // Image slider
    const media = el("div", "card__media");
    const slides = work.images.map((n, i) => {
      const img = el("img", "card__slide" + (i === 0 ? " is-active" : ""));
      img.src = WORKS[n - 1];
      img.alt = i === 0 ? `${work.title} artwork` : "";
      img.loading = "lazy";
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

    // Price strip
    const price = el("div", "card__price");
    const track = el("div", "card__price-track");
    const amounts = Object.entries(work.prices).map(([code, value], i) => {
      const amount = el("span", "card__amount" + (i === 0 ? " is-active" : ""), money[code](value));
      track.append(amount);
      return amount;
    });
    price.append(el("span", "card__price-label", "Price"), track);

    // Status box
    const status = el("span", `card__status card__status--${work.status}`, STATUS[work.status]);

    card.append(media, price, status);
    grid.append(card);

    // Motion: slides every 4s, prices every 2.6s, staggered per card.
    // Hovering the image pauses its slider.
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

    let currency = 0;
    setTimeout(() => {
      setInterval(() => {
        if (document.hidden || calm.matches || paused) return;
        showSlide((slide + 1) % slides.length);
      }, 4000);
      setInterval(() => {
        if (document.hidden || calm.matches) return;
        currency = (currency + 1) % amounts.length;
        step(amounts, currency, "is-leaving");
      }, 2600);
    }, index * 350);
  });
})();
