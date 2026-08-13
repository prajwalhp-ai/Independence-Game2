import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

// Verifies the email is an allowlisted admin, and creates the auth
// account on first login (setting the chosen password). Then the
// browser signs in normally.
export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Missing email or password." }, { status: 400 });
  }

  const svc = createServiceSupabase();

  // 1) must be in the admins allowlist
  const { data: allowed } = await svc
    .from("admins")
    .select("email")
    .ilike("email", email)
    .maybeSingle();

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "This email is not authorised as an admin." },
      { status: 403 }
    );
  }

  // 2) does an auth user already exist for this email?
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase()
  );

  // 3) first login → create the account with the chosen password
  if (!existing) {
    const { error: createErr } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      return NextResponse.json({ ok: false, error: createErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
