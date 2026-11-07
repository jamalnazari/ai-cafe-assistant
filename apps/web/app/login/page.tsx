"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        setError(data?.detail ?? "ورود ناموفق بود؛ لطفاً دوباره تلاش کنید.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-sm border border-amber-100 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-800 text-amber-50 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">ورود مدیریت کافه</h1>
          <p className="text-xs text-slate-500">
            جهت ویرایش منو و دریافت کد QR وارد شوید
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-bold text-slate-700">
              ایمیل مدیر
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@cafe.com"
                autoComplete="username"
                maxLength={255}
                required
                dir="ltr"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pl-10 text-xs text-left focus:outline-none focus:ring-2 focus:ring-amber-800/20 text-slate-800"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-xs font-bold text-slate-700"
            >
              رمز عبور
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                maxLength={1024}
                required
                dir="ltr"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pl-10 text-xs text-left focus:outline-none focus:ring-2 focus:ring-amber-800/20 text-slate-800"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600 text-center font-bold">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 rounded-2xl text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? "در حال بررسی..." : "ورود به پنل مدیریت"}
          </button>
        </form>
      </div>
    </div>
  );
}
