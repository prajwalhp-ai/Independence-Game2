import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const svc = createServiceSupabase();

  const [{ count: cityCount }, { count: empCount }, { count: teamCount }] =
    await Promise.all([
      svc.from("cities").select("*", { count: "exact", head: true }),
      svc.from("employees").select("*", { count: "exact", head: true }),
      svc.from("teams").select("*", { count: "exact", head: true }),
    ]);

  const cards = [
    { label: "Cities", value: cityCount ?? 0, href: "/admin/cities" },
    { label: "Employees", value: empCount ?? 0, href: "/admin/employees" },
    { label: "Teams registered", value: teamCount ?? 0, href: "/admin/leaderboard" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="text-sm text-slate-500 mt-1">
        Set up cities, add employees, then start the game and watch the live leaderboard.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition"
          >
            <div className="text-3xl font-bold text-slate-900">{c.value}</div>
            <div className="text-sm text-slate-500 mt-1">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800">Quick start</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-600 list-decimal list-inside">
          <li>
            Go to <Link href="/admin/cities" className="text-brandorange underline">Cities</Link> and
            create a city — you'll get a shareable game link.
          </li>
          <li>
            Go to <Link href="/admin/employees" className="text-brandorange underline">Employees</Link> and
            upload the employee list for each city.
          </li>
          <li>Share the city link with teams. They register and wait.</li>
          <li>
            When ready, open{" "}
            <Link href="/admin/cities" className="text-brandorange underline">Cities</Link> and press{" "}
            <span className="font-medium">Start</span> for that city.
          </li>
          <li>
            Watch{" "}
            <Link href="/admin/leaderboard" className="text-brandorange underline">Leaderboard</Link>{" "}
            live, then press <span className="font-medium">Stop</span> to submit everyone.
          </li>
        </ol>
      </div>
    </div>
  );
}
