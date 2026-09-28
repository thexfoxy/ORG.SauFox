// SauFox customer portal (portal.saufoxentertainment.ir).
//
// A separate site on its own subdomain, on the same Supabase project as the
// main site, so tickets, orders and rules are shared (see the main repo's
// README, "Support portal"). Signing in: the main site, where the member is
// already signed in, asks the library function for a one-time sign-in
// (launcher-token) and sends it here in the address (#signin=…); this page
// turns it into its own session with auth.verifyOtp. The main site's session
// is never handed over, and nothing else ever reads that code.
"use strict";

const SUPABASE_URL = "https://gwyqkzhhnspfadqefmix.supabase.co";
const SUPABASE_KEY = "sb_publishable_IB06YrDhrsKJbVghWP-zzg_xDgB1mXN";
// The main site (on this computer while testing).
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const MAIN = LOCAL ? `${location.protocol}//${location.hostname}:8766` : "https://saufoxentertainment.ir";

// ---------- Small helpers ----------
const store = {
  get: (key) => {
    try {
      return localStorage.getItem(`saufox.portal.${key}`);
    } catch (e) {
      return null;
    }
  },
  set: (key, value) => {
    try {
      if (value == null) localStorage.removeItem(`saufox.portal.${key}`);
      else localStorage.setItem(`saufox.portal.${key}`, value);
    } catch (e) {}
  },
};
const LANG = document.documentElement.lang === "fa" ? "fa" : "en";
const FA = {
  "Customer portal": "پرتال مشتریان",
  "Customer portal · SauFox Entertainment": "پرتال مشتریان · ساوفاکس اینترتینمنت",
  "Your tickets, orders and help, in one place.": "تیکت‌ها، سفارش‌ها و راهنما، همه در یک‌جا.",
  "Sign in with your SauFox account": "ورود با حساب ساوفاکس",
  "No account yet?": "هنوز حساب ندارید؟",
  "Create one": "بسازید",
  "Signing you in…": "در حال ورود…",
  "That sign-in link has expired or was already used. Please sign in again.":
    "این لینک ورود منقضی شده یا قبلاً استفاده شده است. لطفاً دوباره وارد شوید.",
  "Couldn't reach the server. Check your connection and reload the page.":
    "به سرور دسترسی نداریم. اینترنت را بررسی کنید و صفحه را دوباره باز کنید.",
  Overview: "داشبورد",
  Tickets: "تیکت‌ها",
  "New ticket": "تیکت جدید",
  Orders: "سفارش‌ها",
  Help: "راهنما",
  "Back to the site": "بازگشت به سایت",
  "Sign out": "خروج",
  "Hello, {name}": "سلام {name}",
  "Here's where your requests and purchases stand.": "وضعیت درخواست‌ها و خریدهای شما این‌جاست.",
  "Waiting for us": "در انتظار پاسخ ما",
  "Waiting for a reply": "در انتظار پاسخ",
  Answered: "پاسخ داده شد",
  Closed: "بسته",
  "New replies": "پاسخ‌های تازه",
  "Open tickets": "تیکت‌های باز",
  Subscription: "اشتراک",
  None: "ندارید",
  "until {date}": "تا {date}",
  "Recent tickets": "تیکت‌های اخیر",
  "See all": "همه",
  "No tickets yet.": "هنوز تیکتی ندارید.",
  "Need help? Open a ticket and we'll answer here, and by email.":
    "کمک لازم دارید؟ یک تیکت باز کنید؛ همین‌جا و با ایمیل پاسخ می‌دهیم.",
  "Recent orders": "سفارش‌های اخیر",
  "No orders yet.": "هنوز سفارشی ندارید.",
  All: "همه",
  "Search tickets": "جست‌وجو در تیکت‌ها",
  "Nothing here.": "موردی نیست.",
  "New reply": "پاسخ تازه",
  Ticket: "تیکت",
  "Opened {date}": "باز شده در {date}",
  "This ticket isn't here. It may belong to another account.": "این تیکت پیدا نشد. شاید مال حساب دیگری باشد.",
  "This ticket is closed. Write below if you need us again, and it opens again.":
    "این تیکت بسته شده است. اگر باز هم کمک لازم دارید، پایین بنویسید تا دوباره باز شود.",
  "Write your reply…": "پاسختان را بنویسید…",
  Attach: "پیوست",
  Send: "ارسال",
  "Close ticket": "بستن تیکت",
  "Close it?": "بسته شود؟",
  Support: "پشتیبانی",
  Topic: "موضوع",
  Order: "سفارش",
  optional: "اختیاری",
  Subject: "عنوان",
  Message: "پیام",
  "Attach a screenshot or PDF": "پیوست اسکرین‌شات یا PDF",
  "Up to 5 MB": "تا ۵ مگابایت",
  Cancel: "انصراف",
  "Send ticket": "ارسال تیکت",
  "An order": "یک سفارش",
  "Account and sign-in": "حساب کاربری و ورود",
  "Technical problem": "مشکل فنی",
  "Something else": "دلیل دیگر",
  "Give your ticket a short subject.": "یک عنوان کوتاه برای تیکت بنویسید.",
  "Write your message.": "پیامتان را بنویسید.",
  "Sending…": "در حال ارسال…",
  "Not sent. Check your connection and try again.": "ارسال نشد. اینترنت را بررسی کنید و دوباره امتحان کنید.",
  "You have 5 tickets still open. Close one you don't need, or write in it instead.":
    "۵ تیکت باز دارید. یکی را که دیگر لازم ندارید ببندید، یا در همان تیکت بنویسید.",
  "Wait a minute before opening another ticket.": "یک دقیقه صبر کنید و بعد تیکت دیگری باز کنید.",
  "Wait a few seconds before sending again.": "چند ثانیه صبر کنید و دوباره بفرستید.",
  "This ticket is full. Please open a new one.": "این تیکت پر شده است. لطفاً تیکت تازه‌ای باز کنید.",
  "Not changed. Try again.": "تغییر نکرد. دوباره امتحان کنید.",
  "Attach an image (JPG, PNG, WebP or GIF) or a PDF.": "یک تصویر (JPG، PNG، WebP یا GIF) یا PDF پیوست کنید.",
  "Files can be up to 5 MB.": "حجم فایل حداکثر ۵ مگابایت است.",
  "The file didn't upload. Try again.": "فایل آپلود نشد. دوباره امتحان کنید.",
  "Your orders": "سفارش‌های شما",
  "Get help": "درخواست کمک",
  "Awaiting payment": "در انتظار پرداخت",
  Paid: "پرداخت شد",
  "In progress": "در حال انجام",
  Completed: "انجام شد",
  Cancelled: "لغو شد",
  Refunded: "بازگشت وجه",
  "Pay or manage it on the site": "پرداخت یا مدیریت در سایت",
  "{name} plan ({days} days)": "اشتراک {name} ({days} روزه)",
  Iron: "آهن",
  Gold: "طلا",
  Titanium: "تیتانیوم",
  "Help and answers": "راهنما و پاسخ‌ها",
  "Quick answers first; if yours isn't there, open a ticket.":
    "اول پاسخ‌های سریع؛ اگر پاسخ سوالتان نبود، تیکت باز کنید.",
  "Account and sign-in help": "حساب کاربری و ورود",
  "Codes, passwords, Google sign-in.": "کد تأیید، رمز عبور، ورود با گوگل.",
  "Buying and payment": "خرید و پرداخت",
  "Paying, receipts, pre-orders.": "پرداخت، رسید، پیش‌خرید.",
  "Refunds and terms": "بازگشت وجه و قوانین",
  "What can be refunded, and how.": "چه چیزی قابل بازگشت است و چطور.",
  Subscriptions: "اشتراک‌ها",
  "Iron, Gold and Titanium plans.": "اشتراک‌های آهن، طلا و تیتانیوم.",
  "Other ways to reach us": "راه‌های دیگر تماس",
  "Email": "ایمیل",
  Phone: "تلفن",
  "Language": "زبان",
  "Open a ticket": "باز کردن تیکت",
  Member: "کاربر",
  "Support desk": "میز پشتیبانی",
  "Reply as SauFox Entertainment…": "پاسخ به‌عنوان ساوفاکس…",
  Reopen: "باز کردن دوباره",
  "Closed. A reply opens it again.": "بسته شده. با پاسخ دادن دوباره باز می‌شود.",
  Back: "بازگشت",
  You: "شما",
  New: "تازه",
  "Search name, email, subject or #": "جست‌وجوی نام، ایمیل، عنوان یا شماره",
  "Pick a conversation.": "یک گفتگو را انتخاب کنید.",
  "This ticket isn't here.": "این تیکت پیدا نشد.",
};
const faDigits = (text) => String(text).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const digits = (text) => (LANG === "fa" ? faDigits(text) : String(text));
const t = (text, values = {}) => {
  let out = LANG === "fa" && FA[text] !== undefined ? FA[text] : text;
  for (const [k, v] of Object.entries(values)) out = out.replace(`{${k}}`, typeof v === "number" ? digits(v) : v);
  return out;
};
const when = (iso, withTime = true) =>
  new Date(iso).toLocaleString(LANG === "fa" ? "fa-IR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: withTime ? undefined : "numeric",
    hour: withTime ? "2-digit" : undefined,
    minute: withTime ? "2-digit" : undefined,
    timeZone: "Asia/Tehran",
  });
