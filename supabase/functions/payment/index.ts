import { verifiedCaller, memberClient } from "../_shared/auth.ts";
// Online payment through Zarinpal (a Shaparak-licensed gateway).
//
// POST { action: "start", order_id }            signed-in member, own order
//   -> { url }  the bank page to send them to
// POST { action: "verify", order_id, authority, status }
//   -> { paid, number, ref_id? }  asks Zarinpal whether the payment went through
// POST { action: "placed", order_id }           signed-in member, own order
//   -> { ok }  emails "order received" (sent while online payment is closed)
// POST { action: "status-email", order_id }     admins, after changing a status
//   -> { sent }  the buyer's email for the order's status (paid: receipt,
//   processing: in progress, completed: done), once each
// POST { action: "email-test" }                 admins
//   -> { ok } or { error }  sends a sample receipt to the studio address
// POST { action: "ticket-email", message_id }     the message's author
//   -> { sent }  a support message: the studio's reply goes to the member,
//   a member's message (new ticket or follow-up) to the studio
// POST { action: "retry-emails", order_id? }     admins (one order), or the
//   database every 15 minutes with the x-retry-key header (all orders)
//   -> { sent, failed }  sends the emails that didn't go out before, and
//   (from the database) the "Notify me" and "your plan ends soon" emails
//   that are due
//
// Emails (mail.ts): the buyer gets "order received" or a payment receipt,
// and the studio a copy of each; every email goes out once per order. One
// that fails is kept in email_pending and tried again for a day.
//
// site_settings.sales_open: while it's false only admins can place orders
// (the database refuses the rest) or start a payment, so the studio can
// catch up; coming back from the bank still works.
//
// The amount always comes from the order in the database. site_settings
// .payments switches it: "off", "test" (Zarinpal's sandbox; only admins can
// start a payment, and orders paid there are marked test) or "live" (needs
// the ZARINPAL_MERCHANT_ID secret in Edge Functions → Secrets).
//
// Zarinpal only accepts requests from registered server IPs. Edge Functions
// leave from a different IP each time, so the requests themselves go out
// from the database (public.zarinpal_call), whose IP stays the same; the
// admin panel shows it.
import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { alertEmail, keyEmail, mailReady, paidEmail, placedEmail, planEndingEmail, send, stageEmail, STUDIO, studioEmail, ticketReplyEmail, ticketStudioEmail, type Order } from "./mail.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const SITE = "https://saufoxentertainment.ir";
const SANDBOX_MERCHANT = "1344b5d4-0048-11e8-94db-005056a205be"; // any well-formed ID works there

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const gateway = (test: boolean) => ({
  test,
  merchant: test ? SANDBOX_MERCHANT : Deno.env.get("ZARINPAL_MERCHANT_ID") || "",
  startPay: (authority: string) =>
    `${test ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com"}/pg/StartPay/${authority}`,
});

// Sends a request to Zarinpal through the database (see above).
const zarinpal = async (test: boolean, action: "request" | "verify", payload: unknown) => {
  const { data, error } = await db.rpc("zarinpal_call", { test, action, payload });
  if (error) console.error("zarinpal_call", error.message);
  return data || {};
};

// The caller, if their session came through an emailed code or Google
// (same rule as the database's private.verified()).
const caller = (req: Request) => verifiedCaller(req, db);

// Work that carries on after the reply (emails).
const later = (work: Promise<unknown>) => {
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else work.catch(() => {});
};

// Sends an order's email for one stage, once: the column marks it sent
// before sending, and is cleared again if sending fails, when the stage
// goes into email_pending to be tried again. The studio gets a copy of new
// and paid orders. Returns whether an email went out.
type Stage = "placed" | "paid" | "processing" | "completed";
const ORDER_FIELDS =
  "id, number, title, amount_irr, name, email, phone, ref_id, card_pan, paid_at, created_at, test, work_id, plan_id, email_pending, email_tries";
