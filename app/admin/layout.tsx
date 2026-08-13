import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminEmail } from "@/lib/supabaseServer";
import LogoutButton from "./LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await getAdminEmail();
  if (!email) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img src="/logo.webp" alt="Orange Health" className="h-6 object-contain" />
            <nav className="hidden sm:flex items-center gap-5 text-sm">
              <Link href="/admin" className="text-slate-600 hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/admin/cities" className="text-slate-600 hover:text-slate-900">
                Cities
              </Link>
              <Link href="/admin/employees" className="text-slate-600 hover:text-slate-900">
                Employees
              </Link>
              <Link href="/admin/leaderboard" className="text-slate-600 hover:text-slate-900">
                Leaderboard
              </Link>
              <Link href="/admin/admins" className="text-slate-600 hover:text-slate-900">
                Admins
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-400">{email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
