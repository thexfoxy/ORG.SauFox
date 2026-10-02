// Order emails, in the same look as the sign-in emails in emails/. Persian
// first, then English.
//
// Sent through Resend when the secret RESEND_API_KEY is set, otherwise
// through the studio's Gmail over SMTP (port 465) with SMTP_PASSWORD (the
// Gmail app password); with both, Gmail is the fallback; with neither,
// emails are skipped. SMTP_USER defaults to the studio address, which
// also gets a copy of every order and receives replies.
import nodemailer from "npm:nodemailer@6.9.16";

const SITE = "https://saufoxentertainment.ir";
export const STUDIO = Deno.env.get("SMTP_USER") || "saufoxentertainment@gmail.com";
export const mailReady = () => Boolean(Deno.env.get("RESEND_API_KEY") || Deno.env.get("SMTP_PASSWORD"));

export type Order = {
  id: string;
  number: number;
  title: string;
  amount_irr: number;
  name: string;
  email: string;
  phone: string;
  ref_id?: string | null;
  card_pan?: string | null;
  paid_at?: string | null;
  created_at: string;
  test: boolean;
  plan_id?: string | null;
};

// Subscription orders: what they're called, and the row label.
const PLAN_FA: Record<string, string> = { iron: "آهن", gold: "طلا", titanium: "تیتانیوم" };
const PLAN_EN: Record<string, string> = { iron: "Iron", gold: "Gold", titanium: "Titanium" };
const itemFa = (order: Order): [string, string] =>
  order.plan_id
    ? ["اشتراک", `اشتراک ${PLAN_FA[order.plan_id] || esc(order.plan_id)}`]
    : ["اثر", `<span dir="ltr">${esc(order.title)}</span>`];
const itemEn = (order: Order): [string, string] =>
  order.plan_id ? ["Plan", `${PLAN_EN[order.plan_id] || esc(order.plan_id)} plan`] : ["Work", esc(order.title)];
const whenDayFa = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "long" });
const whenDayEn = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Tehran", dateStyle: "long" });

const esc = (text: unknown) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const faNum = (n: number | string) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const rialsFa = (n: number) => `${n.toLocaleString("fa-IR")} ریال`;
const rialsEn = (n: number) => `${n.toLocaleString("en-US")} Rials`;
const whenFa = (iso: string) =>
  new Date(iso).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "long", timeStyle: "short" });
const whenEn = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Tehran", dateStyle: "long", timeStyle: "short" }) + " (Tehran)";

const FA_FONT = "Vazirmatn,Tahoma,Arial,sans-serif";
const EN_FONT = "Arial,Helvetica,sans-serif";

// Rows of label / value, one table per language.
const rows = (items: [string, string][], rtl: boolean) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${rtl ? "rtl" : "ltr"}" style="margin:16px 0 0;border-collapse:collapse;">` +
  items
    .map(
      ([label, value]) =>
        `<tr><td style="padding:9px 0;border-top:1px solid #26262b;color:#8e8c95;font:14px/1.6 ${rtl ? FA_FONT : EN_FONT};text-align:${rtl ? "right" : "left"};">${label}</td>` +
        `<td style="padding:9px 0;border-top:1px solid #26262b;color:#f5f3ef;font:600 14px/1.6 ${rtl ? FA_FONT : EN_FONT};text-align:${rtl ? "left" : "right"};">${value}</td></tr>`
    )
    .join("") +
  `</table>`;

const button = (href: string, fa: string, en: string) =>
  `<a href="${href}" style="display:inline-block;padding:13px 26px;border-radius:10px;background:#ff7a1a;color:#1a0d04;text-decoration:none;font:700 15px/1 ${FA_FONT};">${fa} &middot; ${en}</a>`;

