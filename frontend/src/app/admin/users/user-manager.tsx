"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Role } from "@/lib/supabase/auth";

async function send(url: string, method: string, body: object) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Không thể lưu.");
  return result;
}

export function UserManager({ users, currentAdminId }: { users: Profile[]; currentAdminId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("annotator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setBusy(true); setError("");
    try {
      await send("/api/admin/users", "POST", { email, name, password, role });
      setEmail(""); setName(""); setPassword(""); setRole("annotator");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thêm người dùng.");
    } finally { setBusy(false); }
  }

  return <>
    <section className="rounded-md border border-border bg-surface p-4">
      <h3 className="mb-3 font-medium">Thêm người dùng</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5" /></label>
        <label className="flex flex-col gap-1 text-sm">Tên<input value={name} onChange={(event) => setName(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5" /></label>
        <label className="flex flex-col gap-1 text-sm">Mật khẩu ban đầu (ít nhất 4 ký tự)
          <span className="flex gap-2"><input type={showPassword ? "text" : "password"} minLength={4} value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5" />
            <button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((value) => !value)} className="rounded border border-border px-3">{showPassword ? "Ẩn" : "Hiện"}</button></span>
        </label>
        <label className="flex flex-col gap-1 text-sm">Vai trò<select value={role} onChange={(event) => setRole(event.target.value as Role)} className="rounded border border-border bg-background px-2 py-1.5"><option value="annotator">Người gán nhãn</option><option value="admin">Admin</option></select></label>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
      <button type="button" disabled={busy || !email || !name || password.length < 4} onClick={add} className="mt-3 rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40">Thêm</button>
    </section>
    <div className="flex flex-col gap-3">{users.map((user) => <UserRow key={user.id} user={user} currentAdminId={currentAdminId} />)}</div>
  </>;
}

function UserRow({ user, currentAdminId }: { user: Profile; currentAdminId: string }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [enabled, setEnabled] = useState(user.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      await send(`/api/admin/users/${user.id}`, "PATCH", { name, role, enabled });
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Xóa vĩnh viễn ${user.email} và toàn bộ nhãn của tài khoản này?`)) return;
    setBusy(true); setError("");
    try {
      await send(`/api/admin/users/${user.id}`, "DELETE", {});
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xóa người dùng."); }
    finally { setBusy(false); }
  }
  return <div className="rounded-md border border-border bg-surface p-4">
    <div className="mb-3 text-sm text-muted">{user.email}</div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">Tên<input value={name} onChange={(event) => setName(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5" /></label>
      <label className="flex flex-col gap-1 text-sm">Vai trò<select value={role} onChange={(event) => setRole(event.target.value as Role)} className="rounded border border-border bg-background px-2 py-1.5"><option value="annotator">Người gán nhãn</option><option value="admin">Admin</option></select></label>
      <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Được truy cập</label>
      <button type="button" disabled={busy || !name.trim()} onClick={save} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40">Lưu</button>
      {user.id !== currentAdminId && <button type="button" disabled={busy} onClick={remove} className="rounded border border-red/40 px-3 py-1.5 text-sm text-red disabled:opacity-40">Xóa người dùng</button>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
  </div>;
}
