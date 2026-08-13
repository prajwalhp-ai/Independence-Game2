"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { addEmployees, deleteEmployee, clearCityEmployees } from "./actions";

type City = { id: string; name: string; slug: string };
type Employee = {
  id: string;
  empcode: string;
  name: string;
  email: string | null;
  department: string | null;
  location: string | null;
  city_id: string | null;
};

type ParsedRow = {
  empcode: string;
  name: string;
  email?: string;
  department?: string;
  location?: string;
};

function normalizeRow(obj: Record<string, string>): ParsedRow | null {
  // accept flexible header names / casing
  const lower: Record<string, string> = {};
  for (const k of Object.keys(obj)) lower[k.trim().toLowerCase()] = obj[k];
  const empcode = lower["empcode"] || lower["emp code"] || lower["code"] || "";
  const name = lower["name"] || lower["employee name"] || "";
  if (!empcode.trim() && !name.trim()) return null;
  return {
    empcode: empcode.trim(),
    name: name.trim(),
    email: (lower["email"] || "").trim(),
    department: (lower["department"] || lower["dept"] || "").trim(),
    location: (lower["location"] || lower["city"] || "").trim(),
  };
}

export default function EmployeeManager({
  cities,
  employees,
}: {
  cities: City[];
  employees: Employee[];
}) {
  const router = useRouter();
  const [cityId, setCityId] = useState<string>(cities[0]?.id ?? "");
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const cityEmployees = useMemo(
    () => employees.filter((e) => e.city_id === cityId),
    [employees, cityId]
  );

  function parsePaste(text: string): ParsedRow[] {
    // supports comma OR tab separated (paste from Excel = tabs)
    const parsed = Papa.parse<Record<string, string>>(text.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    const rows: ParsedRow[] = [];
    for (const r of parsed.data) {
      const n = normalizeRow(r as Record<string, string>);
      if (n) rows.push(n);
    }
    return rows;
  }

  function submitRows(rows: ParsedRow[]) {
    if (!cityId) {
      setMessage({ ok: false, text: "Select a city first." });
      return;
    }
    if (!rows.length) {
      setMessage({ ok: false, text: "No valid rows found. Need at least empcode and name." });
      return;
    }
    startTransition(async () => {
      const res = await addEmployees(cityId, rows);
      if (res.ok) {
        setMessage({ ok: true, text: `Saved ${res.added} employee(s).` });
        setPasteText("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error || "Failed to save." });
      }
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const rows: ParsedRow[] = [];
        for (const r of res.data) {
          const n = normalizeRow(r as Record<string, string>);
          if (n) rows.push(n);
        }
        submitRows(rows);
      },
    });
    e.target.value = "";
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteEmployee(id);
      router.refresh();
    });
  }

  function clearAll() {
    if (!cityId) return;
    if (!confirm("Remove ALL employees for this city?")) return;
    startTransition(async () => {
      await clearCityEmployees(cityId);
      router.refresh();
    });
  }

  if (!cities.length) {
    return (
      <p className="text-sm text-slate-500">
        Create a city first on the Cities page, then add employees here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* city selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600">City:</label>
        <select
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandorange"
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          {cityEmployees.length} employee(s) in this city
        </span>
      </div>

      {/* upload / paste */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">Add employees</h2>
          <p className="text-xs text-slate-500 mt-1">
            Columns: <code>empcode, name, email, department, location</code> — empcode and name are
            required. Re-uploading an empcode updates that person.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Upload CSV</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brandorange file:px-4 file:py-2 file:text-white file:text-sm hover:file:opacity-90"
          />
        </div>

        <div className="text-center text-xs text-slate-400">— or paste from Excel —</div>

        <div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder={"empcode,name,email,department,location\nE101,Asha,asha@x.com,Ops,Bengaluru\nE102,Ravi,ravi@x.com,Sales,Bengaluru"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brandorange"
          />
          <button
            onClick={() => submitRows(parsePaste(pasteText))}
            disabled={isPending}
            className="mt-2 rounded-lg bg-brandorange px-5 py-2 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Add pasted rows"}
          </button>
        </div>

        {message && (
          <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* current list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 text-sm">Employees in this city</h3>
          {cityEmployees.length > 0 && (
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">
              Clear all
            </button>
          )}
        </div>
        {cityEmployees.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No employees added for this city yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-2">Emp code</th>
                  <th className="text-left px-5 py-2">Name</th>
                  <th className="text-left px-5 py-2">Email</th>
                  <th className="text-left px-5 py-2">Department</th>
                  <th className="text-left px-5 py-2">Location</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {cityEmployees.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-5 py-2 font-medium text-slate-800">{e.empcode}</td>
                    <td className="px-5 py-2">{e.name}</td>
                    <td className="px-5 py-2 text-slate-500">{e.email || "—"}</td>
                    <td className="px-5 py-2 text-slate-500">{e.department || "—"}</td>
                    <td className="px-5 py-2 text-slate-500">{e.location || "—"}</td>
                    <td className="px-5 py-2 text-right">
                      <button
                        onClick={() => remove(e.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