const rials = (n) => (LANG === "fa" ? `${Number(n).toLocaleString("fa-IR")} ریال` : `${Number(n).toLocaleString("en-US")} Rials`);

// h("div.class", { attr }, children…): an element. Text children stay text,
// never HTML.
const h = (tag, attrs, ...children) => {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div");
  if (classes.length) el.className = classes.join(" ");
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
};

const TOPICS = {
  order: "An order",
  account: "Account and sign-in",
  technical: "Technical problem",
  subscription: "Subscription",
  other: "Something else",
};
// A member sees their open ticket as waiting for a reply; the desk sees
// it as waiting for us.
const STATUS = { open: "Waiting for a reply", answered: "Answered", closed: "Closed" };
const DESK_STATUS = { ...STATUS, open: "Waiting for us" };
const ORDER_STATUS = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  processing: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
const PLAN_NAMES = { iron: "Iron", gold: "Gold", titanium: "Titanium" };
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

const ICONS = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  tickets: "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM10 6v12",
  plus: "M12 5v14M5 12h14",
  orders: "M6 3h12l1 18H5zM9 7a3 3 0 0 0 6 0",
  help: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5V14M12 17.2v.1",
  back: "M15 5l-7 7 7 7",
  out: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  desk: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  clip: "M20 11.5 12.4 19a5 5 0 0 1-7.1-7.1l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3",
  send: "M4 12 20 4l-4 16-4-7zM12 13l8-9",
};
const icon = (name) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICONS[name]);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
};

document.title = t("Customer portal · SauFox Entertainment");
const app = document.getElementById("app");
const db = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storageKey: "saufox.portal.session", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

// ---------- Motion ----------
// Everything eases out on one curve; none of it runs for visitors who ask
// their system for less motion.
const EASE = "cubic-bezier(.22, 1, .36, 1)";
const SPRING = "cubic-bezier(.34, 1.4, .64, 1)";
const still = window.matchMedia("(prefers-reduced-motion: reduce)");
const moving = () => !still.matches && typeof Element.prototype.animate === "function";

// Rises into place, one after another.
const reveal = (els, { y = 16, step = 55, delay = 0, max = 10, duration = 760 } = {}) => {
  if (!moving()) return;
  [...els].forEach((el, i) =>
    el.animate(
      [
        { opacity: 0, transform: `translateY(${y}px) scale(.985)` },
        { opacity: 1, transform: "none" },
      ],
      { duration, delay: delay + Math.min(i, max) * step, easing: EASE, fill: "backwards" }
    )
  );
};

// Redraws a list, then glides each item from where it was to where it is
// now (items that are new rise in). Items carry data-key.
const flip = (box, render) => {
  const before = new Map();
  if (moving()) box.querySelectorAll(":scope > [data-key]").forEach((el) => before.set(el.dataset.key, el.getBoundingClientRect()));
  render();
  if (!moving()) return;
  let fresh = 0;
  box.querySelectorAll(":scope > [data-key]").forEach((el) => {
    const was = before.get(el.dataset.key);
    if (!was) {
      el.animate(
        [
          { opacity: 0, transform: "translateY(10px) scale(.98)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 520, delay: Math.min(fresh++, 10) * 35, easing: EASE, fill: "backwards" }
      );
      return;
    }
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 640, easing: EASE });
  });
  const empty = box.querySelector(":scope > .empty");
  if (empty) reveal([empty], { y: 8 });
};

// A number that counts up to its value.
const counter = (n, tag = "b.stat__value", delay = 180) => {
  const el = h(tag, digits(n));
  if (!moving() || !n) return el;
  el.textContent = digits(0);
  const start = performance.now() + delay;
  const tick = (now) => {
    const p = Math.max(0, Math.min(1, (now - start) / 1100));
    el.textContent = digits(Math.round(n * (1 - Math.pow(1 - p, 4))));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return el;
};

// A little pop when a badge's number changes.
const pop = (el) =>
  moving() &&
  el.animate([{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1.18)", opacity: 1, offset: 0.6 }, { transform: "scale(1)" }], {
    duration: 520,
    easing: EASE,
  });

// Cards light up where the pointer is.
document.addEventListener(
  "pointermove",
  (e) => {
    const card = e.target.closest && e.target.closest(".glow");
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - box.left}px`);
    card.style.setProperty("--my", `${e.clientY - box.top}px`);
  },
  { passive: true }
);

// Buttons ripple from where they're pressed.
document.addEventListener(
  "pointerdown",
  (e) => {
    const b = e.target.closest && e.target.closest(".button, .chip, .chat__send, .chat__attach, .side__link");
    if (!b || !moving()) return;
    const box = b.getBoundingClientRect();
    const size = Math.max(box.width, box.height) * 2.2;
    const ink = document.createElement("span");
    ink.className = "ink";
    ink.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - box.left - size / 2}px;top:${e.clientY - box.top - size / 2}px`;
    b.appendChild(ink);
    ink.animate([{ transform: "scale(0)", opacity: 0.35 }, { transform: "scale(1)", opacity: 0 }], { duration: 650, easing: EASE }).onfinish = () => ink.remove();
  },
  { passive: true }
);