type Row = Order & { work_id: string | null; email_pending: string[]; email_tries: number };
const emailOnce = async (orderId: string, kind: Stage) => {
  if (!mailReady()) return false;
  const column = `${kind}_email_at`;
  const { data } = await db
    .from("orders")
    .update({ [column]: new Date().toISOString() })
    .eq("id", orderId)
    .is(column, null)
    .select(ORDER_FIELDS);
  const order = data?.[0] as Row | undefined;
  if (!order) return false;
  const pending = (order.email_pending || []).filter((k) => k !== kind);
  try {
    if (kind === "placed") await send(placedEmail(order, false));
    else if (kind === "paid" && order.plan_id) {
      const { data: sub } = await db.from("subscriptions").select("ends_at").eq("order_id", order.id).maybeSingle();
      await send(paidEmail(order, true, sub?.ends_at));
    } else if (kind === "paid") {
      const { data: work } = await db.from("works").select("status, kind").eq("id", order.work_id).maybeSingle();
      // A game's key is delivered by hand later, so the receipt only says it's
      // coming by email; other works go straight to the buyer's library.
      const game = (work?.kind || "").toLowerCase() === "game";
      await send(paidEmail(order, work?.status === "released", null, game));
    } else await send(stageEmail(order, kind));
  } catch (e) {
    const message = (e as Error).message;
    console.error(`${kind} email`, message);
    await db
      .from("orders")
      .update({ [column]: null, email_pending: [...pending, kind], email_error: message.slice(0, 300), email_tries: order.email_tries + 1 })
      .eq("id", orderId);
    return false;
  }
  if (pending.length !== (order.email_pending || []).length)
    await db
      .from("orders")
      .update(pending.length ? { email_pending: pending } : { email_pending: [], email_error: null, email_tries: 0 })
      .eq("id", orderId);
  if (kind === "placed" || kind === "paid")
    await send(studioEmail(order, kind)).catch((e) => console.error("studio email", (e as Error).message));
  return true;
};

// Tries an order's failed emails again. A stage the order has moved past
// (say "in progress" once it's completed) is dropped instead.
const retryOrder = async (order: { id: string; status: string; email_pending: string[] }) => {
  const due = (order.email_pending || []).filter((kind) =>
    kind === "placed"
      ? order.status === "awaiting_payment"
      : kind === "processing"
        ? order.status === "processing"
        : kind === "paid"
          ? ["paid", "processing", "completed"].includes(order.status)
          : order.status === kind
  ) as Stage[];
  if (due.length !== (order.email_pending || []).length)
    await db
      .from("orders")
      .update(due.length ? { email_pending: due } : { email_pending: [], email_error: null, email_tries: 0 })
      .eq("id", order.id);
  let sent = 0;
  for (const kind of due) if (await emailOnce(order.id, kind)) sent++;
  return { sent, failed: due.length - sent };
};

// "Notify me" emails that are due (work_alerts.pending), a batch at a
// time; one that fails is tried again on the next run, for about 3 days.
const sendAlerts = async () => {
  const { data: alerts } = await db
    .from("work_alerts")
    .select("user_id, work_id, email, pending, tries, works(id, title)")
    .not("pending", "is", null)
    .lt("tries", 300)
    .limit(40);
  let sent = 0;
  let failed = 0;
  for (const alert of alerts || []) {
    const work = alert.works as unknown as { id: string; title: string } | null;
    const key = { user_id: alert.user_id, work_id: alert.work_id };
    if (!work || !alert.email) {
      await db.from("work_alerts").update({ pending: null }).match(key);
      continue;
    }
    const event = alert.pending as "released" | "trailer";
    try {
      await send(alertEmail(alert.email, work, event));
      await db.from("work_alerts").update({ pending: null, [`${event}_sent_at`]: new Date().toISOString() }).match(key);
      sent++;
    } catch (e) {
      console.error("alert email", (e as Error).message);
      await db.from("work_alerts").update({ tries: alert.tries + 1 }).match(key);
      // Most likely the day's sending limit: leave the rest for later.
      if (++failed >= 3) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 600)); // Resend takes 2 a second
  }
  return { sent, failed };
};