const page = (fa: string, en: string, action = "", footFa = "", footEn = "") => `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face{font-family:"Vazirmatn";src:url("${SITE}/assets/fonts/vazirmatn-nl.woff2") format("woff2");font-weight:100 900;}
</style></head><body style="margin:0;background:#0f0f11;">
<div style="margin:0;padding:32px 16px;background:#0f0f11;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#18181b;border-radius:16px;">
    <tr><td style="padding:32px 32px 8px;text-align:center;">
      <span style="font:italic 30px/1 Georgia,'Times New Roman',serif;color:#f5f3ef;">SauFox <span style="color:#8e8c95;">Entertainment</span></span>
    </td></tr>
    <tr><td dir="rtl" style="padding:24px 32px 8px;text-align:right;font:16px/2 ${FA_FONT};color:#d9d6d0;">${fa}</td></tr>
    ${action ? `<tr><td style="padding:16px 32px 8px;text-align:center;">${action}</td></tr>` : ""}
    <tr><td style="padding:8px 32px 8px;text-align:left;font:15px/1.7 ${EN_FONT};color:#d9d6d0;">
      <div style="border-top:1px solid #26262b;padding-top:12px;">${en}</div>
    </td></tr>
    <tr><td style="padding:16px 32px 28px;font:12px/1.8 ${EN_FONT};color:#8e8c95;">
      ${footFa ? `<p dir="rtl" style="margin:0;text-align:right;font-family:${FA_FONT};">${footFa}</p>` : ""}
      ${footEn ? `<p style="margin:6px 0 0;">${footEn}</p>` : ""}
      <p style="margin:14px 0 0;"><a href="${SITE}" style="color:#ff7a1a;text-decoration:none;">saufoxentertainment.ir</a>
      &middot; <a href="mailto:${STUDIO}" style="color:#8e8c95;text-decoration:none;">${STUDIO}</a></p>
    </td></tr>
  </table>
</div></body></html>`;

const hello = (name: string, rtl: boolean) =>
  `<p style="margin:0 0 8px;color:#f5f3ef;font-size:18px;font-weight:700;">${rtl ? `سلام ${esc(name)}،` : `Hi ${esc(name)},`}</p>`;
const testTag = (order: Order, rtl: boolean) => (order.test ? (rtl ? " (آزمایشی)" : " (test)") : "");

// ---------- To the buyer: order received ----------
export const placedEmail = (order: Order, payable: boolean) => {
  const fa =
    hello(order.name, true) +
    `<p style="margin:0;">سفارش شما ثبت شد و در انتظار پرداخت است.</p>` +
    rows(
      [
        itemFa(order),
        ["شماره‌ی سفارش", faNum(order.number)],
        ["مبلغ", rialsFa(order.amount_irr)],
        ["وضعیت", "در انتظار پرداخت"],
      ],
      true
    ) +
    `<p style="margin:16px 0 0;">${
      payable
        ? "اگر پرداخت را کامل نکرده‌اید، از بخش «سفارش‌ها» در پروفایل می‌توانید پرداخت کنید."
        : "پرداخت آنلاین به‌زودی فعال می‌شود. وقتی فعال شد خبرتان می‌کنیم؛ تا آن زمان مبلغی دریافت نمی‌شود."
    }</p>`;
  const en =
    hello(order.name, false) +
    `<p style="margin:0;">Your order is in and waiting for payment.</p>` +
    rows(
      [
        itemEn(order),
        ["Order number", String(order.number)],
        ["Amount", rialsEn(order.amount_irr)],
        ["Status", "Awaiting payment"],
      ],
      false
    ) +
    `<p style="margin:16px 0 0;">${
      payable
        ? "If you didn&rsquo;t finish paying, you can pay from Orders in your profile."
        : "Online payment opens soon. We&rsquo;ll let you know when it does; nothing is charged until then."
    }</p>`;
  return {
    to: order.email,
    subject: `سفارش ${faNum(order.number)} ساوفاکس ثبت شد${testTag(order, true)} | SauFox order ${order.number} received${testTag(order, false)}`,
    html: page(
      fa,
      en,
      button(`${SITE}/profile.html#orders`, "سفارش‌های من", "My orders"),
      "لغو سفارش پرداخت‌نشده از پروفایل شما ممکن است.",
      "You can cancel an unpaid order from your profile."
    ),
  };
};