// ---------- Signing in ----------
const signInScreen = (problem = "") => {
  document.body.classList.remove("is-booting");
  app.replaceChildren(
    h(
      "main.gate",
      h("div.aurora", { "aria-hidden": "true" }, h("i"), h("i"), h("i")),
      h(
        "div.gate__card.glow",
        h("img.gate__logo", { src: "assets/logo.webp", alt: "SauFox", width: 96, height: 107 }),
        h("p.gate__kicker", t("Customer portal")),
        h("h1.gate__title", "SauFox Entertainment"),
        h("p.gate__lead", t("Your tickets, orders and help, in one place.")),
        problem ? h("p.gate__problem", { role: "alert" }, problem) : null,
        h(
          "a.button.button--primary.gate__go",
          {
            href: `${MAIN}/portal-signin`,
            // Back to the page they asked for (say a ticket from an email).
            onclick: () => store.set("after", /^#\/./.test(location.hash) ? location.hash : null),
          },
          t("Sign in with your SauFox account")
        ),
        h("p.gate__alt", `${t("No account yet?")} `, h("a", { href: `${MAIN}/login#signup` }, t("Create one"))),
        langToggle()
      )
    )
  );
  const card = app.querySelector(".gate__card");
  if (moving())
    card.animate(
      [
        { opacity: 0, transform: "translateY(28px) scale(.96)", filter: "blur(8px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" },
      ],
      { duration: 1000, easing: EASE, fill: "backwards" }
    );
  reveal(card.children, { delay: 160, step: 70, y: 12 });
};
const langToggle = () =>
  h(
    "button.lang",
    {
      type: "button",
      onclick: () => {
        store.set("lang", LANG === "fa" ? "en" : "fa");
        location.reload();
      },
    },
    LANG === "fa" ? "English" : "فارسی"
  );

// The one-time sign-in from the main site, if the address carries one.
const takeSignIn = async () => {
  const match = /[#&]signin=([A-Za-z0-9_-]{20,200})/.exec(location.hash);
  if (!match) return null;
  // Out of the address (and history) at once.
  history.replaceState(null, "", location.pathname + location.search + "#/");
  app.replaceChildren(h("p.gate__wait", t("Signing you in…")));
  const { data, error } = await db.auth.verifyOtp({ token_hash: match[1], type: "magiclink" });
  if (error || !data.session) return { problem: t("That sign-in link has expired or was already used. Please sign in again.") };
  return { session: data.session };
};

// ---------- The app ----------
let session = null;
let me = null; // { id, name, email, avatar }
let poll = 0;

const shell = () => {
  const nav = [
    ...(me.admin ? [["#/desk", "desk", "Support desk"]] : []),
    ["#/", "home", "Overview"],
    ["#/tickets", "tickets", "Tickets"],
    ["#/new", "plus", "New ticket"],
    ["#/orders", "orders", "Orders"],
    ["#/help", "help", "Help"],
  ];
  const main = h("main.view", { id: "view", tabindex: "-1" });
  app.replaceChildren(
    h(
      "div.app",
      h(
        "aside.side",
        h(
          "a.side__brand",
          { href: "#/" },
          h("img", { src: "assets/wordmark.webp", alt: "SauFox", width: 1012, height: 360 }),
          h("span", t("Customer portal"))
        ),
        h(
          "nav.side__nav",
          h("span.side__pill", { "aria-hidden": "true" }),
          nav.map(([href, name, label]) =>
            h(
              "a.side__link",
              { href, dataset: { route: href } },
              icon(name),
              h("span", t(label)),
              name === "tickets" ? h("b.side__count", { hidden: true }) : name === "desk" ? h("b.side__count.side__count--desk", { hidden: true }) : null
            )
          )
        ),
        h(
          "div.side__foot",
          h("a.side__link.side__link--quiet", { href: MAIN }, icon("back"), h("span", t("Back to the site"))),
          langToggle()
        )
      ),
      h(
        "div.main",
        h(
          "header.top",
          h("span.top__progress", { "aria-hidden": "true" }),
          h("p.top__where", { id: "where" }),
          h(
            "div.top__me",
            h("img.top__avatar", { src: me.avatar || "assets/avatar-default.svg", alt: "", onerror: (e) => (e.target.src = "assets/avatar-default.svg") }),
            h("span.top__name", { translate: "no" }, me.name),
            h(
              "button.top__out",
              {
                type: "button",
                title: t("Sign out"),
                "aria-label": t("Sign out"),
                onclick: async () => {
                  await db.auth.signOut({ scope: "local" });
                  signInScreen();
                },
              },
              icon("out")
            )
          )
        ),
        main
      )
    )
  );
  if (moving()) {
    const side = app.querySelector(".side");
    // From its own edge: the start side, or the bottom on phones.
    const from = window.innerWidth <= 820 ? "translateY(24px)" : `translateX(${document.documentElement.dir === "rtl" ? 24 : -24}px)`;
    side.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], {
      duration: 800,
      easing: EASE,
      fill: "backwards",
    });
    app.querySelector(".top").animate([{ opacity: 0, transform: "translateY(-12px)" }, { opacity: 1, transform: "none" }], {
      duration: 700,
      delay: 80,
      easing: EASE,
      fill: "backwards",
    });
    reveal(app.querySelectorAll(".side__brand, .side__link, .side__foot > *"), { delay: 120, step: 45, y: 10 });
  }
  window.addEventListener("resize", movePill, { passive: true });
};

// The highlight under the current page glides from link to link.
const movePill = () => {
  const pill = document.querySelector(".side__pill");
  if (!pill) return;
  const here = document.querySelector(".side__link.is-here");
  pill.classList.toggle("is-shown", Boolean(here));
  if (!here) return;
  pill.style.width = `${here.offsetWidth}px`;
  pill.style.height = `${here.offsetHeight}px`;
  pill.style.transform = `translate(${here.offsetLeft}px, ${here.offsetTop}px)`;
  // No glide on the very first placement.
  if (!pill.classList.contains("is-ready")) requestAnimationFrame(() => requestAnimationFrame(() => pill.classList.add("is-ready")));
};

