import { createServiceSupabase } from "@/lib/supabaseServer";
import CityManager from "./CityManager";

export const dynamic = "force-dynamic";

export default async function CitiesPage() {
  const svc = createServiceSupabase();
  const { data: cities } = await svc
    .from("cities")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Cities</h1>
      <p className="text-sm text-slate-500 mt-1">
        Each city has its own game link. Teams in a city compete only against each other.
      </p>
      <div className="mt-6">
        <CityManager cities={cities ?? []} />
      </div>
    </div>
  );
}