// ---------- To the buyer: payment receipt ----------
export const paidEmail = (order: Order, released: boolean, planEnds?: string | null, game?: boolean) => {
  const when = order.paid_at || new Date().toISOString();
  const plan = Boolean(order.plan_id);
  const keyRow = "";
  const fa =
    hello(order.name, true) +
    `<p style="margin:0;">پرداخت شما انجام شد. این رسید را نگه دارید.</p>` +
    rows(
      [
        itemFa(order),
        ["شماره‌ی سفارش", faNum(order.number)],
        ["مبلغ پرداخت‌شده", rialsFa(order.amount_irr)],
        ["شماره‌ی پیگیری", `<span dir="ltr">${esc(order.ref_id || "—")}</span>`],
        ...(order.card_pan ? ([["کارت", `<span dir="ltr">${esc(order.card_pan)}</span>`]] as [string, string][]) : []),
        ["تاریخ", whenFa(when)],
      ],
      true
    ) +
    keyRow +
    `<p style="margin:16px 0 0;">${
      plan
        ? `اشتراک شما فعال شد${planEnds ? ` و تا ${whenDayFa(planEnds)} اعتبار دارد` : ""}. تخفیف اشتراک در خریدهای بعدی خودبه‌خود حساب می‌شود.`
        : game
          ? "کلید بازی شما به‌زودی از طریق همین ایمیل برایتان فرستاده می‌شود. لطفاً کمی صبر کنید."
          : released
            ? "این اثر حالا در «کتابخانه»ی پروفایل شماست."
            : "این اثر در روز انتشار به «کتابخانه»ی پروفایل شما اضافه می‌شود."
    }</p>`;
  const en =
    hello(order.name, false) +
    `<p style="margin:0;">Your payment went through. Keep this receipt.</p>` +
    rows(
      [
        itemEn(order),
        ["Order number", String(order.number)],
        ["Amount paid", rialsEn(order.amount_irr)],
        ["Reference", esc(order.ref_id || "—")],
        ...(order.card_pan ? ([["Card", esc(order.card_pan)]] as [string, string][]) : []),
        ["Date", whenEn(when)],
      ],
      false
    ) +
    keyRow +
    `<p style="margin:16px 0 0;">${
      plan
        ? `Your plan is active${planEnds ? ` until ${whenDayEn(planEnds)}` : ""}. Its discount comes off your next purchases by itself.`
        : game
          ? "Your game key will be sent to this email shortly. Please hold on a little."
          : released
            ? "It&rsquo;s in the Library in your profile now."
            : "It will appear in the Library in your profile on release day."
    }</p>`;
  return {
    to: order.email,
    subject: `رسید پرداخت سفارش ${faNum(order.number)} ساوفاکس${testTag(order, true)} | SauFox payment receipt, order ${order.number}${testTag(order, false)}`,
    html: page(
      fa,
      en,
      plan
        ? button(`${SITE}/profile.html`, "پروفایل من", "My profile")
        : button(`${SITE}/profile.html#library`, "کتابخانه‌ی من", "My library"),
      `برای بازگشت وجه، طبق <a href="${SITE}/terms.html#${plan ? "subscriptions" : "purchases"}" style="color:#ff7a1a;">قوانین خرید</a>، شماره‌ی سفارش را به همین ایمیل پاسخ دهید.`,
      `For a refund under the <a href="${SITE}/terms.html#${plan ? "subscriptions" : "purchases"}" style="color:#ff7a1a;">terms of purchase</a>, reply to this email with your order number.`
    ),
  };
};

