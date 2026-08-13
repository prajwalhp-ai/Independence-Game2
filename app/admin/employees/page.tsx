import { createServiceSupabase } from "@/lib/supabaseServer";
import EmployeeManager from "./EmployeeManager";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const svc = createServiceSupabase();
  const [{ data: cities }, { data: employees }] = await Promise.all([
    svc.from("cities").select("id, name, slug").order("name"),
    svc
      .from("employees")
      .select("id, empcode, name, email, department, location, city_id")
      .order("name"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
      <p className="text-sm text-slate-500 mt-1">
        Add the employee list per city. A team registers using any one employee&apos;s code from
        their city.
      </p>
      <div className="mt-6">
        <EmployeeManager cities={cities ?? []} employees={employees ?? []} />
      </div>
    </div>
  );
}
