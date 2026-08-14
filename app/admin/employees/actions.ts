"use server";

import { revalidatePath } from "next/cache";
import { getAdminEmail, createServiceSupabase } from "@/lib/supabaseServer";

type EmpRow = {
  empcode: string;
  name: string;
  email?: string;
  department?: string;
  location?: string;
};

export async function addEmployees(rows: EmpRow[]) {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  if (!rows?.length) return { ok: false, error: "No rows to add." };

  const svc = createServiceSupabase();

  const seen = new Set<string>();
  const clean: EmpRow[] = [];
  for (const r of rows) {
    const empcode = String(r.empcode || "").trim();
    const name = String(r.name || "").trim();
    if (!empcode || !name) continue;
    if (seen.has(empcode.toLowerCase())) continue;
    seen.add(empcode.toLowerCase());
    clean.push({
      empcode,
      name,
      email: String(r.email || "").trim() || undefined,
      department: String(r.department || "").trim() || undefined,
      location: String(r.location || "").trim() || undefined,
    });
  }

  if (!clean.length) {
    return { ok: false, error: "No valid rows found (need at least empcode and name)." };
  }

  const { error, count } = await svc
    .from("employees")
    .upsert(clean, { onConflict: "empcode", count: "exact" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/employees");
  return { ok: true, added: count ?? clean.length };
}

export async function deleteEmployee(id: string) {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  const svc = createServiceSupabase();
  const { error } = await svc.from("employees").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/employees");
  return { ok: true };
}

export async function clearAllEmployees() {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  const svc = createServiceSupabase();
  const { error } = await svc.from("employees").delete().neq("empcode", "");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/employees");
  return { ok: true };
}
