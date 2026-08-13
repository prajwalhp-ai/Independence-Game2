"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAdmin, removeAdmin } from "./actions";

type Admin = { id: string; email: string; created_at: string };

export default function AdminManager({
  admins,
  currentEmail,
}: {
  admins: Admin[];
  currentEmail: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setMessage(null);
    startTransition(async () => {
      const res = await addAdmin(email);
      if (res.ok) {
        setMessage({ ok: true, text: "Admin added. They can log in and set a password." });
        setEmail("");
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error || "Failed." });
      }
    });
  }

  function handleRemove(id: string) {
    if (!confirm("Remove this admin?")) return;
    startTransition(async () => {
      const res = await removeAdmin(id);
      if (!res.ok) setMessage({ ok: false, text: res.error || "Failed." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800">Add an admin</h2>
        <p className="text-xs text-slate-500 mt-1">
          The person logs in at the admin login page and sets their own password on first login.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="name@orangehealth.in"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandorange"
          />
          <button
            onClick={handleAdd}
            disabled={isPending}
            className="rounded-lg bg-brandorange px-5 py-2 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Add admin"}
          </button>
        </div>
        {message && (
          <p className={`text-sm mt-2 ${message.ok ? "text-green-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 text-sm">Current admins</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 first:border-t-0">
                <td className="px-5 py-3">
                  {a.email}
                  {a.email.toLowerCase() === currentEmail.toLowerCase() && (
                    <span className="ml-2 text-xs text-slate-400">(you)</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleRemove(a.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
