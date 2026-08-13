import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createAdminBase } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Server client bound to the user's cookies (knows who is logged in).
// Used to check admin login on protected pages / actions.
export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

// Service-role client. FULL database access — server only, never sent to browser.
// Used for privileged admin writes (create cities, bulk-add employees).
export function createServiceSupabase() {
  return createAdminBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Returns the logged-in user's email if they are an admin, otherwise null.
export async function getAdminEmail(): Promise<string | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const svc = createServiceSupabase();
  const { data } = await svc
    .from("admins")
    .select("email")
    .ilike("email", user.email)
    .maybeSingle();

  return data ? user.email : null;
}
