import { verifiedCaller, memberClient } from "../_shared/auth.ts";
// Deleting a member's account, from the profile page.
//
// POST { action: "delete", confirm }   signed-in member (code or Google)
//   -> { ok }  confirm must be the account's email. Removes their photo
//   files and the account itself; with it go their profile, list, reviews,
//   alerts and download log. Orders stay (payment records) but are no
//   longer linked to anyone. Admin accounts can't be deleted here.
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

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

// The caller, if their session came through an emailed code or Google
// (same rule as the database's private.verified()).
const caller = (req: Request) => verifiedCaller(req, db);

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

  if (body.action === "delete") {
    if (String(body.confirm || "").trim().toLowerCase() !== (user.email || "").toLowerCase())
      return reply({ error: "confirm" }, 400);
    const { data: admin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (admin) return reply({ error: "admin" }, 409);
    // Photo files live under avatars/<user id>/.
    const { data: files } = await db.storage.from("avatars").list(user.id, { limit: 100 });
    if (files?.length) await db.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("delete account", error.message);
      return reply({ error: "failed" }, 500);
    }
    return reply({ ok: true });
  }

  return reply({ error: "bad_request" }, 400);
});
