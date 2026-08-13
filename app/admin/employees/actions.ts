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

export async function addEmployees(cityId: string, rows: EmpRow[]) {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  if (!cityId) return { ok: false, error: "Please select a city." };
  if (!rows?.length) return { ok: false, error: "No rows to add." };

  const svc = createServiceSupabase();

  // clean + de-duplicate by empcode within this batch
  const seen = new Set<string>();
  const clean: Array<EmpRow & { city_id: string }> = [];
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
      city_id: cityId,
    });
  }

  if (!clean.length) {
    return { ok: false, error: "No valid rows found (need at least empcode and name)." };
  }

  // upsert so re-uploading updates instead of erroring on duplicate empcode
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

export async function clearCityEmployees(cityId: string) {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  const svc = createServiceSupabase();
  const { error } = await svc.from("employees").delete().eq("city_id", cityId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/employees");
  return { ok: true };
}
