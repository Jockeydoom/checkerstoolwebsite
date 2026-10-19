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
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
let refreshing = false;
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const username = $("email").value.trim();
  const password = $("password").value;
  if (!$("loginForm").reportValidity()) return;
  $("login").disabled = true;
  msg("Signing in securely…");
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    $("password").value = "";
    await refresh();
  } catch (error) {
    msg("Sign-in failed: " + (error.message === "Invalid login credentials"
      ? "Invalid email or password. Confirm your account has a password set in Supabase Auth."
      : error.message));
  } finally {
    $("login").disabled = false;
  }
});
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
    $("loginForm").hidden = true;\n    msg("Signed in. Administrator access verified.");
  } catch (error) {
    $("stats").hidden = true;
    msg("Dashboard unavailable: " + error.message);
  } finally { refreshing = false; }
}
client.auth.onAuthStateChange((event) => {\n  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") queueMicrotask(refresh);\n});\nvoid refresh();\n