import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cfg = window.CHECKERS_DASHBOARD;
const $ = id => document.getElementById(id);
const msg = text => { $("message").textContent = text; };
if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey || cfg.supabaseAnonKey.startsWith("REPLACE")) {
  msg("Dashboard configuration missing. Contact the administrator.");
  $("login").disabled = true;
  throw new Error("Dashboard configuration missing");
}
const client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
let refreshing = false;
$("login").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!$("email").validity.valid || !email) { msg("Enter a valid email address."); return; }
  $("login").disabled = true;
  msg("Requesting secure sign-in link…");
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false }
    });
    if (error) throw error;
    msg("If this email is registered, check your inbox and spam folder for the sign-in link. Open the link in this browser.");
  } catch (error) {
    msg("Sign-in request failed: " + error.message);
  } finally { $("login").disabled = false; }
});
$("email").addEventListener("keydown", event => { if (event.key === "Enter") $("login").click(); });
$("logout").addEventListener("click", async () => {
  await client.auth.signOut();
  $("stats").hidden = true;
  $("logout").hidden = true;
  $("asof").textContent = "";
  msg("Signed out.");
});
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (!session) {
      $("stats").hidden = true;
      $("logout").hidden = true;
      msg("Enter your registered Supabase Auth email to receive a sign-in link.");
      return;
    }
    $("logout").hidden = false;
    msg("Verifying administrator access…");
    const token = session.access_token;
    const response = await fetch(cfg.supabaseUrl.replace(/\/$/, "") + "/functions/v1/" + encodeURIComponent(cfg.functionName), {
      headers: { Authorization: "Bearer " + token, apikey: cfg.supabaseAnonKey },
      cache: "no-store"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Dashboard request failed (HTTP " + response.status + ")");
    const values = { accounts: body.accounts, openTickets: body.open_tickets, tickets: body.total_tickets, jobs: body.active_jobs };
    for (const [id, value] of Object.entries(values)) $(id).textContent = Number(value ?? 0).toLocaleString();
    $("stats").hidden = false;
    $("asof").textContent = "Last refreshed: " + new Date(body.generated_at).toLocaleString();
    msg("Signed in. Administrator access verified.");
  } catch (error) {
    $("stats").hidden = true;
    msg("Dashboard unavailable: " + error.message);
  } finally { refreshing = false; }
}
const callbackParams = new URLSearchParams(location.search);
const hashParams = new URLSearchParams(location.hash.slice(1));
const callbackError = callbackParams.get("error_description") || hashParams.get("error_description");
if (callbackError) {
  msg("Email sign-in link failed: " + callbackError + ". Request a new link and verify the dashboard URL is allowed in Supabase Auth redirect settings.");
} else {
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") void refresh();
  });
  void refresh();
}
