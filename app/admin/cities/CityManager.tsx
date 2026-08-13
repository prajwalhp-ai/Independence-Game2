"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCity, setCityStatus, deleteCity } from "./actions";

type City = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-700",
  running: "bg-green-100 text-green-700",
  stopped: "bg-slate-200 text-slate-600",
};

export default function CityManager({ cities }: { cities: City[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCreate() {
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    const res = await createCity(fd);
    if (res?.ok === false) {
      setError(res.error || "Could not create city.");
      return;
    }
    setName("");
    router.refresh();
  }

  function linkFor(slug: string) {
    if (typeof window === "undefined") return `/play/${slug}`;
    return `${window.location.origin}/play/${slug}`;
  }

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(linkFor(slug));
      setCopied(slug);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — user can copy manually */
    }
  }

  function changeStatus(id: string, status: "waiting" | "running" | "stopped") {
    startTransition(async () => {
      await setCityStatus(id, status);
      router.refresh();
    });
  }

  function remove(id: string, cityName: string) {
    if (!confirm(`Delete "${cityName}"? This also removes its teams and results.`)) return;
    startTransition(async () => {
      await deleteCity(id);
      router.refresh();
    });
  }

  return (
    <div>
      {/* create form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800">Add a city</h2>
        <div className="mt-3 flex flex-col sm:flex-row gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="City name (e.g. Bengaluru)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandorange"
          />
          <button
            onClick={handleCreate}
            className="rounded-lg bg-brandorange px-5 py-2 text-white text-sm font-medium hover:opacity-90 transition"
          >
            Create city
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* list */}
      <div className="mt-6 space-y-3">
        {cities.length === 0 && (
          <p className="text-sm text-slate-500">No cities yet. Create one above.</p>
        )}

        {cities.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900">{c.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    statusStyle[c.status] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <button
                onClick={() => remove(c.id, c.name)}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>

            {/* game link */}
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={linkFor(c.slug)}
                className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600"
              />
              <button
                onClick={() => copy(c.slug)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 transition whitespace-nowrap"
              >
                {copied === c.slug ? "Copied!" : "Copy link"}
              </button>
            </div>

            {/* controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeStatus(c.id, "running")}
                disabled={isPending || c.status === "running"}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                Start
              </button>
              <button
                onClick={() => changeStatus(c.id, "stopped")}
                disabled={isPending || c.status !== "running"}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                Stop
              </button>
              <button
                onClick={() => changeStatus(c.id, "waiting")}
                disabled={isPending || c.status === "waiting"}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-100 transition disabled:opacity-40"
              >
                Reset
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
