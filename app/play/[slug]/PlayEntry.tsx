"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import GameBoard from "@/components/GameBoard";

type City = { id: string; name: string; slug: string; status: string };
type Session = { teamId: string; token: string; teamName: string; empName: string };

const ERR_TEXT: Record<string, string> = {
  EMP_NOT_FOUND: "That employee code was not found for this city. Please check and try again.",
  GAME_STOPPED: "This game has already ended.",
  CITY_NOT_FOUND: "This game link is invalid.",
};

export default function PlayEntry({ city }: { city: City }) {
  const supabase = createClient();
  const storageKey = `idgame:${city.slug}`;

  const [status, setStatus] = useState<string>(city.status);
  const [session, setSession] = useState<Session | null>(null);
  const [teamName, setTeamName] = useState("");
  const [empCode, setEmpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    const channel = supabase
      .channel(`city-${city.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cities", filter: `id=eq.${city.id}` },
        (payload: { new: { status?: string } }) => {
          if (payload.new?.status) setStatus(payload.new.status);
        }
      )
      .subscribe();

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("cities")
        .select("status")
        .eq("id", city.id)
        .maybeSingle();
      if (data?.status) setStatus(data.status);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [city.id, supabase]);

  async function handleRegister() {
    setError(null);
    if (!teamName.trim() || !empCode.trim()) {
      setError("Please enter both a team name and an employee code.");
      return;
    }
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc("register_team", {
      p_slug: city.slug,
      p_team_name: teamName.trim(),
      p_empcode: empCode.trim(),
    });
    setLoading(false);

    if (rpcErr) {
      const key = Object.keys(ERR_TEXT).find((k) => rpcErr.message.includes(k));
      setError(key ? ERR_TEXT[key] : "Could not register. Please try again.");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setError("Could not register. Please try again.");
      return;
    }
    const s: Session = {
      teamId: row.team_id,
      token: row.token,
      teamName: teamName.trim(),
      empName: row.emp_name,
    };
    localStorage.setItem(storageKey, JSON.stringify(s));
    setSession(s);
  }

  const bg = {
    backgroundImage: "url('/background.png')",
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundColor: "#1a1a1a",
  } as const;

  if (!ready) {
    return <div style={bg} className="min-h-screen" />;
  }

  // Playing (or finished) → hand off to the game board
  if (session && (status === "running" || status === "stopped")) {
    return <GameBoard city={city} session={session} status={status} />;
  }

  // Registered, waiting for HR
  if (session && status === "waiting") {
    return (
      <div style={bg} className="min-h-screen flex items-center justify-end px-6 sm:px-16">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur rounded-2xl shadow-xl p-8 text-center">
          <img src="/logo.webp" alt="Orange Health" className="h-8 mx-auto mb-5 object-contain" />
          <div className="animate-pulse text-2xl">⏳</div>
          <p className="text-lg font-semibold text-slate-800 mt-2">Waiting for HR to start…</p>
          <p className="text-sm text-slate-500 mt-1">
            Team <span className="font-medium">{session.teamName}</span> is ready.
          </p>
          <p className="text-xs text-slate-400 mt-4">Keep this tab open. The game will begin automatically.</p>
        </div>
      </div>
    );
  }

  // Not registered, game already ended
  if (!session && status === "stopped") {
    return (
      <div style={bg} className="min-h-screen flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur rounded-2xl px-8 py-6 text-center">
          <p className="text-lg font-semibold text-slate-800">This game has ended.</p>
        </div>
      </div>
    );
  }

  // Registration form (right side)
  return (
    <div style={bg} className="min-h-screen flex items-center justify-end px-6 sm:px-16">
      <div className="w-full max-w-sm bg-white/90 backdrop-blur rounded-2xl shadow-xl p-8">
        <img src="/logo.webp" alt="Orange Health" className="h-8 mx-auto mb-5 object-contain" />
        <h1 className="text-xl font-bold text-center text-slate-900">Match the States</h1>
        <p className="text-center text-xs text-slate-500 mt-1">
          {city.name} · Independence Day Game
        </p>

        <div className="mt-6 space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Team name</label>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. The Tricolours"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandorange"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Employee code (any one member)</label>
            <input
              value={empCode}
              onChange={(e) => setEmpCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              placeholder="e.g. E101"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandorange"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full rounded-lg bg-brandorange py-2.5 text-white font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Joining…" : "Join game"}
          </button>
        </div>
      </div>
    </div>
  );
}
