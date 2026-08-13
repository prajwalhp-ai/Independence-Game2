"use server";

import { revalidatePath } from "next/cache";
import { getAdminEmail, createServiceSupabase } from "@/lib/supabaseServer";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCity(formData: FormData) {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "City name is required." };

  const svc = createServiceSupabase();
  let base = slugify(name) || "city";
  let slug = base;
  let n = 1;
  // ensure the slug is unique
  while (true) {
    const { data } = await svc.from("cities").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    n += 1;
    slug = `${base}-${n}`;
  }

  const { error } = await svc.from("cities").insert({ name, slug });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/cities");
  return { ok: true };
}

export async function setCityStatus(cityId: string, status: "waiting" | "running" | "stopped") {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  const svc = createServiceSupabase();

  const patch: Record<string, unknown> = { status };
  if (status === "running") {
    patch.started_at = new Date().toISOString();
    patch.stopped_at = null;
  } else if (status === "stopped") {
    patch.stopped_at = new Date().toISOString();
  } else if (status === "waiting") {
    patch.started_at = null;
    patch.stopped_at = null;
  }

  const { error } = await svc.from("cities").update(patch).eq("id", cityId);
  if (error) return { ok: false, error: error.message };

  // When stopping, submit any teams still playing in this city.
  if (status === "stopped") {
    await svc
      .from("teams")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("city_id", cityId)
      .neq("status", "submitted");
  }

  revalidatePath("/admin/cities");
  revalidatePath("/admin/leaderboard");
  return { ok: true };
}

export async function deleteCity(cityId: string) {
  if (!(await getAdminEmail())) throw new Error("Not authorised");
  const svc = createServiceSupabase();
  const { error } = await svc.from("cities").delete().eq("id", cityId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/cities");
  return { ok: true };
}
