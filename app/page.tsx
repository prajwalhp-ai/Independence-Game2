import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 via-white to-green-50 px-6">
      <div className="text-center max-w-xl">
        <img
          src="/logo.webp"
          alt="Orange Health Labs"
          className="h-14 mx-auto mb-8 object-contain"
        />
        <div className="inline-block mb-4 text-4xl">🇮🇳</div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
          Independence Day Game
        </h1>
        <p className="mt-3 text-lg text-slate-600">Match the States of India</p>
        <p className="mt-6 text-sm text-slate-500">
          Have a game link from your HR? Open it to join your team.
        </p>

        <div className="mt-10">
          <Link
            href="/admin/login"
            className="inline-block rounded-lg bg-brandorange px-6 py-3 text-white font-medium shadow hover:opacity-90 transition"
          >
            Admin Login
          </Link>
        </div>
      </div>

      <footer className="mt-16 text-xs text-slate-400">
        © {new Date().getFullYear()} Orange Health Labs
      </footer>
    </main>
  );
}