// ---------- To the buyer: here is your game key ----------
// Sent by the studio from the admin panel (the "Send key" button).
export const keyEmail = (order: { number: number; title: string; name: string; email: string }, code: string) => {
  const key =
    `<p style="margin:18px 0 0;padding:16px;border:1px solid #2a2a2f;border-radius:10px;background:#151518;text-align:center;">` +
    `<span style="display:block;font-size:12px;color:#8e8c95;letter-spacing:.12em;">کلید بازی · GAME KEY</span>` +
    `<span dir="ltr" style="display:block;margin-top:8px;font:700 22px/1.4 monospace;letter-spacing:.14em;color:#ff7a1a;">${esc(code)}</span>` +
    `</p>`;
  const fa =
    hello(order.name, true) +
    `<p style="margin:0;">کلید بازی «<span dir="ltr">${esc(order.title)}</span>» شما آماده است.</p>` +
    key +
    `<p style="margin:16px 0 0;">این کلید یک‌بارمصرف است. لانچر ساوفاکس را باز کنید، وارد حسابتان شوید و این کلید را وارد کنید تا بازی به کتابخانه‌تان اضافه و از سرور دانلود شود. کلید در پروفایل شما هم هست.</p>`;
  const en =
    hello(order.name, false) +
    `<p style="margin:0;">Your key for &ldquo;${esc(order.title)}&rdquo; is ready.</p>` +
    key +
    `<p style="margin:16px 0 0;">This key works once. Open the SauFox launcher, sign in, and enter this key to add the game to your library and download it from our server. The key is in your profile too.</p>`;
  return {
    to: order.email,
    subject: `کلید بازی سفارش ${faNum(order.number)} ساوفاکس | Your SauFox game key, order ${order.number}`,
    html: page(
      fa,
      en,
      button(`${SITE}/profile.html#library`, "کتابخانه‌ی من", "My library"),
      "کلید خود را با کسی به اشتراک نگذارید.",
      "Keep your key to yourself."
    ),
  };
};

// ---------- To the buyer: the order is being worked on / is done ----------
// Sent when an admin moves a paid order to "processing" or "completed".
export const stageEmail = (order: Order, stage: "processing" | "completed") => {
  const done = stage === "completed";
  const fa =
    hello(order.name, true) +
    `<p style="margin:0;">${done ? "سفارش شما انجام شد." : "سفارش شما در حال انجام است."}</p>` +
    rows(
      [
        itemFa(order),
        ["شماره‌ی سفارش", faNum(order.number)],
        ["وضعیت", done ? "انجام شد" : "در حال انجام"],
      ],
      true
    ) +
    `<p style="margin:16px 0 0;">${
      done
        ? "همه‌ی مراحل سفارش شما تمام شده است و اثر در «کتابخانه»ی پروفایل شماست. از خریدتان سپاسگزاریم."
        : "پرداخت شما دریافت شده و سفارش را در حال آماده‌سازی داریم. وقتی کامل شد، دوباره به شما ایمیل می‌زنیم."
    }</p>`;
  const en =
    hello(order.name, false) +
    `<p style="margin:0;">${done ? "Your order is complete." : "Your order is in progress."}</p>` +
    rows(
      [
        itemEn(order),
        ["Order number", String(order.number)],
        ["Status", done ? "Completed" : "In progress"],
      ],
      false
    ) +
    `<p style="margin:16px 0 0;">${
      done
        ? "Everything for your order is done, and the work is in the Library in your profile. Thank you for your purchase."
        : "We&rsquo;ve received your payment and are getting your order ready. We&rsquo;ll email you again when it&rsquo;s complete."
    }</p>`;
  return {
    to: order.email,
    subject: done
      ? `سفارش ${faNum(order.number)} ساوفاکس انجام شد${testTag(order, true)} | SauFox order ${order.number} is complete${testTag(order, false)}`
      : `سفارش ${faNum(order.number)} ساوفاکس در حال انجام است${testTag(order, true)} | SauFox order ${order.number} is in progress${testTag(order, false)}`,
    html: page(
      fa,
      en,
      done
        ? button(`${SITE}/profile.html#library`, "کتابخانه‌ی من", "My library")
        : button(`${SITE}/profile.html#orders`, "سفارش‌های من", "My orders"),
      "پرسشی دارید؟ به همین ایمیل پاسخ دهید.",
      "Questions? Just reply to this email."
    ),
  };
};