const setWhere = (label) => {
  const where = document.getElementById("where");
  if (where.textContent !== label) {
    where.textContent = label;
    if (moving())
      where.animate([{ opacity: 0, transform: "translateY(6px)", filter: "blur(3px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], {
        duration: 480,
        easing: EASE,
      });
  }
  document.querySelectorAll(".side__link[data-route]").forEach((a) => {
    const route = a.dataset.route;
    const here = location.hash || "#/";
    a.classList.toggle("is-here", route === "#/" ? here === "#/" : here.startsWith(route));
  });
  movePill();
};
const unreadCount = async () => {
  const show = (el, n) => {
    if (!el) return;
    const text = digits(n || 0);
    const changed = el.textContent !== text;
    el.textContent = text;
    el.hidden = !n;
    if (n && changed) pop(el);
  };
  const { count } = await db.from("tickets").select("id", { count: "exact", head: true }).eq("user_id", me.id).eq("member_unread", true);
  show(document.querySelector(".side__count:not(.side__count--desk)"), count);
  if (me.admin) {
    const { count: desk } = await db.from("tickets").select("id", { count: "exact", head: true }).eq("studio_unread", true);
    show(document.querySelector(".side__count--desk"), desk);
    document.title = (desk ? `(${digits(desk)}) ` : "") + t("Customer portal · SauFox Entertainment");
  }
};
const badge = (status, desk) => h(`span.badge.badge--${status}`, t((desk ? DESK_STATUS : STATUS)[status]));
const orderTitle = (o) =>
  o.plan_id ? t("{name} plan ({days} days)", { name: t(PLAN_NAMES[o.plan_id] || o.plan_id), days: o.plan_days || 30 }) : o.title;

const ticketRow = (tk) =>
  h(
    `a.row.glow.row--${tk.status}${tk.member_unread ? ".is-unread" : ""}`,
    { href: `#/tickets/${tk.id}`, dataset: { key: tk.id } },
    h("span.row__top", h("b.row__num", `#${digits(tk.number)}`), badge(tk.status), tk.member_unread ? h("span.row__new", t("New reply")) : null),
    h("strong.row__title", { dir: "auto", translate: "no" }, tk.subject),
    h("span.row__meta", `${t(TOPICS[tk.category] || tk.category)} · ${when(tk.updated_at)}`)
  );

// ---------- Views ----------
const views = {};

views.overview = async (view) => {
  setWhere(t("Overview"));
  const [{ data: tickets }, { data: orders }, { data: plan }] = await Promise.all([
    db.from("tickets").select("id, number, subject, category, status, member_unread, updated_at").eq("user_id", me.id).order("updated_at", { ascending: false }),
    db.from("orders").select("id, number, title, plan_id, plan_days, amount_irr, status, created_at").eq("user_id", me.id).order("created_at", { ascending: false }).limit(5),
    db.rpc("my_membership"),
  ]);
  const list = tickets || [];
  const open = list.filter((tk) => tk.status !== "closed").length;
  const unread = list.filter((tk) => tk.member_unread).length;
  view.replaceChildren(
    h(
      "section.hello",
      h("div", h("h1.hello__title", t("Hello, {name}", { name: me.name })), h("p.hello__lead", t("Here's where your requests and purchases stand."))),
      h("a.button.button--primary", { href: "#/new" }, icon("plus"), t("New ticket"))
    ),
    h(
      "section.stats",
      h("div.stat.glow", h("span.stat__label", t("Open tickets")), counter(open)),
      h("div.stat.glow" + (unread ? ".stat--hot" : ""), h("span.stat__label", t("New replies")), counter(unread)),
      h("div.stat.glow", h("span.stat__label", t("Orders")), counter((orders || []).length)),
      h(
        "div.stat.glow" + (plan ? `.stat--${plan.plan}` : ""),
        h("span.stat__label", t("Subscription")),
        h("b.stat__value", plan ? t(PLAN_NAMES[plan.plan] || plan.plan) : t("None")),
        plan && plan.ends_at ? h("span.stat__note", t("until {date}", { date: when(plan.ends_at, false) })) : null
      )
    ),
    h(
      "div.split",
      h(
        "section.panel",
        h("div.panel__head", h("h2", t("Recent tickets")), h("a", { href: "#/tickets" }, t("See all"))),
        list.length
          ? h("div.rows", list.slice(0, 5).map(ticketRow))
          : h("div.empty", h("p", t("No tickets yet.")), h("p.empty__hint", t("Need help? Open a ticket and we'll answer here, and by email.")))
      ),
      h(
        "section.panel",
        h("div.panel__head", h("h2", t("Recent orders")), h("a", { href: "#/orders" }, t("See all"))),
        orders && orders.length ? h("div.rows", orders.map(orderRow)) : h("div.empty", h("p", t("No orders yet.")))
      )
    )
  );
};

views.tickets = async (view) => {
  setWhere(t("Tickets"));
  let filter = store.get("filter") || "all";
  let query = "";
  const { data } = await db
    .from("tickets")
    .select("id, number, subject, category, status, member_unread, updated_at")
    .eq("user_id", me.id)
    .order("updated_at", { ascending: false });
  const all = data || [];
  const rows = h("div.rows");
  const draw = () => {
    const q = query.trim().toLowerCase();
    const shown = all.filter(
      (tk) => (filter === "all" || tk.status === filter) && (!q || tk.subject.toLowerCase().includes(q) || String(tk.number).includes(q))
    );
    flip(rows, () => rows.replaceChildren(...(shown.length ? shown.map(ticketRow) : [h("div.empty", h("p", t("Nothing here.")))])));
    chips.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b.dataset.f === filter));
  };
  const chips = h(
    "div.chips",
    [
      ["all", "All"],
      ["open", "Waiting for a reply"],
      ["answered", "Answered"],
      ["closed", "Closed"],
    ].map(([f, label]) =>
      h(
        "button.chip",
        {
          type: "button",
          dataset: { f },
          onclick: () => {
            filter = f;
            store.set("filter", f);
            draw();
          },
        },
        t(label),
        h("small", digits(f === "all" ? all.length : all.filter((tk) => tk.status === f).length))
      )
    )
  );
  const search = h("input.search", {
    type: "search",
    placeholder: t("Search tickets"),
    "aria-label": t("Search tickets"),
    oninput: (e) => {
      query = e.target.value;
      draw();
    },
  });
  view.replaceChildren(
    h("section.hello", h("h1.hello__title", t("Tickets")), h("a.button.button--primary", { href: "#/new" }, icon("plus"), t("New ticket"))),
    h("div.toolbar", chips, search),
    h("section.panel", rows)
  );
  draw();
};

