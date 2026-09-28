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
const STATUS = { open: "Waiting for us", answered: "Answered", closed: "Closed" };
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

// ---------- Signing in ----------
const signInScreen = (problem = "") => {
  document.body.classList.remove("is-booting");
  app.replaceChildren(
    h(
      "main.gate",
      h(
        "div.gate__card",
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
          nav.map(([href, name, label]) =>
            h("a.side__link", { href, dataset: { route: href } }, icon(name), h("span", t(label)), name === "tickets" ? h("b.side__count", { hidden: true }) : null)
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
};

const setWhere = (label) => {
  document.getElementById("where").textContent = label;
  document.querySelectorAll(".side__link[data-route]").forEach((a) => {
    const route = a.dataset.route;
    const here = location.hash || "#/";
    a.classList.toggle("is-here", route === "#/" ? here === "#/" : here.startsWith(route));
  });
};
const unreadCount = async () => {
  const { count } = await db.from("tickets").select("id", { count: "exact", head: true }).eq("user_id", me.id).eq("member_unread", true);
  const badge = document.querySelector(".side__count");
  if (!badge) return;
  badge.textContent = digits(count || 0);
  badge.hidden = !count;
};
const badge = (status) => h(`span.badge.badge--${status}`, t(STATUS[status]));
const orderTitle = (o) =>
  o.plan_id ? t("{name} plan ({days} days)", { name: t(PLAN_NAMES[o.plan_id] || o.plan_id), days: o.plan_days || 30 }) : o.title;

const ticketRow = (tk) =>
  h(
    `a.row.row--${tk.status}${tk.member_unread ? ".is-unread" : ""}`,
    { href: `#/tickets/${tk.id}` },
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
      h("div.stat", h("span.stat__label", t("Open tickets")), h("b.stat__value", digits(open))),
      h("div.stat" + (unread ? ".stat--hot" : ""), h("span.stat__label", t("New replies")), h("b.stat__value", digits(unread))),
      h("div.stat", h("span.stat__label", t("Orders")), h("b.stat__value", digits((orders || []).length))),
      h(
        "div.stat" + (plan ? `.stat--${plan.plan}` : ""),
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
    rows.replaceChildren(...(shown.length ? shown.map(ticketRow) : [h("div.empty", h("p", t("Nothing here.")))]));
    chips.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b.dataset.f === filter));
  };
  const chips = h(
    "div.chips",
    [
      ["all", "All"],
      ["open", "Waiting for us"],
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

const uploadFile = async (file) => {
  if (!TYPES.includes(file.type)) throw new Error(t("Attach an image (JPG, PNG, WebP or GIF) or a PDF."));
  if (file.size > 5 * 1024 * 1024) throw new Error(t("Files can be up to 5 MB."));
  const safe = (file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file").replace(/^_+/, "");
  const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
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
  subject.focus();
};

const thread = async (list, messages) => {
  const paths = messages.map((m) => m.attachment).filter(Boolean);
  const links = {};
  if (paths.length) {
    const { data } = await db.storage.from("support").createSignedUrls(paths, 3600);
    (data || []).forEach((d) => d.signedUrl && (links[d.path] = d.signedUrl));
  }
  list.replaceChildren(
    ...messages.map((m) => {
      const url = m.attachment && links[m.attachment];
      return h(
        `li.msg${m.staff ? ".msg--staff" : ""}`,
        h(
          "div.msg__head",
          m.staff ? h("img.msg__mark", { src: "assets/logo.webp", alt: "" }) : null,
          h("strong", { translate: "no" }, m.staff ? "SauFox Entertainment" : m.author_name || t("Member")),
          m.staff ? h("span.msg__tag", t("Support")) : null,
          h("time", when(m.created_at))
        ),
        h("p.msg__body", { dir: "auto", translate: "no" }, m.body),
        url
          ? h(
              "a.msg__file",
              { href: url, target: "_blank", rel: "noopener" },
              /\.(jpe?g|png|webp|gif)$/i.test(m.attachment) ? h("img", { src: url, alt: m.attachment_name || "", loading: "lazy" }) : `📎 ${m.attachment_name || "File"}`
            )
          : null
      );
    })
  );
};

views.ticket = async (view, params, id) => {
  setWhere(t("Tickets"));
  const FIELDS = "id, number, subject, category, status, member_unread, created_at, order_id";
  const { data: ticket } = await db.from("tickets").select(FIELDS).eq("id", id).maybeSingle();
  if (!ticket) {
    view.replaceChildren(h("div.panel.empty", h("p", t("This ticket isn't here. It may belong to another account."))));
    return;
  }
  let current = ticket;
  const head = h("section.ticket-head");
  const list = h("ol.thread");
  const closedNote = h("p.note", t("This ticket is closed. Write below if you need us again, and it opens again."));
  const body = h("textarea", { rows: 4, maxLength: 5000, autocomplete: "off", dir: "auto", placeholder: t("Write your reply…") });
  const file = fileField();
  const note = h("p.note", { role: "status" });
  const send = h("button.button.button--primary", { type: "submit" }, t("Send"));
  const close = h("button.button.button--quiet", { type: "button" }, t("Close ticket"));
  const drawHead = () => {
    head.replaceChildren(
      h("a.back", { href: "#/tickets" }, icon("back"), t("Tickets")),
      h("p.kicker", `${t("Ticket")} #${digits(current.number)}`),
      h("h1.ticket-head__title", { dir: "auto", translate: "no" }, current.subject),
      h("p.ticket-head__meta", badge(current.status), h("span", t(TOPICS[current.category] || current.category)), h("span", t("Opened {date}", { date: when(current.created_at) })))
    );
    closedNote.hidden = current.status !== "closed";
    close.hidden = current.status === "closed";
  };
  const load = async () => {
    const { data } = await db
      .from("ticket_messages")
      .select("id, staff, author_name, body, attachment, attachment_name, created_at")
      .eq("ticket_id", current.id)
      .order("created_at");
    if (data && data.length !== list.children.length) await thread(list, data);
  };
  const markRead = () => {
    if (!current.member_unread) return;
    current.member_unread = false;
    db.from("tickets").update({ member_unread: false }).eq("id", current.id).then(unreadCount);
  };
  close.addEventListener("click", async () => {
    if (!close.dataset.armed) {
      close.dataset.armed = "1";
      close.textContent = t("Close it?");
      setTimeout(() => {
        delete close.dataset.armed;
        close.textContent = t("Close ticket");
      }, 4000);
      return;
    }
    close.disabled = true;
    const { error } = await db.from("tickets").update({ status: "closed" }).eq("id", current.id);
    close.disabled = false;
    delete close.dataset.armed;
    close.textContent = t("Close ticket");
    if (error) return (note.textContent = t("Not changed. Try again."));
    current = { ...current, status: "closed" };
    drawHead();
  });
  const form = h(
    "form.panel.form.reply",
    {
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const b = body.value.trim();
        if (!b) return (note.textContent = t("Write your message."));
        send.disabled = true;
        note.textContent = t("Sending…");
        try {
          const attached = file.input.files[0] ? await uploadFile(file.input.files[0]) : {};
          const { data: message, error } = await db.from("ticket_messages").insert({ ticket_id: current.id, body: b, ...attached }).select("id").single();
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
          form.reset();
          file.input.dispatchEvent(new Event("change"));
          note.textContent = "";
          current = { ...current, status: "open" };
          drawHead();
          await load();
        } catch (err) {
          note.textContent = err.message;
        } finally {
          send.disabled = false;
        }
      },
    },
    closedNote,
    body,
    h("div.form__foot", file.el, note, close, send)
  );
  view.replaceChildren(head, list, form);
  drawHead();
  await load();
  markRead();
  // New replies show up while it's open.
  poll = setInterval(async () => {
    if (document.hidden) return;
    const { data } = await db.from("tickets").select(FIELDS).eq("id", current.id).maybeSingle();
    if (!data) return;
    current = data;
    drawHead();
    await load();
    markRead();
  }, 30000);
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
  const card = (href, title, text) => h("a.help", { href, target: "_blank", rel: "noopener" }, h("strong", t(title)), h("span", t(text)));
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
  const [path, query = ""] = (location.hash.replace(/^#/, "") || "/").split("?");
  const params = new URLSearchParams(query);
  const view = document.getElementById("view");
  if (!view) return;
  view.replaceChildren(h("div.loading", h("span")));
  window.scrollTo(0, 0);
  const parts = path.split("/").filter(Boolean);
  try {
    if (!parts.length) await views.overview(view);
    else if (parts[0] === "tickets" && parts[1]) await views.ticket(view, params, parts[1]);
    else if (parts[0] === "tickets") await views.tickets(view);
    else if (parts[0] === "new") await views.newTicket(view, params);
    else if (parts[0] === "orders") await views.orders(view);
    else if (parts[0] === "help") await views.help(view);
    else location.hash = "#/";
  } catch (e) {
    view.replaceChildren(h("div.panel.empty", h("p", t("Couldn't reach the server. Check your connection and reload the page."))));
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
  };
  document.body.classList.remove("is-booting");
  shell();
  if (handed) {
    const after = store.get("after");
    store.set("after", null);
    if (after && /^#\/[\w/?=&.-]*$/.test(after)) history.replaceState(null, "", location.pathname + location.search + after);
  }
  window.addEventListener("hashchange", route);
  route();
  unreadCount();
})();
