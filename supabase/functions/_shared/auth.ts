import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.1";

export const memberClient = (req: Request) => createClient(
  Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  },
);

// Verify the signature/user AND the current session and ban status in the database.
export const verifiedCaller = async (req: Request, admin: SupabaseClient) => {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const valid = await memberClient(req).rpc("session_valid");
  return !valid.error && valid.data === true ? data.user : null;
};