// ---------- To the studio: a new order or payment ----------
export const studioEmail = (order: Order, event: "placed" | "paid") => {
  const paid = event === "paid";
  const list: [string, string][] = [
    ["Order", `#${order.number}${order.test ? " (test)" : ""}`],
    ["Work", esc(order.title)],
    ["Amount", rialsEn(order.amount_irr)],
    ["Buyer", esc(order.name)],
    ["Email", `<a href="mailto:${esc(order.email)}" style="color:#ff7a1a;">${esc(order.email)}</a>`],
    ["Mobile", esc(order.phone)],
    ...(paid
      ? ([
          ["Zarinpal ref", esc(order.ref_id)],
          ["Card", esc(order.card_pan || "—")],
        ] as [string, string][])
      : []),
    ["Time", whenEn(paid ? order.paid_at || new Date().toISOString() : order.created_at)],
  ];
  const fa = `<p style="margin:0;color:#f5f3ef;font-weight:700;">${paid ? "یک سفارش پرداخت شد." : "یک سفارش تازه ثبت شد."}</p>`;
  const en = `<p style="margin:0;">${paid ? "An order has been paid." : "A new order is waiting for payment."}</p>` + rows(list, false);
  return {
    to: STUDIO,
    replyTo: order.email,
    subject: `[SauFox] ${paid ? "پرداخت شد" : "سفارش جدید"} ${faNum(order.number)} | ${paid ? "Paid" : "New order"} #${order.number}: ${order.plan_id ? `${PLAN_EN[order.plan_id] || order.plan_id} plan` : order.title}${order.test ? " (test)" : ""}`,
    html: page(fa, en, button(`${SITE}/admin.html`, "پنل مدیریت", "Admin panel")),
  };
};

// ---------- Support tickets ----------
export type Ticket = { id: string; number: number; subject: string; category: string; email: string; name: string };
export type TicketMessage = { body: string; author_name: string; attachment_name?: string | null };
const CATEGORY_EN: Record<string, string> = {
  order: "An order",
  account: "Account and sign-in",
  technical: "Technical problem",
  subscription: "Subscription",
  other: "Something else",
};
const excerpt = (text: string) => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 600 ? `${one.slice(0, 600)}…` : one;
};
const quote = (text: string, rtl: boolean) =>
  `<div dir="auto" style="margin:14px 0 0;padding:12px 14px;border-${rtl ? "right" : "left"}:3px solid #ff7a1a;background:#111114;border-radius:8px;color:#f5f3ef;font-size:14px;line-height:1.8;white-space:pre-wrap;">${esc(excerpt(text))}</div>`;

// To the member: the studio answered their ticket.
export const ticketReplyEmail = (ticket: Ticket, message: TicketMessage) => {
  const link = `${SITE}/support.html?t=${encodeURIComponent(ticket.id)}`;
  const fa =
    hello(ticket.name, true) +
    `<p style="margin:0;">به تیکت <b>${faNum(ticket.number)}#</b> با موضوع «<span dir="auto">${esc(ticket.subject)}</span>» پاسخ دادیم:</p>` +
    quote(message.body, true);
  const en =
    hello(ticket.name, false) +
    `<p style="margin:0;">We've replied to ticket <b>#${ticket.number}</b>, &ldquo;${esc(ticket.subject)}&rdquo;:</p>` +
    quote(message.body, false);
  return {
    to: ticket.email,
    subject: `پاسخ به تیکت ${faNum(ticket.number)} | Reply to ticket #${ticket.number}`,
    html: page(
      fa,
      en,
      button(link, "دیدن و پاسخ دادن", "View and reply"),
      "لطفاً پاسختان را در سایت، در همان تیکت بنویسید.",
      "Please reply on the site, in the ticket itself."
    ),
  };
};