// "Your plan ends soon", three days ahead, once per stretch, unless the
// member has already renewed (a later stretch of any plan).
const sendPlanReminders = async () => {
  const now = new Date();
  const { data: subs } = await db
    .from("subscriptions")
    .select("id, user_id, plan_id, ends_at")
    .is("reminded_at", null)
    .gt("ends_at", now.toISOString())
    .lt("ends_at", new Date(now.getTime() + 3 * 86400000).toISOString())
    .limit(20);
  let sent = 0;
  let failed = 0;
  for (const sub of subs || []) {
    const { count } = await db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sub.user_id)
      .gt("ends_at", sub.ends_at);
    const { data: who } = count ? { data: null } : await db.auth.admin.getUserById(sub.user_id);
    const email = who?.user?.email;
    try {
      if (email) {
        await send(planEndingEmail(email, sub.plan_id, sub.ends_at));
        sent++;
      }
      await db.from("subscriptions").update({ reminded_at: new Date().toISOString() }).eq("id", sub.id);
    } catch (e) {
      console.error("plan reminder", (e as Error).message);
      if (++failed >= 3) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { sent, failed };
};

// Claim rows atomically. The database queued them when the message was committed.
const sendTicketEmails = async (messageId: string | null = null) => {
  if (!mailReady()) return { sent: 0, failed: 0 };
  let sent = 0, failed = 0;
  // Claim only the next job so queued SMTP work cannot outlive its lease.
  for (let index = 0; index < 10; index++) {
    const { data: jobs, error } = await db.rpc("claim_ticket_emails", { p_message: messageId, p_limit: 1 });
    if (error) throw new Error("Could not claim support email jobs");
    if (!jobs?.length) break;
    const job = jobs[0];
    let problem: string | null = null;
    try {
      const { data: message, error: messageError } = await db.from("ticket_messages")
        .select("id,ticket_id,staff,body,author_name,attachment_name,created_at").eq("id", job.message_id).single();
      if (messageError || !message) throw new Error("Message unavailable");
      const { data: ticket, error: ticketError } = await db.from("tickets")
        .select("id,number,subject,category,email,name").eq("id", message.ticket_id).single();
      if (ticketError || !ticket) throw new Error("Ticket unavailable");
      const { data: first, error: firstError } = await db.from("ticket_messages").select("id")
        .eq("ticket_id", ticket.id).order("created_at").order("id").limit(1);
      if (firstError) throw new Error("Ticket history unavailable");
      const mail = message.staff ? ticketReplyEmail(ticket, message) : ticketStudioEmail(ticket, message, first?.[0]?.id === message.id);
      await send(mail, `ticket-${message.id}`);
      sent++;
    } catch (e) { problem = (e as Error).message; failed++; }
    const done = await db.rpc("finish_ticket_email", { p_message: job.message_id, p_claim: job.claim, p_error: problem });
    if (done.error) console.error("support email acknowledgment failed", job.message_id);
  }
  return { sent, failed };
};

const salesOpen = async () => {
  const { data } = await db.from("site_settings").select("sales_open").eq("id", 1).maybeSingle();
  return data?.sales_open !== false;
};
const isAdmin = async (userId: string) =>
  Boolean((await db.from("admins").select("user_id").eq("user_id", userId).maybeSingle()).data);

const mobileOf = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (/^989\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return /^09\d{9}$/.test(digits) ? digits : undefined;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST") return reply({ error: "method" }, 405);
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "bad_request" }, 400);
  }
  // ---------- Support ticket emails ----------
  if (body.action === "ticket-email") {
    const user = await caller(req);
    if (!user) return reply({ error: "signed_out" }, 401);
    const { data: message } = await db
      .from("ticket_messages")
      .select("id, ticket_id, user_id, staff, body, author_name, attachment_name, created_at")
      .eq("id", String(body.message_id || ""))
      .maybeSingle();
    // Only its author, and only while it's fresh (no re-sending old ones).
    if (!message || message.user_id !== user.id || Date.now() - Date.parse(message.created_at) > 10 * 60 * 1000)
      return reply({ error: "not_found" }, 404);
    if (!mailReady()) return reply({ queued: true, sent: false });
    later(sendTicketEmails(message.id));
    return reply({ queued: true });
  }

  // ---------- Send a game key to the buyer (admin panel) ----------
  // Emails the order's license key to the buyer and marks it delivered, so
  // the game then appears in their library and launcher.
  if (body.action === "send-key") {
    const user = await caller(req);
    if (!user) return reply({ error: "signed_out" }, 401);
    if (!(await isAdmin(user.id))) return reply({ error: "forbidden" }, 403);
    if (!/^[0-9a-f-]{36}$/i.test(String(body.order_id || ""))) return reply({ error: "bad_request" }, 400);
    if (!mailReady()) return reply({ error: "no_password" });
    const { data: order } = await db
      .from("orders")
      .select("id, number, title, name, email, work_id")
      .eq("id", body.order_id)
      .maybeSingle();
    if (!order) return reply({ error: "not_found" }, 404);
    const { data: lic } = await db
      .from("licenses")
      .select("id, code, revoked")
      .eq("order_id", order.id)
      .maybeSingle();
    if (!lic || lic.revoked) return reply({ error: "no_license" }, 404);
    try {
      await send(keyEmail(order, lic.code));
    } catch (e) {
      return reply({ error: "send_failed", detail: (e as Error).message.slice(0, 200) });
    }
    await db.from("licenses").update({ delivered_at: new Date().toISOString() }).eq("id", lic.id);
    return reply({ sent: true });
  }

  // ---------- Test email (admin panel) ----------
  if (body.action === "email-test") {
    const user = await caller(req);
    if (!user) return reply({ error: "signed_out" }, 401);
    if (!(await isAdmin(user.id))) return reply({ error: "forbidden" }, 403);
    if (!mailReady()) return reply({ error: "no_password" });
    const now = new Date().toISOString();
    const sample: Order = {
      id: "test", number: 1000, title: "The CandleWood", amount_irr: 3130000, name: "SauFox", email: STUDIO,
      phone: "09000000000", ref_id: "000000000000", card_pan: "6037-99**-****-0000", paid_at: now, created_at: now, test: true,
    };
    try {
      const { via, resendError } = await send(paidEmail(sample, true, null, true));
      return reply({ ok: true, to: STUDIO, via, resend_error: resendError?.slice(0, 200) });
    } catch (e) {
      return reply({ error: "send_failed", detail: (e as Error).message.slice(0, 200) });
    }
  }

  // ---------- Emails that didn't go out ----------
  if (body.action === "retry-emails") {
    const key = req.headers.get("x-retry-key") || "";
    const fromCron = key ? Boolean((await db.rpc("email_retry_key_ok", { key })).data) : false;
    if (!fromCron) {
      const user = await caller(req);
      if (!user) return reply({ error: "signed_out" }, 401);
      if (!(await isAdmin(user.id))) return reply({ error: "forbidden" }, 403);
      if (!/^[0-9a-f-]{36}$/i.test(String(body.order_id || ""))) return reply({ error: "bad_request" }, 400);
    }
    if (!mailReady()) return reply({ error: "no_password" });
    // The admin's button tries one order however often it failed; the
    // database's run tries every order for about a day (96 runs).
    let query = db.from("orders").select("id, status, email_pending").neq("email_pending", "{}");
    query = fromCron ? query.lt("email_tries", 96).order("updated_at").limit(25) : query.eq("id", String(body.order_id));
    const { data: orders } = await query;
    let sent = 0;
    let failed = 0;
    for (const order of orders || []) {
      const result = await retryOrder(order);
      sent += result.sent;
      failed += result.failed;
    }
    if (fromCron) {
      for (const result of [await sendAlerts(), await sendPlanReminders(), await sendTicketEmails()]) {
        sent += result.sent;
        failed += result.failed;
      }
    }
    return reply({ sent, failed });
  }

  const orderId = String(body.order_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply({ error: "bad_request" }, 400);

  const { data: settings } = await db.from("site_settings").select("payments").eq("id", 1).single();
  const mode = settings?.payments || "off";

  // ---------- Status changed in the admin panel ----------
  if (body.action === "status-email") {
    const user = await caller(req);
    if (!user) return reply({ error: "signed_out" }, 401);
    if (!(await isAdmin(user.id))) return reply({ error: "forbidden" }, 403);
    const { data: order } = await db.from("orders").select("id, status").eq("id", orderId).maybeSingle();
    if (!order) return reply({ error: "not_found" }, 404);
    if (!["paid", "processing", "completed"].includes(order.status)) return reply({ sent: false });
    if (await emailOnce(order.id, order.status as Stage)) return reply({ sent: true });
    const { data: after } = await db.from("orders").select("email_pending").eq("id", order.id).maybeSingle();
    return reply({ sent: false, failed: (after?.email_pending || []).includes(order.status) });
  }

  // ---------- Placed (online payment closed) ----------
  if (body.action === "placed") {
    const user = await caller(req);
    if (!user) return reply({ error: "signed_out" }, 401);
    const { data: order } = await db.from("orders").select("id, user_id, status").eq("id", orderId).maybeSingle();
    if (!order || order.user_id !== user.id) return reply({ error: "not_found" }, 404);
    if (order.status === "awaiting_payment") later(emailOnce(order.id, "placed"));
    return reply({ ok: true });
  }

  // ---------- Start ----------
  if (body.action === "start") {
    const user = await caller(req);
    if (!user) return reply({ error: "signed_out" }, 401);
    if (mode === "off") return reply({ error: "closed" }, 409);
    const test = mode === "test";
    if ((test || !(await salesOpen())) && !(await isAdmin(user.id)))
      return reply({ error: test ? "closed" : "paused" }, 409);
    const zp = gateway(test);
    if (!zp.merchant) return reply({ error: "not_configured" }, 503);

    const { data: order } = await db
      .from("orders")
      .select("id, number, title, amount_irr, email, phone, status, user_id, authorities")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.user_id !== user.id) return reply({ error: "not_found" }, 404);
    if (order.status !== "awaiting_payment") return reply({ error: "not_payable", status: order.status }, 409);

    const answer = await zarinpal(test, "request", {
      merchant_id: zp.merchant,
      amount: order.amount_irr,
      currency: "IRR",
      description: `SauFox order ${order.number}: ${order.title}`,
      callback_url: `${SITE}/checkout.html?order=${order.id}`,
      metadata: { email: order.email || undefined, mobile: mobileOf(order.phone), order_id: String(order.number) },
    });
    const authority = answer?.data?.authority;
    if (answer?.data?.code !== 100 || !authority) {
      console.error("zarinpal request", JSON.stringify(answer));
      return reply({ error: "gateway" }, 502);
    }
    const { error: saveError } = await db.rpc("register_payment_attempt", {
      p_order: order.id, p_authority: authority, p_test: test, p_amount: order.amount_irr,
    });
    if (saveError) return reply({ error: "storage" }, 503);
    return reply({ url: zp.startPay(authority) });
  }

  // ---------- Verify (back from the bank) ----------
  if (body.action === "verify") {
    const { data: order } = await db
      .from("orders")
      .select("id, number, amount_irr, status, authorities, ref_id, test, plan_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return reply({ error: "not_found" }, 404);
    const authority = String(body.authority || "");
    const { data: attempt, error: attemptError } = await db.rpc("payment_attempt", { p_order: order.id, p_authority: authority });
    if (attemptError) return reply({ error: "storage" }, 503);
    if (!attempt) return reply({ error: "not_found" }, 404);
    if (attempt.needs_review) return reply({ paid: false, error: "payment_review", number: order.number }, 409);
    if (attempt.verified_at && attempt.ref_id && !attempt.needs_review && order.ref_id === attempt.ref_id
      && ["paid", "processing", "completed"].includes(order.status))
      return reply({ paid: true, number: order.number, ref_id: order.ref_id, plan: order.plan_id });
    if (body.status !== "OK") return reply({ paid: false, number: order.number, plan: order.plan_id });
    const zp = gateway(attempt.test);
    const answer = await zarinpal(attempt.test, "verify", { merchant_id: zp.merchant, amount: attempt.amount_irr, authority });
    const code = answer?.data?.code;
    if (!answer || (!answer.data && !answer.errors?.code)) return reply({ error: "gateway" }, 502);
    if (code !== 100 && code !== 101) {
      console.error("zarinpal verify", JSON.stringify(answer));
      return reply({ paid: false, number: order.number, plan: order.plan_id });
    }
    if (!answer.data.ref_id) return reply({ error: "gateway" }, 502);
    const { data: result, error: saveError } = await db.rpc("confirm_order_payment", {
      p_order: order.id, p_authority: authority, p_ref: String(answer.data.ref_id), p_card: answer.data.card_pan || null,
    });
    if (saveError || !result) return reply({ error: "storage" }, 503);
    if (result.paid) later(emailOnce(order.id, "paid"));
    return reply(result, result.error ? 409 : 200);
  }

  return reply({ error: "bad_request" }, 400);
});
