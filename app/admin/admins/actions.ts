"use server";

import { revalidatePath } from "next/cache";
import { getAdminEmail, createServiceSupabase } from "@/lib/supabaseServer";

export async function addAdmin(email: string) {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const svc = createServiceSupabase();
  const { error } = await svc.from("admins").upsert({ email: clean }, { onConflict: "email" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/admins");
  return { ok: true };
}

export async function removeAdmin(id: string) {
  const me = await getAdminEmail();
  if (!me) throw new Error("Not authorised");

  const svc = createServiceSupabase();

  // don't allow removing the last remaining admin
  const { count } = await svc.from("admins").select("*", { count: "exact", head: true });
  if ((count ?? 0) <= 1) {
    return { ok: false, error: "Cannot remove the last admin." };
  }

  // don't allow removing yourself (avoid locking yourself out mid-session)
  const { data: target } = await svc.from("admins").select("email").eq("id", id).maybeSingle();
  if (target && target.email.toLowerCase() === me.toLowerCase()) {
    return { ok: false, error: "You cannot remove your own admin access." };
  }

  const { error } = await svc.from("admins").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/admins");
  return { ok: true };
}
