import { notFound } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabaseServer";
import PlayEntry from "./PlayEntry";

export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: { slug: string } }) {
  const svc = createServiceSupabase();
  const { data: city } = await svc
    .from("cities")
    .select("id, name, slug, status")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!city) notFound();

  return <PlayEntry city={city} />;
}
