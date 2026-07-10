import { supabase } from "./supabase";

// Thin wrapper around Supabase Auth, used only to gate the Admin screen.
//
// Setup (one-time, in the Supabase dashboard):
//   Authentication → Users → Add user → enter the email/password you want
//   to log in with. There is no sign-up flow anywhere in this app — this is
//   intentionally login-only, for a single admin account.
//
// This file only handles the UI gate. The actual security boundary is the
// Row Level Security policy on the `places` table (see the SQL migration) —
// without it, anyone with browser devtools could write to the table directly
// regardless of what the Admin screen shows.

export async function signInAdmin(email: string, password: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Supabase not configured" };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signOutAdmin(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getAdminSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Subscribe to auth state changes (login/logout/token refresh).
// Returns an unsubscribe function for cleanup in a useEffect.
export function onAdminAuthChange(callback: (loggedIn: boolean) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(!!session);
  });
  return () => data.subscription.unsubscribe();
}