// To the studio: a new ticket, or the member wrote again.
export const ticketStudioEmail = (ticket: Ticket, message: TicketMessage, first: boolean) => {
  const list: [string, string][] = [
    ["Ticket", `#${ticket.number}`],
    ["Topic", esc(CATEGORY_EN[ticket.category] || ticket.category)],
    ["Subject", esc(ticket.subject)],
    ["From", `${esc(ticket.name)} &lt;<a href="mailto:${esc(ticket.email)}" style="color:#ff7a1a;">${esc(ticket.email)}</a>&gt;`],
    ...(message.attachment_name ? ([["Attachment", esc(message.attachment_name)]] as [string, string][]) : []),
  ];
  const fa = `<p style="margin:0;color:#f5f3ef;font-weight:700;">${first ? "یک تیکت پشتیبانی تازه باز شد." : "مشتری به تیکت پاسخ داد."}</p>`;
  const en = `<p style="margin:0;">${first ? "A new support ticket." : "The member wrote again."}</p>` + rows(list, false) + quote(message.body, false);
  return {
    to: STUDIO,
    replyTo: ticket.email,
    subject: `[SauFox] ${first ? "تیکت تازه" : "پاسخ مشتری"} ${faNum(ticket.number)} | ${first ? "New ticket" : "Reply"} #${ticket.number}: ${ticket.subject}`,
    html: page(fa, en, button(`${SITE}/admin.html#support`, "پنل مدیریت", "Admin panel")),
  };
};

// ---------- To a member who asked to be told: out now / trailer ----------
export const alertEmail = (email: string, work: { id: string; title: string }, event: "released" | "trailer") => {
  const out = event === "released";
  const link = `${SITE}/work.html?id=${encodeURIComponent(work.id)}`;
  const fa =
    `<p style="margin:0 0 8px;color:#f5f3ef;font-size:18px;font-weight:700;">${
      out ? `<span dir="ltr">${esc(work.title)}</span> منتشر شد!` : `تریلر <span dir="ltr">${esc(work.title)}</span> آمد!`
    }</p>` +
    `<p style="margin:0;">${
      out
        ? "اثری که خواسته بودید از انتشارش باخبرتان کنیم، حالا در دسترس است."
        : "تریلر اثری که دنبالش می‌کنید منتشر شد. همین حالا در صفحه‌ی اثر ببینیدش."
    }</p>`;
  const en =
    `<p style="margin:0 0 8px;color:#f5f3ef;font-size:18px;font-weight:700;">${
      out ? `${esc(work.title)} is out now!` : `The ${esc(work.title)} trailer is here!`
    }</p>` +
    `<p style="margin:0;">${
      out ? "The work you asked us to tell you about has been released." : "The trailer for a work you follow is out. Watch it on its page."
    }</p>`;
  return {
    to: email,
    subject: out ? `${work.title} منتشر شد | ${work.title} is out now` : `تریلر ${work.title} آمد | The ${work.title} trailer is here`,
    html: page(
      fa,
      en,
      button(link, out ? "دیدن اثر" : "دیدن تریلر", out ? "See it" : "Watch the trailer"),
      "این ایمیل را چون در صفحه‌ی این اثر «خبرم کن» را زده بودید دریافت می‌کنید. برای لغو، همان دکمه را دوباره بزنید.",
      "You're getting this because you chose Notify me on this work's page. Press it again there to stop."
    ),
  };
};

