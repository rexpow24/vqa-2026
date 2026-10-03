"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        await supabase.auth.signOut();
        throw new Error("Tài khoản chưa được cấp quyền hoặc đã bị vô hiệu hóa.");
      }
      const data = await res.json() as { role: "admin" | "annotator" };
      router.replace(data.role === "admin" ? "/admin" : "/annotate");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="flex flex-col gap-4">
    <label className="flex flex-col gap-1 text-sm">Email
      <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded border border-border bg-background px-3 py-2" />
    </label>
    <label className="flex flex-col gap-1 text-sm">Mật khẩu
      <span className="flex gap-2"><input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2" />
        <button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((value) => !value)} className="rounded border border-border px-3">{showPassword ? "Ẩn" : "Hiện"}</button></span>
    </label>
    {error && <p role="alert" className="text-sm text-red">{error}</p>}
    <button disabled={busy} className="rounded bg-accent px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
  </form>;
}
