// A buyer's files, and signing in the SauFox launcher.
//
// POST { action: "download", build_id, source? }   signed-in member who paid
//   -> { url, file_name, size_bytes, version }  a link to the file, valid for
//   an hour; "source" is "site" or "launcher". At most 10 links a day per
//   file for each member (admins aren't limited).
// POST { action: "upload", work_id, file_name }    admins
//   -> { url, key }  a link to PUT the file straight into the bucket (up to
//   5 GB); the admin panel then saves the build with that key.
// POST { action: "delete", build_id }              admins
//   -> { ok }  removes the file from the bucket and the build.
// POST { action: "launcher-token" }                signed-in member
//   -> { token_hash, email }  a one-time sign-in for the launcher, which
//   turns it into its own session with auth.verifyOtp({ token_hash, type:
//   "magiclink" }). The browser's session is never handed over.
//
// Files live in a private S3-compatible bucket (r2.ts); the builds table
// says which file belongs to which work.
import { createClient } from "npm:@supabase/supabase-js@2";
import { r2Link, r2Ready } from "./r2.ts";

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

const LINK_SECONDS = 3600;
const DAILY_LINKS = 10;
const UUID = /^[0-9a-f-]{36}$/i;

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
const isAdmin = async (userId: string) =>
  Boolean((await db.from("admins").select("user_id").eq("user_id", userId).maybeSingle()).data);

// "The CandleWood v1.0.zip" -> "The-CandleWood-v1.0.zip"
const safeName = (name: string) =>
  name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "file";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST") return reply({ error: "method" }, 405);
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "bad_request" }, 400);
  }
  const user = await caller(req);
  if (!user) return reply({ error: "signed_out" }, 401);

  // ---------- Launcher sign-in ----------
  if (body.action === "launcher-token") {
    if (!user.email) return reply({ error: "no_email" }, 400);
    const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: user.email });
    if (error || !data.properties?.hashed_token) {
      console.error("launcher-token", error?.message);
      return reply({ error: "failed" }, 500);
    }
    return reply({ token_hash: data.properties.hashed_token, email: user.email });
  }

  if (!r2Ready()) return reply({ error: "not_configured" }, 503);
  const admin = await isAdmin(user.id);

  // ---------- Download ----------
  if (body.action === "download") {
    if (!UUID.test(String(body.build_id || ""))) return reply({ error: "bad_request" }, 400);
    const { data: build } = await db
      .from("builds")
      .select("id, work_id, version, file_key, file_name, size_bytes, published")
      .eq("id", body.build_id)
      .maybeSingle();
    if (!build || (!build.published && !admin)) return reply({ error: "not_found" }, 404);
    if (!admin) {
      const { data: owned } = await db
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("work_id", build.work_id)
        .in("status", ["paid", "processing", "completed"])
        .limit(1);
      if (!owned?.length) return reply({ error: "not_owned" }, 403);
      const { count } = await db
        .from("downloads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("build_id", build.id)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());
      if ((count || 0) >= DAILY_LINKS) return reply({ error: "limit" }, 429);
    }
    await db.from("downloads").insert({ user_id: user.id, build_id: build.id, source: body.source === "launcher" ? "launcher" : "site" });
    const url = await r2Link("GET", build.file_key, LINK_SECONDS, {
      "response-content-disposition": `attachment; filename="${safeName(build.file_name)}"`,
    });
    return reply({ url, file_name: build.file_name, size_bytes: build.size_bytes, version: build.version });
  }

  if (!admin) return reply({ error: "forbidden" }, 403);

  // ---------- Upload (admin panel) ----------
  if (body.action === "upload") {
    const workId = String(body.work_id || "");
    const { data: work } = await db.from("works").select("id").eq("id", workId).maybeSingle();
    if (!work) return reply({ error: "not_found" }, 404);
    const key = `${safeName(workId)}/${Date.now()}-${safeName(String(body.file_name || ""))}`;
    return reply({ url: await r2Link("PUT", key, LINK_SECONDS), key });
  }

  // ---------- Delete (admin panel) ----------
  if (body.action === "delete") {
    if (!UUID.test(String(body.build_id || ""))) return reply({ error: "bad_request" }, 400);
    const { data: build } = await db.from("builds").select("id, file_key").eq("id", body.build_id).maybeSingle();
    if (!build) return reply({ error: "not_found" }, 404);
    const res = await fetch(await r2Link("DELETE", build.file_key, 300), { method: "DELETE" });
    if (!res.ok && res.status !== 404) return reply({ error: "storage", status: res.status }, 502);
    await db.from("builds").delete().eq("id", build.id);
    return reply({ ok: true });
  }

  return reply({ error: "bad_request" }, 400);
});
