"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function AdminLoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      // Step 1: verify allowlist + create account on first login
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const out = await res.json();
      if (!out.ok) {
        setError(out.error || "Login failed.");
        setLoading(false);
        return;
      }

      // Step 2: sign in (this writes the session cookie)
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) {
        setError(
          signErr.message.includes("Invalid")
            ? "Wrong password for this admin account."
            : signErr.message
        );
        setLoading(false);
        return;
      }

      // Step 3: hard navigation so the server reads the fresh cookie
      window.location.href = "/admin";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <img
          src="/logo.webp"
          alt="Orange Health Labs"
          className="h-9 mx-auto mb-6 object-contain"
        />
        <h1 className="text-xl font-semibold text-center text-slate-900">
          Admin Login
        </h1>
        <p className="text-center text-xs text-slate-500 mt-1">
          First time? Enter your email and choose a password.
        </p>

        <div className="mt-6 space-y-3">
          <input
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandorange"
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandorange"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-lg bg-brandorange py-2.5 text-white font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Please wait…" : "Login"}
          </button>
        </div>
      </div>
    </main>
  );
}