// Into the ticket owner's folder (an admin replying uploads to the member's).
const uploadFile = async (file, owner = me.id) => {
  if (!TYPES.includes(file.type)) throw new Error(t("Attach an image (JPG, PNG, WebP or GIF) or a PDF."));
  if (file.size > 5 * 1024 * 1024) throw new Error(t("Files can be up to 5 MB."));
  const safe = (file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file").replace(/^_+/, "");
  const path = `${owner}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await db.storage.from("support").upload(path, file, { contentType: file.type });
  if (error) throw new Error(t("The file didn't upload. Try again."));
  return { attachment: path, attachment_name: file.name.slice(0, 200) };
};
// The studio hears about each message by email (the payment function).
const notify = (messageId) =>
  fetch(`${SUPABASE_URL}/functions/v1/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: "ticket-email", message_id: messageId }),
  }).catch(() => {});
const fileField = (label) => {
  const input = h("input", { type: "file", accept: TYPES.join(",") });
  const name = h("span.attach__name", label ? t("Up to 5 MB") : "");
  input.addEventListener("change", () => (name.textContent = input.files[0] ? input.files[0].name : label ? t("Up to 5 MB") : ""));
  return { input, el: h("label.attach", input, h("span.attach__button", t(label || "Attach")), name) };
};

views.newTicket = async (view, params) => {
  setWhere(t("New ticket"));
  const { data: orders } = await db
    .from("orders")
    .select("id, number, title, plan_id, plan_days")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const topic = h("select", { name: "category" }, Object.entries(TOPICS).map(([v, l]) => h("option", { value: v }, t(l))));
  const order = h("select", { name: "order" }, h("option", { value: "" }, "—"), (orders || []).map((o) => h("option", { value: o.id }, `#${digits(o.number)} · ${orderTitle(o)}`)));
  if (params.get("order") && (orders || []).some((o) => o.id === params.get("order"))) {
    order.value = params.get("order");
    topic.value = "order";
  }
  const subject = h("input", { type: "text", maxLength: 150, autocomplete: "off", dir: "auto" });
  const body = h("textarea", { rows: 8, maxLength: 5000, autocomplete: "off", dir: "auto" });
  const file = fileField("Attach a screenshot or PDF");
  const note = h("p.note", { role: "status" });
  const send = h("button.button.button--primary", { type: "submit" }, t("Send ticket"));
  const form = h(
    "form.panel.form",
    {
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const s = subject.value.trim();
        const b = body.value.trim();
        if (s.length < 3) return (note.textContent = t("Give your ticket a short subject."));
        if (!b) return (note.textContent = t("Write your message."));
        send.disabled = true;
        note.textContent = t("Sending…");
        try {
          const attached = file.input.files[0] ? await uploadFile(file.input.files[0]) : {};
          const { data: ticket, error } = await db
            .from("tickets")
            .insert({ category: topic.value, subject: s, order_id: order.value || null })
            .select("id")
            .single();
          if (error)
            throw new Error(
              t(
                error.code === "SF006"
                  ? "You have 5 tickets still open. Close one you don't need, or write in it instead."
                  : error.code === "SF004"
                    ? "Wait a minute before opening another ticket."
                    : "Not sent. Check your connection and try again."
              )
            );
          const { data: message } = await db.from("ticket_messages").insert({ ticket_id: ticket.id, body: b, ...attached }).select("id").single();
          if (message) notify(message.id);
          location.hash = `#/tickets/${ticket.id}`;
        } catch (err) {
          note.textContent = err.message;
          send.disabled = false;
        }
      },
    },
    h("div.form__grid", h("label.field", h("span", t("Topic")), topic), orders && orders.length ? h("label.field", h("span", t("Order"), " ", h("small", t("optional"))), order) : null),
    h("label.field", h("span", t("Subject")), subject),
    h("label.field", h("span", t("Message")), body),
    file.el,
    h("div.form__foot", note, h("a.button", { href: "#/tickets" }, t("Cancel")), send)
  );
  view.replaceChildren(h("section.hello", h("h1.hello__title", t("New ticket"))), form);
  // Once it's on screen.
  requestAnimationFrame(() => subject.focus({ preventScroll: true }));
};

