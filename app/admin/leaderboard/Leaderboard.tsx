"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type City = { id: string; name: string; slug: string; status: string };
type Team = {
  id: string;
  city_id: string;
  team_name: string;
  emp_code: string;
  emp_name: string | null;
  status: string;
  score: number;
  correct_count: number;
  tab_shifts: number;
  elapsed_seconds: number;
  submitted_at: string | null;
  created_at: string;
};

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// rank: higher score first, then less time, then earlier submit
function rankSort(a: Team, b: Team) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.elapsed_seconds !== b.elapsed_seconds) return a.elapsed_seconds - b.elapsed_seconds;
  const at = a.submitted_at ? Date.parse(a.submitted_at) : Infinity;
  const bt = b.submitted_at ? Date.parse(b.submitted_at) : Infinity;
  return at - bt;
}

const statusPill: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-700",
  playing: "bg-blue-100 text-blue-700",
  submitted: "bg-green-100 text-green-700",
};

export default function Leaderboard({
  cities,
  initialTeams,
}: {
  cities: City[];
  initialTeams: Team[];
}) {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [cityId, setCityId] = useState<string>(cities[0]?.id ?? "");

  // live updates on the teams table
  useEffect(() => {
    const channel = supabase
      .channel("leaderboard-teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        (payload) => {
          setTeams((prev) => {
            const row = payload.new as Team;
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id: string };
              return prev.filter((t) => t.id !== old.id);
            }
            const idx = prev.findIndex((t) => t.id === row.id);
            if (idx === -1) return [...prev, row];
            const copy = prev.slice();
            copy[idx] = row;
            return copy;
          });
        }
      )
      .subscribe();

    // safety refresh every 6s
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("teams")
        .select(
          "id, city_id, team_name, emp_code, emp_name, status, score, correct_count, tab_shifts, elapsed_seconds, submitted_at, created_at"
        );
      if (data) setTeams(data as Team[]);
    }, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [supabase]);

  const rows = useMemo(
    () => teams.filter((t) => t.city_id === cityId).sort(rankSort),
    [teams, cityId]
  );

  const cityName = cities.find((c) => c.id === cityId)?.name ?? "";

  function downloadCsv() {
    const header = [
      "Rank",
      "Team",
      "Emp Code",
      "Emp Name",
      "Status",
      "Points",
      "Correct",
      "Time",
      "Time (sec)",
      "Tab Shifts",
      "Submitted At",
    ];
    const lines = rows.map((t, i) =>
      [
        i + 1,
        t.team_name,
        t.emp_code,
        t.emp_name ?? "",
        t.status,
        t.score,
        t.correct_count,
        fmtTime(t.elapsed_seconds),
        t.elapsed_seconds,
        t.tab_shifts,
        t.submitted_at ?? "",
      ]
        .map((v) => {
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results-${cityName || "city"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!cities.length) {
    return <p className="text-sm text-slate-500">Create a city first to see its leaderboard.</p>;
  }

  return (
    <div>
      {/* controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">City:</label>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandorange"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
          </span>
        </div>
        <button
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="rounded-lg bg-brandgreen px-4 py-2 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
        >
          Download results (CSV)
        </button>
      </div>

      {/* table */}
      <div className="mt-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-4 py-3">Team</th>
                <th className="text-left px-4 py-3">Emp code</th>
                <th className="text-right px-4 py-3">Points</th>
                <th className="text-right px-4 py-3">Correct</th>
                <th className="text-right px-4 py-3">Time</th>
                <th className="text-right px-4 py-3">Tab shifts</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-t border-slate-100 ${i < 3 ? "bg-orange-50/40" : ""}`}
                >
                  <td className="px-4 py-3 font-bold text-slate-700">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.team_name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {t.emp_code}
                    {t.emp_name ? ` · ${t.emp_name}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-brandgreen">{t.score}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{t.correct_count}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {fmtTime(t.elapsed_seconds)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${
                      t.tab_shifts > 0 ? "text-red-500 font-medium" : "text-slate-400"
                    }`}
                  >
                    {t.tab_shifts}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        statusPill[t.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No teams registered for this city yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
