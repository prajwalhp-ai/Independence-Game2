import { createServiceSupabase } from "@/lib/supabaseServer";
import Leaderboard from "./Leaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const svc = createServiceSupabase();
  const [{ data: cities }, { data: teams }] = await Promise.all([
    svc.from("cities").select("id, name, slug, status").order("name"),
    svc
      .from("teams")
      .select(
        "id, city_id, team_name, emp_code, emp_name, status, score, correct_count, tab_shifts, elapsed_seconds, submitted_at, created_at"
      ),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Live Leaderboard</h1>
      <p className="text-sm text-slate-500 mt-1">
        Ranked by points, then least time. Updates live as teams play.
      </p>
      <div className="mt-6">
        <Leaderboard cities={cities ?? []} initialTeams={teams ?? []} />
      </div>
    </div>
  );
}
