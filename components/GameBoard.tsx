"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import IndiaMap, { normState } from "./IndiaMap";

type Question = { order: number; image: string; question: string; answer: string };
type Session = { teamId: string; token: string; teamName: string; empName: string };
type City = { id: string; name: string; slug: string };

const POINTS_PER_CORRECT = 10;

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
  const [queue, setQueue] = useState<number[]>([]);
  const [correct, setCorrect] = useState<number[]>([]);
  const [tabShifts, setTabShifts] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [highlight, setHighlight] = useState<{ state: string; kind: "wrong" | "correct" } | null>(null);
  const [hoverState, setHoverState] = useState<string | null>(null);
  const [finished, setFinished] = useState(status === "stopped");

  const [drag, setDrag] = useState<{ order: number; x: number; y: number } | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const startMsRef = useRef<number>(0);
  const tabRef = useRef(0);
  const correctRef = useRef<number[]>([]);
  const elapsedRef = useRef(0);

  // load questions + restore progress
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/questions.json");
      const qs: Question[] = await res.json();
      if (!alive) return;
      setQuestions(qs);

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
      setQueue(qs.map((q) => q.order).filter((o) => !restored.includes(o)));
    })();
    return () => {
      alive = false;
    };
  }, [session.teamId, supabase]);

  // timer start (persisted)
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
    const saver = setInterval(() => saveProgress(), 4000);
    return () => {
      clearInterval(tick);
      clearInterval(saver);
    };
  }, [finished, saveProgress]);

  // tab-shift detection
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

  const doSubmit = useCallback(() => {
    elapsedRef.current = Math.floor((Date.now() - startMsRef.current) / 1000);
    supabase
      .rpc("submit_team", {
        p_team_id: session.teamId,
        p_token: session.token,
        p_elapsed: elapsedRef.current,
      })
      .then(() => setFinished(true));
  }, [session.teamId, session.token, supabase]);

  // react to admin STOP
  useEffect(() => {
    if (status === "stopped" && !finished) doSubmit();
  }, [status, finished, doSubmit]);

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
      (out[normState(q.answer)] ||= []).push(q.image);
    });
    return out;
  }, [correct, byOrder]);

  const frontOrder = queue[0];
  const frontQ = frontOrder != null ? byOrder[frontOrder] : null;

  function stateUnderPointer(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const stateEl = el?.closest("[data-state]") as HTMLElement | null;
    return stateEl?.getAttribute("data-state") || null;
  }

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
    setHoverState(stateUnderPointer(e.clientX, e.clientY));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const droppedOrder = drag.order;
    setDrag(null);
    setHoverState(null);

    const q = byOrder[droppedOrder];
    if (!q) return;

    const droppedState = stateUnderPointer(e.clientX, e.clientY);
    const isCorrect = droppedState && normState(droppedState) === normState(q.answer);

    if (isCorrect) {
      const next = [...correctRef.current, droppedOrder];
      correctRef.current = next;
      setCorrect(next);
      setQueue((qq) => qq.filter((o) => o !== droppedOrder));
      setHighlight({ state: q.answer, kind: "correct" });
      setTimeout(() => setHighlight(null), 700);
      saveProgress();
      if (next.length === questions.length) doSubmit();
    } else if (droppedState) {
      setHighlight({ state: droppedState, kind: "wrong" });
      setTimeout(() => setHighlight(null), 1200);
    }
  }

  function skip() {
    if (finished || frontOrder == null) return;
    setQueue((qq) => (qq.length <= 1 ? qq : [...qq.slice(1), qq[0]]));
  }

  function handleSubmitClick() {
    const left = queue.length;
    const msg =
      left > 0
        ? `Submit now? You still have ${left} card(s) left. You can't change answers after submitting.`
        : "Submit your answers?";
    if (confirm(msg)) doSubmit();
  }

  // ---------- SUMMARY ----------
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
              <div className="text-2xl font-bold text-brandgreen">{correct.length * POINTS_PER_CORRECT}</div>
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

  // ---------- PLAY ----------
  return (
    <div
      className="h-[100dvh] flex flex-col no-select overflow-hidden bg-slate-100"
      style={{ touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* top bar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-5 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.webp" alt="Orange Health" className="h-6 object-contain shrink-0" />
          <span className="hidden sm:inline text-sm font-medium text-slate-700 truncate">
            {session.teamName}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Stat label="Time" value={fmtTime(elapsed)} />
          <Stat label="Points" value={String(correct.length * POINTS_PER_CORRECT)} accent />
          <Stat label="Correct" value={`${correct.length}/${questions.length}`} />
          <Stat label="Tabs" value={String(tabShifts)} warn={tabShifts > 0} />
          <button
            onClick={handleSubmitClick}
            className="rounded-lg bg-brandgreen px-4 py-2 text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Submit
          </button>
        </div>
      </div>

      {/* main: map left, deck right */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* MAP (left) */}
        <div className="flex-1 min-h-0 order-2 lg:order-1 p-2">
          <IndiaMap filled={filled} highlight={highlight} hover={hoverState} className="w-full h-full" />
        </div>

        {/* DECK (right) */}
        <div className="order-1 lg:order-2 lg:w-[360px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 p-4 flex flex-col min-h-0">
          <p className="text-xs text-slate-500 mb-3 shrink-0">
            Drag the picture onto the correct state. The state lights up where it will land.
          </p>

          <div className="relative flex-1 min-h-0">
            {/* stacked deck shadows */}
            {queue.length > 2 && (
              <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-white/70 border border-slate-200" />
            )}
            {queue.length > 1 && (
              <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-2xl bg-white/85 border border-slate-200" />
            )}

            {/* front card */}
            {frontQ ? (
              <div className="relative h-full rounded-2xl bg-white border border-slate-200 shadow-lg flex flex-col overflow-hidden">
                <div className="p-4 shrink-0">
                  <p className="text-base sm:text-lg font-bold text-slate-800 leading-snug">
                    {frontQ.question}
                  </p>
                </div>
                <div className="flex-1 min-h-0 px-4">
                  <img
                    src={frontQ.image}
                    alt=""
                    draggable={false}
                    onPointerDown={(e) => onPointerDown(e, frontQ.order)}
                    className={`w-full h-full object-cover rounded-lg cursor-grab active:cursor-grabbing ${
                      drag?.order === frontQ.order ? "opacity-30" : ""
                    }`}
                    style={{ touchAction: "none" }}
                  />
                </div>
                <div className="p-4 shrink-0 flex items-center justify-between">
                  <button
                    onClick={skip}
                    className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition"
                  >
                    Skip ↻
                  </button>
                  <span className="text-xs text-slate-400">{queue.length} left</span>
                </div>
              </div>
            ) : (
              <div className="h-full rounded-2xl bg-white border border-slate-200 shadow-lg flex items-center justify-center">
                <p className="text-green-600 font-medium">All placed! Submitting…</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* floating drag clone */}
      {drag && byOrder[drag.order] && (
        <img
          src={byOrder[drag.order].image}
          alt=""
          className="fixed z-50 pointer-events-none rounded-lg shadow-2xl ring-2 ring-brandorange"
          style={{
            left: drag.x - dragOffset.current.dx,
            top: drag.y - dragOffset.current.dy,
            width: 200,
            height: 130,
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
      <div className={`text-sm font-bold ${accent ? "text-brandgreen" : warn ? "text-red-500" : "text-slate-800"}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
    </div>
  );
}
