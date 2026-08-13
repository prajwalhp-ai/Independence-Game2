import { createServiceSupabase, getAdminEmail } from "@/lib/supabaseServer";
import AdminManager from "./AdminManager";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const svc = createServiceSupabase();
  const currentEmail = (await getAdminEmail()) || "";
  const { data: admins } = await svc
    .from("admins")
    .select("id, email, created_at")
    .order("created_at");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Admins</h1>
      <p className="text-sm text-slate-500 mt-1">
        People who can log in and manage the game.
      </p>
      <div className="mt-6">
        <AdminManager admins={admins ?? []} currentEmail={currentEmail} />
      </div>
    </div>
  );
}