// ---------- The chat (a member's ticket, and the admins' desk) ----------
// Bubbles on two sides (yours on the far side), a day line between days,
// and the box at the bottom: Enter sends, Shift+Enter starts a new line.
// New messages arrive live (Supabase Realtime), with a check every 20
// seconds as well in case the connection drops.
const dayOf = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
const dayLabel = (iso) =>
  new Date(iso).toLocaleDateString(LANG === "fa" ? "fa-IR" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tehran" });
const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString(LANG === "fa" ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
const initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const MSG_FIELDS = "id, staff, author_name, body, attachment, attachment_name, created_at";
const TICKET_FIELDS = "id, number, user_id, name, email, subject, category, status, member_unread, studio_unread, created_at, updated_at, order_id";

// Draws the messages; `staffSide` is true on the desk (the studio's own
// replies go on the far side there, the member's on the member's page).
const drawMessages = async (list, messages, staffSide, links) => {
  const want = messages.map((m) => m.attachment).filter((path) => path && !links[path]);
  if (want.length) {
    const { data } = await db.storage.from("support").createSignedUrls(want, 3600);
    (data || []).forEach((d) => d.signedUrl && (links[d.path] = d.signedUrl));
  }
  const items = [];
  let day = "";
  messages.forEach((m, i) => {
    if (dayOf(m.created_at) !== day) {
      day = dayOf(m.created_at);
      items.push(h("li.chat__day", h("span", dayLabel(m.created_at))));
    }
    const mine = staffSide ? m.staff : !m.staff;
    const next = messages[i + 1];
    const last = !next || next.staff !== m.staff || dayOf(next.created_at) !== day;
    const url = m.attachment && links[m.attachment];
    items.push(
      h(
        `li.bubble${mine ? ".bubble--mine" : ""}${m.staff ? ".bubble--staff" : ""}${last ? ".bubble--last" : ""}`,
        { dataset: { id: m.id } },
        !mine && last
          ? m.staff
            ? h("img.bubble__face", { src: "assets/logo.webp", alt: "" })
            : h("span.bubble__face.bubble__face--text", initials(m.author_name))
          : h("span.bubble__gap"),
        h(
          "div.bubble__box",
          !mine && (i === 0 || messages[i - 1].staff !== m.staff) ? h("strong.bubble__who", { translate: "no" }, m.staff ? "SauFox Entertainment" : m.author_name || t("Member")) : null,
          h("p.bubble__text", { dir: "auto", translate: "no" }, m.body),
          url
            ? h(
                "a.bubble__file",
                { href: url, target: "_blank", rel: "noopener" },
                /\.(jpe?g|png|webp|gif)$/i.test(m.attachment) ? h("img", { src: url, alt: m.attachment_name || "", loading: "lazy" }) : `📎 ${m.attachment_name || "File"}`
              )
            : null,
          h("time.bubble__time", timeOf(m.created_at))
        )
      )
    );
  });
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  const first = !list.seen;
  const seen = list.seen || new Set();
  list.replaceChildren(...items);
  // New messages pop out from their own side; the first drawing rises in.
  const fresh = [...list.querySelectorAll(".bubble")].filter((b) => !seen.has(b.dataset.id));
  fresh.forEach((b) => seen.add(b.dataset.id));
  list.seen = seen;
  if (moving()) {
    if (first) reveal([...list.children].slice(-14), { y: 14, step: 35, duration: 640 });
    else
      fresh.forEach((b, i) => {
        const box = b.querySelector(".bubble__box");
        box.style.transformOrigin = b.classList.contains("bubble--mine") ? "100% 100%" : "0% 100%";
        if (document.documentElement.dir === "rtl") box.style.transformOrigin = b.classList.contains("bubble--mine") ? "0% 100%" : "100% 100%";
        box.animate(
          [
            { opacity: 0, transform: "translateY(14px) scale(.6)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 560, delay: i * 70, easing: SPRING, fill: "backwards" }
        );
      });
  }
  if (first) list.scrollTop = list.scrollHeight;
  else if (atBottom || list.dataset.fresh === "1") list.scrollTo({ top: list.scrollHeight, behavior: moving() ? "smooth" : "auto" });
  list.dataset.fresh = "0";
};

// One ticket's conversation, drawn into `root`. `staffSide` for the desk.
// Returns a stop() that ends its live updates.
const chat = (root, ticket, { staffSide, onChange }) => {
  let current = ticket;
  let count = -1;
  const links = {};
  const list = h("ol.chat__list", { "aria-live": "polite" });
  const head = h("header.chat__head");
  const closedNote = h("p.chat__closed");
  const input = h("textarea.chat__input", {
    rows: 1,
    maxLength: 5000,
    autocomplete: "off",
    dir: "auto",
    placeholder: t(staffSide ? "Reply as SauFox Entertainment…" : "Write your reply…"),
  });
  const fileInput = h("input", { type: "file", accept: TYPES.join(","), hidden: true });
  const fileName = h("span.chat__file-name");
  const attach = h("button.chat__attach", { type: "button", title: t("Attach"), "aria-label": t("Attach"), onclick: () => fileInput.click() }, icon("clip"));
  const send = h("button.chat__send", { type: "submit", title: t("Send"), "aria-label": t("Send") }, icon("send"));
  const note = h("p.chat__note", { role: "status" });
  const toggle = h("button.button.button--quiet.chat__toggle", { type: "button" });
  fileInput.addEventListener("change", () => (fileName.textContent = fileInput.files[0] ? `📎 ${fileInput.files[0].name}` : ""));

  const grow = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  };
  input.addEventListener("input", grow);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  const drawHead = () => {
    const who = staffSide
      ? h(
          "div.chat__who",
          h("span.chat__avatar", initials(current.name)),
          h("div", h("strong", { translate: "no" }, current.name || t("Member")), h("a.chat__mail", { href: `mailto:${current.email}`, dir: "ltr", translate: "no" }, current.email))
        )
      : null;
    head.replaceChildren(
      staffSide ? h("a.chat__back", { href: "#/desk", "aria-label": t("Back") }, icon("back")) : h("a.chat__back", { href: "#/tickets", "aria-label": t("Back") }, icon("back")),
      h(
        "div.chat__title",
        who,
        h("p.chat__subject", h("b", `#${digits(current.number)}`), " ", h("span", { dir: "auto", translate: "no" }, current.subject)),
        h("p.chat__meta", badge(current.status, staffSide), h("span", t(TOPICS[current.category] || current.category)))
      ),
      toggle
    );
    toggle.textContent = current.status === "closed" ? t("Reopen") : t("Close ticket");
    toggle.hidden = !staffSide && current.status === "closed";
    closedNote.textContent = t(staffSide ? "Closed. A reply opens it again." : "This ticket is closed. Write below if you need us again, and it opens again.");
    closedNote.hidden = current.status !== "closed";
  };
  const orderLine = h("p.chat__order");
  if (staffSide && current.order_id)
    db.from("orders")
      .select("number, title, plan_id, plan_days, status, amount_irr")
      .eq("id", current.order_id)
      .maybeSingle()
      .then(({ data: o }) => {
        if (o) orderLine.textContent = `${t("Order")} #${digits(o.number)} · ${orderTitle(o)} · ${t(ORDER_STATUS[o.status] || o.status)} · ${rials(o.amount_irr)}`;
      });

  const load = async (force) => {
    const { data } = await db.from("ticket_messages").select(MSG_FIELDS).eq("ticket_id", current.id).order("created_at");
    if (!data || (!force && data.length === count)) return;
    count = data.length;
    await drawMessages(list, data, staffSide, links);
  };
  const refreshTicket = async () => {
    const { data } = await db.from("tickets").select(TICKET_FIELDS).eq("id", current.id).maybeSingle();
    if (!data) return;
    current = data;
    drawHead();
    markRead();
    if (onChange) onChange(current);
  };
  const markRead = () => {
    const field = staffSide ? "studio_unread" : "member_unread";
    if (!current[field]) return;
    current[field] = false;
    db.from("tickets")
      .update({ [field]: false })
      .eq("id", current.id)
      .then(() => {
        unreadCount();
        if (onChange) onChange(current);
      });
  };

  toggle.addEventListener("click", async () => {
    const next = current.status === "closed" ? "open" : "closed";
    if (next === "closed" && !toggle.dataset.armed) {
      toggle.dataset.armed = "1";
      toggle.textContent = t("Close it?");
      setTimeout(() => {
        delete toggle.dataset.armed;
        drawHead();
      }, 4000);
      return;
    }
    delete toggle.dataset.armed;
    toggle.disabled = true;
    const { error } = await db.from("tickets").update({ status: next }).eq("id", current.id);
    toggle.disabled = false;
    if (error) return (note.textContent = t("Not changed. Try again."));
    current = { ...current, status: next };
    drawHead();
    if (onChange) onChange(current);
  });

  const form = h(
    "form.chat__form",
    {
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const body = input.value.trim();
        if (!body) {
          if (moving()) input.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "none" }], { duration: 380, easing: "ease-out" });
          return input.focus();
        }
        send.disabled = true;
        note.textContent = "";
        if (moving()) {
          // The paper plane flies off and a new one slides back in.
          const s = document.documentElement.dir === "rtl" ? -1 : 1;
          send.querySelector("svg").animate(
            [
              { transform: `scaleX(${s})` },
              { transform: `translate(${20 * s}px, -20px) scale(${0.5 * s}, .5)`, opacity: 0, offset: 0.42 },
              { transform: `translate(${-16 * s}px, 16px) scale(${0.5 * s}, .5)`, opacity: 0, offset: 0.43 },
              { transform: `scaleX(${s})`, opacity: 1 },
            ],
            { duration: 760, easing: EASE }
          );
        }
        try {
          const attached = fileInput.files[0] ? await uploadFile(fileInput.files[0], current.user_id || me.id) : {};
          const { data: message, error } = await db.from("ticket_messages").insert({ ticket_id: current.id, body, ...attached }).select("id").single();
          if (error)
            throw new Error(
              t(
                error.code === "SF004"
                  ? "Wait a few seconds before sending again."
                  : error.code === "SF007"
                    ? "This ticket is full. Please open a new one."
                    : "Not sent. Check your connection and try again."
              )
            );
          notify(message.id);
          input.value = "";
          grow();
          fileInput.value = "";
          fileName.textContent = "";
          list.dataset.fresh = "1";
          await load(true);
          await refreshTicket();
        } catch (err) {
          note.textContent = err.message;
          if (moving()) note.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 400, easing: EASE });
        } finally {
          send.disabled = false;
          input.focus();
        }
      },
    },
    closedNote,
    note,
    h("div.chat__bar", attach, fileInput, input, send),
    fileName
  );

  const section = h("section.chat" + (staffSide ? ".chat--desk" : ""), head, staffSide ? orderLine : null, list, form);
  root.replaceChildren(section);
  if (moving()) {
    const side = document.documentElement.dir === "rtl" ? -1 : 1;
    section.animate(
      [
        { opacity: 0, transform: staffSide ? `translateX(${28 * side}px)` : "translateY(22px) scale(.985)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 700, easing: EASE, fill: "backwards" }
    );
    reveal([head, form], { delay: 120, step: 90, y: 8 });
  }
  drawHead();
  load(true).then(markRead);
  grow();

  // Live: new messages and status changes for this ticket.
  const channel = db
    .channel(`ticket-${current.id}-${Math.random().toString(36).slice(2, 7)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${current.id}` }, () => load().then(refreshTicket))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${current.id}` }, () => refreshTicket())
    .subscribe();
  const timer = setInterval(() => !document.hidden && load().then(() => count && refreshTicket()), 20000);
  return () => {
    clearInterval(timer);
    db.removeChannel(channel);
  };
};

let stopChat = null;
views.ticket = async (view, params, id) => {
  setWhere(t("Tickets"));
  const { data: ticket } = await db.from("tickets").select(TICKET_FIELDS).eq("id", id).maybeSingle();
  if (!ticket) {
    view.replaceChildren(h("div.panel.empty", h("p", t("This ticket isn't here. It may belong to another account."))));
    return;
  }
  view.classList.add("view--chat");
  stopChat = chat(view, ticket, { staffSide: false });
};

// ---------- The admins' support desk (#/desk, #/desk/<id>) ----------
views.desk = async (view, params, id) => {
  if (!me.admin) return (location.hash = "#/");
  setWhere(t("Support desk"));
  view.classList.add("view--desk");
  let filter = store.get("deskFilter") || "open";
  let query = "";
  let tickets = [];
  const lastOf = {};
  const listBox = h("div.desk__rows");
  // Moving between conversations keeps the list still (and where it was
  // scrolled); only the chat slides in.
  const before = document.querySelector("#view .desk__rows");
  let quiet = Boolean(before);
  if (before) {
    const top = before.scrollTop;
    requestAnimationFrame(() => (listBox.scrollTop = top));
  }
  const pane = h("div.desk__pane");
  const chips = h("div.chips.chips--small");
  const search = h("input.search", {
    type: "search",
    placeholder: t("Search name, email, subject or #"),
    "aria-label": t("Search tickets"),
    oninput: (e) => {
      query = e.target.value.trim().toLowerCase();
      drawList();
    },
  });
  const drawChips = () =>
    chips.replaceChildren(
      ...[
        ["open", "Waiting for us"],
        ["answered", "Answered"],
        ["closed", "Closed"],
        ["all", "All"],
      ].map(([f, label]) =>
        h(
          "button.chip" + (f === filter ? ".is-on" : ""),
          {
            type: "button",
            onclick: () => {
              filter = f;
              store.set("deskFilter", f);
              loadList();
            },
          },
          t(label)
        )
      )
    );
  const drawList = () => {
    const shown = tickets.filter(
      (tk) =>
        !query ||
        [tk.name, tk.email, tk.subject, `#${tk.number}`, String(tk.number)].some((v) => String(v || "").toLowerCase().includes(query))
    );
    const paint = quiet ? (fn) => fn() : (fn) => flip(listBox, fn);
    quiet = false;
    paint(() => listBox.replaceChildren(
      ...(shown.length
        ? shown.map((tk) => {
            const last = lastOf[tk.id];
            return h(
              `a.conv${tk.studio_unread ? ".is-unread" : ""}${tk.id === id ? ".is-here" : ""}`,
              { href: `#/desk/${tk.id}`, dataset: { key: tk.id } },
              h("span.conv__avatar", initials(tk.name)),
              h(
                "span.conv__main",
                h("span.conv__top", h("strong", { translate: "no" }, tk.name || t("Member")), h("time", when(tk.updated_at))),
                h("span.conv__subject", { dir: "auto", translate: "no" }, `#${digits(tk.number)} · ${tk.subject}`),
                h(
                  "span.conv__last",
                  { dir: "auto", translate: "no" },
                  last ? `${last.staff ? `${t("You")}: ` : ""}${last.body.replace(/\s+/g, " ").slice(0, 90)}` : ""
                )
              ),
              tk.studio_unread ? h("span.conv__dot", { "aria-label": t("New") }) : null
            );
          })
        : [h("div.empty", h("p", t("Nothing here.")))])
    ));
  };
  const loadList = async () => {
    drawChips();
    let q = db.from("tickets").select(TICKET_FIELDS).order("studio_unread", { ascending: false }).order("updated_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    tickets = data || [];
    const ids = tickets.map((tk) => tk.id);
    if (ids.length) {
      const { data: msgs } = await db
        .from("ticket_messages")
        .select("ticket_id, staff, body, created_at")
        .in("ticket_id", ids.slice(0, 100))
        .order("created_at", { ascending: false })
        .limit(400);
      (msgs || []).forEach((m) => (lastOf[m.ticket_id] ||= m));
    }
    drawList();
  };

  view.replaceChildren(
    h(
      "div.desk" + (id ? ".desk--open" : ""),
      h("aside.desk__list", h("div.desk__tools", h("h1.desk__title", t("Support desk")), chips, search), listBox),
      pane
    )
  );
  if (!before) reveal(view.querySelectorAll(".desk__tools > *"), { step: 60, y: 10 });
  await loadList();
  if (id) {
    const { data: ticket } = await db.from("tickets").select(TICKET_FIELDS).eq("id", id).maybeSingle();
    if (!ticket) pane.replaceChildren(h("div.empty", h("p", t("This ticket isn't here."))));
    else
      stopChat = chat(pane, ticket, {
        staffSide: true,
        onChange: (next) => {
          const i = tickets.findIndex((tk) => tk.id === next.id);
          if (i >= 0) tickets[i] = { ...tickets[i], ...next };
          drawList();
        },
      });
  } else {
    pane.replaceChildren(h("div.desk__empty", h("img", { src: "assets/logo.webp", alt: "" }), h("p", t("Pick a conversation."))));
    reveal(pane.firstChild.children, { delay: 200, step: 90 });
  }

  // The list stays live too: a new ticket or message moves it up.
  const channel = db
    .channel(`desk-${Math.random().toString(36).slice(2, 7)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => loadList())
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, (e) => {
      if (e.new) lastOf[e.new.ticket_id] = e.new;
      loadList();
    })
    .subscribe();
  const prevStop = stopChat;
  stopChat = () => {
    if (prevStop) prevStop();
    db.removeChannel(channel);
  };
};

const orderRow = (o) =>
  h(
    "div.row.row--order",
    h("span.row__top", h("b.row__num", `#${digits(o.number)}`), h(`span.badge.badge--order-${o.status}`, t(ORDER_STATUS[o.status] || o.status))),
    h("strong.row__title", { translate: o.plan_id ? null : "no", dir: "auto" }, orderTitle(o)),
    h(
      "span.row__meta",
      `${rials(o.amount_irr)} · ${when(o.created_at, false)}`,
      h("a.row__help", { href: `#/new?order=${o.id}` }, t("Get help"))
    )
  );

views.orders = async (view) => {
  setWhere(t("Orders"));
  const { data } = await db
    .from("orders")
    .select("id, number, title, plan_id, plan_days, amount_irr, status, created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false });
  view.replaceChildren(
    h("section.hello", h("h1.hello__title", t("Your orders")), h("a.button", { href: `${MAIN}/profile#orders` }, t("Pay or manage it on the site"))),
    h("section.panel", data && data.length ? h("div.rows", data.map(orderRow)) : h("div.empty", h("p", t("No orders yet."))))
  );
};

views.help = async (view) => {
  setWhere(t("Help"));
  const card = (href, title, text) => h("a.help.glow", { href, target: "_blank", rel: "noopener" }, h("strong", t(title)), h("span", t(text)));
  view.replaceChildren(
    h("section.hello", h("div", h("h1.hello__title", t("Help and answers")), h("p.hello__lead", t("Quick answers first; if yours isn't there, open a ticket."))), h("a.button.button--primary", { href: "#/new" }, icon("plus"), t("Open a ticket"))),
    h(
      "section.helps",
      card(`${MAIN}/faq`, "Account and sign-in help", "Codes, passwords, Google sign-in."),
      card(`${MAIN}/faq`, "Buying and payment", "Paying, receipts, pre-orders."),
      card(`${MAIN}/terms`, "Refunds and terms", "What can be refunded, and how."),
      card(`${MAIN}/#plans`, "Subscriptions", "Iron, Gold and Titanium plans.")
    ),
    h(
      "section.panel.contact",
      h("h2", t("Other ways to reach us")),
      h("p", h("span", t("Email")), h("a", { href: "mailto:saufoxentertainment@gmail.com", dir: "ltr" }, "saufoxentertainment@gmail.com")),
      h("p", h("span", t("Phone")), h("a", { href: "tel:+985133409142", dir: "ltr" }, "+98 51 3340 9142"))
    )
  );
};

// ---------- Routing: #/, #/tickets, #/tickets/<id>, #/new?order=, #/orders, #/help ----------
const route = async () => {
  clearInterval(poll);
  if (stopChat) stopChat();
  stopChat = null;
  const [path, query = ""] = (location.hash.replace(/^#/, "") || "/").split("?");
  const params = new URLSearchParams(query);
  const old = document.getElementById("view");
  if (!old) return;
  const turn = (route.turn = (route.turn || 0) + 1);
  const parts = path.split("/").filter(Boolean);
  // The next page is built off screen while this one dims (a spinner if
  // there's nothing to dim), then swapped in and rises into place.
  const bar = document.querySelector(".top__progress");
  bar.classList.remove("is-done");
  void bar.offsetWidth;
  bar.classList.add("is-going");
  if (!old.children.length) old.replaceChildren(h("div.loading", h("span")));
  else if (!(parts[0] === "desk" && old.classList.contains("view--desk"))) old.classList.add("is-leaving");
  const view = h("main.view", { tabindex: "-1" });
  try {
    if (!parts.length) await views.overview(view);
    else if (parts[0] === "desk") await views.desk(view, params, parts[1]);
    else if (parts[0] === "tickets" && parts[1]) await views.ticket(view, params, parts[1]);
    else if (parts[0] === "tickets") await views.tickets(view);
    else if (parts[0] === "new") await views.newTicket(view, params);
    else if (parts[0] === "orders") await views.orders(view);
    else if (parts[0] === "help") await views.help(view);
    else return (location.hash = "#/");
  } catch (e) {
    view.replaceChildren(h("div.panel.empty", h("p", t("Couldn't reach the server. Check your connection and reload the page."))));
  }
  // A newer page was asked for meanwhile: that one wins.
  if (turn !== route.turn) return;
  bar.classList.replace("is-going", "is-done");
  view.id = "view";
  old.replaceWith(view);
  window.scrollTo({ top: 0, behavior: "auto" });
  if (!view.classList.contains("view--chat") && !view.classList.contains("view--desk")) {
    reveal(view.children, { step: 70 });
    reveal(view.querySelectorAll(".stat, .help"), { delay: 140, step: 60, y: 18 });
    reveal(view.querySelectorAll(".split .row, .form > *"), { delay: 220, step: 45, y: 10 });
  }
  view.focus({ preventScroll: true });
};

// ---------- Start ----------
(async function start() {
  document.body.classList.add("is-booting");
  if (!db) return signInScreen(t("Couldn't reach the server. Check your connection and reload the page."));
  const handed = await takeSignIn();
  if (handed && handed.problem) return signInScreen(handed.problem);
  session = handed ? handed.session : (await db.auth.getSession()).data.session;
  if (!session) return signInScreen();
  db.auth.onAuthStateChange((event, next) => {
    if (next) session = next;
    if (event === "SIGNED_OUT") signInScreen();
  });
  const user = session.user;
  const { data: profile } = await db.from("profiles").select("name, avatar_url").eq("id", user.id).maybeSingle();
  me = {
    id: user.id,
    email: user.email,
    name: (profile && profile.name) || (user.email || "").split("@")[0],
    avatar: profile && profile.avatar_url,
    // Admins also get the support desk (the database decides what they see).
    admin: Boolean((await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle()).data),
  };
  document.body.classList.remove("is-booting");
  shell();
  if (handed) {
    const after = store.get("after");
    store.set("after", null);
    if (after && /^#\/[\w/?=&.-]*$/.test(after)) history.replaceState(null, "", location.pathname + location.search + after);
  }
  window.addEventListener("hashchange", route);
  // An admin lands on the desk.
  if (me.admin && (!location.hash || location.hash === "#/") && !handed) history.replaceState(null, "", "#/desk");
  route();
  unreadCount();
  // Unread counts stay current.
  db.channel("counts")
    .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => unreadCount())
    .subscribe();
})();