// ---------- To a member whose plan ends in a few days ----------
export const planEndingEmail = (email: string, planId: string, ends: string) => {
  const fa =
    `<p style="margin:0 0 8px;color:#f5f3ef;font-size:18px;font-weight:700;">اشتراک ${PLAN_FA[planId] || esc(planId)} شما رو به پایان است</p>` +
    `<p style="margin:0;">اشتراک شما ${whenFa(ends)} تمام می‌شود و خودبه‌خود تمدید نمی‌شود. برای اینکه تخفیف‌ها و تماشای رایگان قطع نشوند، پیش از آن تمدیدش کنید؛ روزهای تازه به دنبال روزهای باقی‌مانده اضافه می‌شوند.</p>`;
  const en =
    `<p style="margin:0 0 8px;color:#f5f3ef;font-size:18px;font-weight:700;">Your ${PLAN_EN[planId] || esc(planId)} plan ends soon</p>` +
    `<p style="margin:0;">It ends on ${whenEn(ends)} and doesn&rsquo;t renew by itself. Renew before then to keep your discounts and free viewing; the new days are added after the ones you have left.</p>`;
  return {
    to: email,
    subject: `اشتراک ساوفاکس شما رو به پایان است | Your SauFox plan ends soon`,
    html: page(
      fa,
      en,
      button(`${SITE}/checkout.html?plan=${encodeURIComponent(planId)}`, "تمدید اشتراک", "Renew my plan"),
      "این یادآوری فقط یک بار برای هر دوره فرستاده می‌شود.",
      "We send this reminder once per plan period."
    ),
  };
};

// A plain-text copy of each email, sent alongside the HTML: spam filters
// trust HTML-only mail less.
const plain = (html: string) =>
  html
    .replace(/<(style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) =>
      href.startsWith("mailto:") ? label : `${label} (${href})`
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|tr|div|table)>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&middot;/g, "·")
    .replace(/&rsquo;/g, "’")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

type Mail = { to: string; subject: string; html: string; replyTo?: string };

// Resend (resend.com), once RESEND_API_KEY is set: mail comes from the
// site's own domain (MAIL_FROM, default orders@saufoxentertainment.ir),
// which inboxes trust more. Replies still go to the studio's Gmail.
const viaResend = async (mail: Mail, idempotencyKey?: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({
      from: `SauFox Entertainment <${Deno.env.get("MAIL_FROM") || "orders@saufoxentertainment.ir"}>`,
      to: [mail.to],
      reply_to: mail.replyTo || STUDIO,
      subject: mail.subject,
      html: mail.html,
      text: plain(mail.html),
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

// Otherwise the studio's Gmail over SMTP.
let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
const viaGmail = async (mail: Mail) => {
  transport ||= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    // Google shows app passwords in groups of four; the spaces aren't part of it.
    auth: { user: STUDIO, pass: (Deno.env.get("SMTP_PASSWORD") || "").replace(/\s+/g, "") },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  await transport.sendMail({ from: { name: "SauFox Entertainment", address: STUDIO }, text: plain(mail.html), ...mail });
};

// Resend first when it's set up; if it refuses (say the domain isn't
// verified yet) and the Gmail password is there too, Gmail sends instead.
// Says which one sent it, and why Resend didn't.
export const send = async (mail: Mail, idempotencyKey?: string): Promise<{ via: "resend" | "gmail"; resendError?: string }> => {
  if (!Deno.env.get("RESEND_API_KEY")) {
    await viaGmail(mail);
    return { via: "gmail" };
  }
  try {
    await viaResend(mail, idempotencyKey);
    return { via: "resend" };
  } catch (e) {
    // A timeout may mean Resend accepted the email: never switch providers for queued mail.
    if (idempotencyKey || !Deno.env.get("SMTP_PASSWORD")) throw e;
    const resendError = (e as Error).message;
    console.error(resendError, "- sending through Gmail instead");
    await viaGmail(mail);
    return { via: "gmail", resendError };
  }
};
