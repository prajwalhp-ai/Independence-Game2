import { createServiceSupabase } from "@/lib/supabaseServer";
import EmployeeManager from "./EmployeeManager";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const svc = createServiceSupabase();
  const { data: employees } = await svc
    .from("employees")
    .select("id, empcode, name, email, department, location")
    .order("name");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
      <p className="text-sm text-slate-500 mt-1">
        One global list. Any employee code can join any city&apos;s game link.
      </p>
      <div className="mt-6">
        <EmployeeManager employees={employees ?? []} />
      </div>
    </div>
  );
}
