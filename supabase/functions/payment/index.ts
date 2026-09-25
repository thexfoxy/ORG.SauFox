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
//
// Emails (mail.ts): the buyer gets "order received" or a payment receipt,
// and the studio a copy of each; every email goes out once per order.
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
import { createClient } from "npm:@supabase/supabase-js@2";
import { mailReady, paidEmail, placedEmail, send, stageEmail, STUDIO, studioEmail, type Order } from "./mail.ts";

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
const caller = async (req: Request) => {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  try {
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const methods: { method: string }[] = claims.amr || [];
    if (!methods.some((m) => m.method !== "password")) return null;
  } catch {
    return null;
  }
  return data.user;
};

// Work that carries on after the reply (emails).
const later = (work: Promise<unknown>) => {
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else work.catch(() => {});
};

// Sends an order's email for one stage, once: the column marks it sent
// before sending, and is cleared again if sending fails. The studio gets a
// copy of new and paid orders. Returns whether an email went out.
type Stage = "placed" | "paid" | "processing" | "completed";
const ORDER_FIELDS = "id, number, title, amount_irr, name, email, phone, ref_id, card_pan, paid_at, created_at, test, work_id";
const emailOnce = async (orderId: string, kind: Stage) => {
  if (!mailReady()) return false;
  const column = `${kind}_email_at`;
  const { data } = await db
    .from("orders")
    .update({ [column]: new Date().toISOString() })
    .eq("id", orderId)
    .is(column, null)
    .select(ORDER_FIELDS);
  const order = data?.[0] as (Order & { work_id: string }) | undefined;
  if (!order) return false;
  try {
    if (kind === "placed") await send(placedEmail(order, false));
    else if (kind === "paid") {
      const { data: work } = await db.from("works").select("status").eq("id", order.work_id).maybeSingle();
      await send(paidEmail(order, work?.status === "released"));
    } else await send(stageEmail(order, kind));
  } catch (e) {
    console.error(`${kind} email`, (e as Error).message);
    await db.from("orders").update({ [column]: null }).eq("id", orderId);
    return false;
  }
  if (kind === "placed" || kind === "paid")
    await send(studioEmail(order, kind)).catch((e) => console.error("studio email", (e as Error).message));
  return true;
};

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
  // ---------- Test email (admin panel) ----------
  if (body.action === "email-test") {
    const user = await caller(req);
    if (!user) return reply({ error: "signed_out" }, 401);
    const { data: isAdmin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!isAdmin) return reply({ error: "forbidden" }, 403);
    if (!mailReady()) return reply({ error: "no_password" });
    const now = new Date().toISOString();
    const sample: Order = {
      id: "test", number: 1000, title: "The CandleWood", amount_irr: 3130000, name: "SauFox", email: STUDIO,
      phone: "09000000000", ref_id: "000000000000", card_pan: "6037-99**-****-0000", paid_at: now, created_at: now, test: true,
    };
    try {
      await send(paidEmail(sample, true));
      return reply({ ok: true, to: STUDIO });
    } catch (e) {
      return reply({ error: "send_failed", detail: (e as Error).message.slice(0, 200) });
    }
  }

  const orderId = String(body.order_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply({ error: "bad_request" }, 400);

  const { data: settings } = await db.from("site_settings").select("payments").eq("id", 1).single();
  const mode = settings?.payments || "off";

  // ---------- Status changed in the admin panel ----------
  if (body.action === "status-email") {
    const user = await caller(req);
    if (!user) return reply({ error: "signed_out" }, 401);
    const { data: isAdmin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!isAdmin) return reply({ error: "forbidden" }, 403);
    const { data: order } = await db.from("orders").select("id, status").eq("id", orderId).maybeSingle();
    if (!order) return reply({ error: "not_found" }, 404);
    if (!["paid", "processing", "completed"].includes(order.status)) return reply({ sent: false });
    return reply({ sent: await emailOnce(order.id, order.status as Stage) });
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
    if (test) {
      const { data: isAdmin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!isAdmin) return reply({ error: "closed" }, 409);
    }
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
    // Every code issued stays valid, in case an earlier bank tab is the one paid.
    await db
      .from("orders")
      .update({ authority, test, authorities: [...(order.authorities || []), authority].slice(-20) })
      .eq("id", order.id);
    return reply({ url: zp.startPay(authority) });
  }

  // ---------- Verify (back from the bank) ----------
  if (body.action === "verify") {
    const { data: order } = await db
      .from("orders")
      .select("id, number, amount_irr, status, authorities, ref_id, test")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return reply({ error: "not_found" }, 404);
    if (["paid", "processing", "completed"].includes(order.status))
      return reply({ paid: true, number: order.number, ref_id: order.ref_id });
    const authority = String(body.authority || "");
    if (!(order.authorities || []).includes(authority)) return reply({ error: "not_found" }, 404);
    if (body.status !== "OK") return reply({ paid: false, number: order.number });

    const zp = gateway(order.test);
    const answer = await zarinpal(order.test, "verify", { merchant_id: zp.merchant, amount: order.amount_irr, authority });
    const code = answer?.data?.code;
    if (code !== 100 && code !== 101) {
      console.error("zarinpal verify", JSON.stringify(answer));
      return reply({ paid: false, number: order.number });
    }
    const ref = String(answer.data.ref_id);
    await db
      .from("orders")
      .update({ status: "paid", authority, ref_id: ref, card_pan: answer.data.card_pan || null, paid_at: new Date().toISOString() })
      .eq("id", order.id)
      .not("status", "in", "(paid,processing,completed)");
    later(emailOnce(order.id, "paid"));
    return reply({ paid: true, number: order.number, ref_id: ref });
  }

  return reply({ error: "bad_request" }, 400);
});
