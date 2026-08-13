"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import IndiaMap, { normState } from "./IndiaMap";

type Question = { order: number; image: string; question: string; answer: string };
type Session = { teamId: string; token: string; teamName: string; empName: string };
type City = { id: string; name: string; slug: string };

const POINTS_PER_CORRECT = 10;
const VISIBLE = 3; // how many cards are draggable at once

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function GameBoard({
  city,
  session,
  status,
}: {
  city: City;
  session: Session;
  status: string;
}) {
  const supabase = createClient();
  const startKey = `idgame:${city.slug}:start`;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [queue, setQueue] = useState<number[]>([]);          // question orders still to place
  const [correct, setCorrect] = useState<number[]>([]);      // orders placed correctly
  const [tabShifts, setTabShifts] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [highlight, setHighlight] = useState<{ state: string; kind: "wrong" | "correct" } | null>(null);
  const [finished, setFinished] = useState(status === "stopped");

  // drag state (the floating card that follows the pointer)
  const [drag, setDrag] = useState<{ order: number; x: number; y: number } | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const startMsRef = useRef<number>(0);
  const tabRef = useRef(0);
  const correctRef = useRef<number[]>([]);
  const elapsedRef = useRef(0);

  // ---- load questions + restore any prior progress ----
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/questions.json");
      const qs: Question[] = await res.json();
      if (!alive) return;
      setQuestions(qs);

      // restore prior correct answers (survives refresh)
      let restored: number[] = [];
      try {
        const { data } = await supabase
          .from("teams")
          .select("placed, tab_shifts")
          .eq("id", session.teamId)
          .maybeSingle();
        if (data?.placed && Array.isArray(data.placed)) restored = data.placed as number[];
        if (typeof data?.tab_shifts === "number") {
          setTabShifts(data.tab_shifts);
          tabRef.current = data.tab_shifts;
        }
      } catch {
        /* ignore */
      }
      setCorrect(restored);
      correctRef.current = restored;
      const remaining = qs.map((q) => q.order).filter((o) => !restored.includes(o));
      setQueue(remaining);
    })();
    return () => {
      alive = false;
    };
  }, [session.teamId, supabase]);

  // ---- timer start (persisted so refresh doesn't reset it) ----
  useEffect(() => {
    let start = 0;
    try {
      const saved = localStorage.getItem(startKey);
      start = saved ? parseInt(saved, 10) : 0;
    } catch {
      /* ignore */
    }
    if (!start) {
      start = Date.now();
      try {
        localStorage.setItem(startKey, String(start));
      } catch {
        /* ignore */
      }
    }
    startMsRef.current = start;
  }, [startKey]);

  // ---- tick + periodic save ----
  const saveProgress = useCallback(async () => {
    await supabase.rpc("update_team_progress", {
      p_team_id: session.teamId,
      p_token: session.token,
      p_score: correctRef.current.length * POINTS_PER_CORRECT,
      p_correct: correctRef.current.length,
      p_placed: correctRef.current,
      p_tab_shifts: tabRef.current,
      p_elapsed: elapsedRef.current,
    });
  }, [session.teamId, session.token, supabase]);

  useEffect(() => {
    if (finished) return;
    const tick = setInterval(() => {
      const e = Math.floor((Date.now() - startMsRef.current) / 1000);
      elapsedRef.current = e;
      setElapsed(e);
    }, 1000);
    const saver = setInterval(() => {
      saveProgress();
    }, 4000);
    return () => {
      clearInterval(tick);
      clearInterval(saver);
    };
  }, [finished, saveProgress]);

  // ---- tab-shift detection ----
  useEffect(() => {
    if (finished) return;
    const bump = () => {
      tabRef.current += 1;
      setTabShifts(tabRef.current);
      saveProgress();
    };
    const onVis = () => {
      if (document.hidden) bump();
    };
    window.addEventListener("blur", bump);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [finished, saveProgress]);

  // ---- react to admin STOP ----
  useEffect(() => {
    if (status === "stopped" && !finished) {
      elapsedRef.current = Math.floor((Date.now() - startMsRef.current) / 1000);
      supabase
        .rpc("submit_team", {
          p_team_id: session.teamId,
          p_token: session.token,
          p_elapsed: elapsedRef.current,
        })
        .then(() => setFinished(true));
    }
  }, [status, finished, session.teamId, session.token, supabase]);

  // ---- derived: filled map (normalized state -> image urls) ----
  const byOrder = useMemo(() => {
    const m: Record<number, Question> = {};
    questions.forEach((q) => (m[q.order] = q));
    return m;
  }, [questions]);

  const filled = useMemo(() => {
    const out: Record<string, string[]> = {};
    correct.forEach((o) => {
      const q = byOrder[o];
      if (!q) return;
      const key = normState(q.answer);
      (out[key] ||= []).push(q.image);
    });
    return out;
  }, [correct, byOrder]);

  const visibleOrders = queue.slice(0, VISIBLE);

  // ---- drag handlers ----
  function onPointerDown(e: React.PointerEvent, order: number) {
    if (finished) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setDrag({ order, x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const droppedOrder = drag.order;
    setDrag(null);

    const q = byOrder[droppedOrder];
    if (!q) return;

    // find which state is under the pointer
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const stateEl = el?.closest("[data-state]") as HTMLElement | null;
    const droppedState = stateEl?.getAttribute("data-state") || "";

    const isCorrect = droppedState && normState(droppedState) === normState(q.answer);

    if (isCorrect) {
      // add to filled + flash green
      const next = [...correctRef.current, droppedOrder];
      correctRef.current = next;
      setCorrect(next);
      setQueue((qq) => qq.filter((o) => o !== droppedOrder));
      setHighlight({ state: q.answer, kind: "correct" });
      setTimeout(() => setHighlight(null), 700);
      saveProgress();

      if (next.length === questions.length) {
        // all placed → auto submit
        elapsedRef.current = Math.floor((Date.now() - startMsRef.current) / 1000);
        supabase
          .rpc("submit_team", {
            p_team_id: session.teamId,
            p_token: session.token,
            p_elapsed: elapsedRef.current,
          })
          .then(() => setFinished(true));
      }
    } else if (droppedState) {
      // wrong state → flash it red; card returns to its place (no queue change)
      setHighlight({ state: droppedState, kind: "wrong" });
      setTimeout(() => setHighlight(null), 1200);
    }
    // dropped outside the map → nothing happens, card just returns
  }

  function skip(order: number) {
    if (finished) return;
    setQueue((qq) => {
      const rest = qq.filter((o) => o !== order);
      return [...rest, order]; // send to the back
    });
  }

  // ---------- FINISHED / SUMMARY SCREEN ----------
  if (finished) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ backgroundImage: "url('/background.png')", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="w-full max-w-md bg-white/92 backdrop-blur rounded-2xl shadow-xl p-8 text-center">
          <img src="/logo.webp" alt="Orange Health" className="h-8 mx-auto mb-4 object-contain" />
          <div className="text-4xl">🎉</div>
          <h2 className="text-2xl font-bold text-slate-900 mt-2">Submitted!</h2>
          <p className="text-slate-500 mt-1">Team {session.teamName}</p>
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-brandgreen">
                {correct.length * POINTS_PER_CORRECT}
              </div>
              <div className="text-xs text-slate-500">Points</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-slate-800">{correct.length}/{questions.length}</div>
              <div className="text-xs text-slate-500">Correct</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-slate-800">{fmtTime(elapsed)}</div>
              <div className="text-xs text-slate-500">Time</div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-6">Check the big screen for the leaderboard.</p>
        </div>
      </div>
    );
  }

  // ---------- PLAY SCREEN ----------
  return (
    <div
      className="min-h-screen flex flex-col no-select"
      style={{ touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.webp" alt="Orange Health" className="h-6 object-contain" />
          <span className="hidden sm:inline text-sm font-medium text-slate-700">
            {session.teamName}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Stat label="Time" value={fmtTime(elapsed)} />
          <Stat label="Points" value={String(correct.length * POINTS_PER_CORRECT)} accent />
          <Stat label="Left" value={String(queue.length)} />
          <Stat label="Tab shifts" value={String(tabShifts)} warn={tabShifts > 0} />
        </div>
      </div>

      {/* main */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* cards panel */}
        <div className="lg:w-[340px] shrink-0 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto">
          <p className="text-xs text-slate-500 mb-3">
            Drag each card onto the correct state. Wrong drops flash red; correct drops fill the state.
          </p>
          <div className="space-y-4">
            {visibleOrders.map((order) => {
              const q = byOrder[order];
              if (!q) return null;
              const isDragging = drag?.order === order;
              return (
                <div
                  key={order}
                  className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition ${
                    isDragging ? "opacity-30" : ""
                  }`}
                >
                  <img
                    src={q.image}
                    alt=""
                    draggable={false}
                    onPointerDown={(e) => onPointerDown(e, order)}
                    className="w-full h-36 object-cover cursor-grab active:cursor-grabbing"
                    style={{ touchAction: "none" }}
                  />
                  <div className="p-3">
                    <p className="text-xs text-slate-700 leading-snug">{q.question}</p>
                    <button
                      onClick={() => skip(order)}
                      className="mt-2 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Skip ↻
                    </button>
                  </div>
                </div>
              );
            })}
            {queue.length === 0 && (
              <p className="text-sm text-green-600 font-medium">All placed! Submitting…</p>
            )}
          </div>
        </div>

        {/* map */}
        <div className="flex-1 bg-gradient-to-b from-white to-slate-100 p-2 overflow-hidden">
          <IndiaMap filled={filled} highlight={highlight} className="w-full h-full" />
        </div>
      </div>

      {/* floating drag clone */}
      {drag && byOrder[drag.order] && (
        <img
          src={byOrder[drag.order].image}
          alt=""
          className="fixed z-50 pointer-events-none rounded-lg shadow-2xl"
          style={{
            left: drag.x - dragOffset.current.dx,
            top: drag.y - dragOffset.current.dy,
            width: 180,
            height: 120,
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="text-center leading-tight">
      <div
        className={`font-bold ${
          accent ? "text-brandgreen" : warn ? "text-red-500" : "text-slate-800"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
    </div>
  );
}
