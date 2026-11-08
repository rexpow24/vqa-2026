"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Stratum = { event_label: string; difficulty: string; available: number; in_group: number };
type Person = {
  id: string; name: string; email: string; role: string; label: string | null; enabled: boolean;
  total: number; completed: number; agreement: number; agreement_completed: number; trained: boolean;
  ranges: string; agreement_ranges: string;
};
export type Overview = {
  annotators: Person[]; group_size: number; next_free_seq: number | null; unassigned: number; handed_out: boolean;
};
type Planned = { video_id: string; filename: string; event_label: string; difficulty: string };
type Part = { part: number; seq_from: number; seq_to: number; videos: number };
type Suggested = Part & { person: Person; result?: string };

/** "1-20, 25" -> [[1, 20], [25, 25]] */
function intervals(ranges: string): [number, number][] {
  return ranges.split(",").map((piece) => piece.trim()).filter(Boolean).map((piece) => {
    const [lo, hi = lo] = piece.split("-").map(Number);
    return [lo, hi];
  });
}

async function post<T>(action: string, body: object): Promise<T> {
  const response = await fetch(`/api/admin/assignments/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
  return result as T;
}

const DIFFICULTIES = ["easy", "medium", "high"];
const EVENTS = ["accident", "near-miss"];
const input = "rounded border border-border bg-background px-2 py-1.5 text-sm";
const button = "rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40";

export function AssignmentPanel({ overview, strata }: { overview: Overview; strata: Stratum[] }) {
  const router = useRouter();
  const people = overview.annotators.filter((person) => person.enabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [labelsFile, setLabelsFile] = useState<File | null>(null);
  const [size, setSize] = useState("60");
  const [plan, setPlan] = useState<Planned[] | null>(null);
  const [groupPeople, setGroupPeople] = useState<string[]>([]);
  const [roundSize, setRoundSize] = useState("20");
  const [round, setRound] = useState(0);
  // Trained annotators (not admins) share the videos nobody holds yet.
  const candidates = people.filter((person) => person.role !== "admin");
  const [splitPeople, setSplitPeople] = useState<string[]>(() => candidates.filter((person) => person.trained).map((person) => person.id));
  const [suggested, setSuggested] = useState<Suggested[] | null>(null);
  const [scope, setScope] = useState("agreement");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const start = overview.next_free_seq ?? 1;
  const [annotator, setAnnotator] = useState("");
  const [from, setFrom] = useState(String(start));
  const [to, setTo] = useState(String(start + 99));
  const [batch, setBatch] = useState("");
  // Follow the first free number after a refresh (a new group or a range
  // handed out moves it), adjusting state during render rather than in an effect.
  const [seenStart, setSeenStart] = useState(start);
  if (seenStart !== start) { setSeenStart(start); setFrom(String(start)); setTo(String(start + 99)); }

  async function run<T>(work: () => Promise<T>, describe: (result: T) => string) {
    setBusy(true); setError(""); setMessage("");
    try { setMessage(describe(await work())); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thực hiện được."); }
    finally { setBusy(false); }
  }
  const pool = strata.reduce((sum, row) => sum + Number(row.available), 0);
  const cell = (event: string, difficulty: string) => strata.find((row) => row.event_label === event && row.difficulty === difficulty);
  const planned = (event: string, difficulty: string) => plan?.filter((row) => row.event_label === event && row.difficulty === difficulty).length ?? 0;
  const perRound = Math.max(1, Math.floor(Number(roundSize)) || 1);
  const rounds = Array.from({ length: Math.ceil(overview.group_size / perRound) }, (_, index) =>
    ({ number: index + 1, from: index * perRound + 1, to: Math.min(overview.group_size, (index + 1) * perRound) }));
  const current = rounds[Math.min(round, rounds.length - 1)];
  const holders = (from: number, to: number) => overview.annotators.filter((person) =>
    intervals(person.agreement_ranges).some(([lo, hi]) => lo <= to && hi >= from)).map((person) => person.name);
  const exportHref = `/api/admin/answers/export?${new URLSearchParams({ scope,
    ...(exportFrom ? { from: exportFrom } : {}), ...(exportTo ? { to: exportTo } : {}) })}`;

  async function suggest() {
    const chosen = candidates.filter((person) => splitPeople.includes(person.id));
    await run(async () => {
      const parts = await post<Part[]>("split", { parts: chosen.length });
      setSuggested(parts.map((part, index) => ({ ...part, person: chosen[index] })));
      return parts;
    }, (parts) => `Đã chia ${parts.reduce((sum, part) => sum + part.videos, 0)} video chưa giao cho ${parts.length} người. Chưa giao: bấm Giao từng dòng.`);
  }
  async function assignSuggested(index: number) {
    const row = suggested![index];
    await run(() => post<{ assigned: number; skipped_taken: number; skipped_not_ready: number }>("range",
      { annotator_id: row.person.id, from: row.seq_from, to: row.seq_to, batch: `${row.seq_from}-${row.seq_to}` }),
    (result) => {
      const text = `Đã giao ${result.assigned} video (bỏ qua ${result.skipped_taken} đã giao, ${result.skipped_not_ready} chưa sẵn sàng)`;
      setSuggested((rows) => rows?.map((item, i) => i === index ? { ...item, result: text } : item) ?? null);
      return `${row.person.name}: ${text}.`;
    });
  }

  return <div className="flex flex-col gap-5">
    <dl className="grid gap-3 sm:grid-cols-3">
      {([["Video nhóm agreement", overview.group_size], ["Video thường chưa giao", overview.unassigned],
        ["Số nhỏ nhất còn trống", overview.next_free_seq ?? "-"]] as const).map(([name, value]) =>
        <div key={name} className="rounded-md border border-border bg-surface p-4">
          <dt className="text-xs text-muted">{name}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
        </div>)}
    </dl>
    {error && <p role="alert" className="rounded border border-red/40 bg-red/10 p-3 text-sm text-red">{error}</p>}
    {message && <p role="status" className="text-sm text-green">{message}</p>}

    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h3 className="font-medium">1. Nhãn tham chiếu (từ bước Review)</h3>
      <p className="text-xs text-muted">
        CSV từ <code>python -m scripts.export_labels_csv</code> (cột video_id, difficulty, event_label; nhãn theo từng shot). Mỗi người chạy trên máy có pipeline.db của mình rồi tải lên, hoặc tải một file đã gộp; tải lại sẽ ghi đè.
      </p>
      <div className="overflow-x-auto"><table className="text-sm tabular-nums">
        <thead className="text-xs text-muted"><tr><th className="pr-6 text-left font-normal">Video có nhãn</th>
          {DIFFICULTIES.map((difficulty) => <th key={difficulty} className="px-3 text-right font-normal">{difficulty}</th>)}</tr></thead>
        <tbody>{EVENTS.map((event) => <tr key={event}><td className="pr-6">{event}</td>
          {DIFFICULTIES.map((difficulty) => <td key={difficulty} className="px-3 text-right">{Number(cell(event, difficulty)?.available ?? 0)}</td>)}
        </tr>)}</tbody>
      </table></div>
      <p className="text-xs text-muted">Tổng {pool} video sẵn sàng có nhãn (đủ 9 bản nháp, đang mở).</p>
      <div className="flex flex-wrap items-end gap-3">
        <input type="file" accept=".csv,text/csv" aria-label="File nhãn tham chiếu" onChange={(event) => setLabelsFile(event.target.files?.[0] ?? null)} className="max-w-64 text-xs" />
        <button type="button" className={button} disabled={!labelsFile || busy} onClick={() => run(
          async () => post<{ saved: number; unknown: string[]; invalid: string[] }>("reference-labels", { csv: await labelsFile!.text() }),
          (result) => `Đã lưu ${result.saved} clip · ${result.unknown.length} không khớp video nào${result.unknown.length ? ` (vd. ${result.unknown.slice(0, 3).join(", ")})` : ""} · ${result.invalid.length} dòng sai giá trị.`)}>
          Tải nhãn lên</button>
      </div>
    </section>

    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h3 className="font-medium">2. Nhóm agreement</h3>
      <p className="text-xs text-muted">
        Lấy mẫu theo tỷ lệ event_label × difficulty; cùng nhãn tham chiếu, cùng số video thì luôn ra đúng các video đó, cùng thứ tự.
        Tạo nhóm sẽ đánh số lại: nhóm agreement là 1..N, xếp xen kẽ các loại nhãn để mỗi vòng (vd. 1-20, 21-40, 41-60) đều đủ loại; các video còn lại từ N+1 theo tên file.
        Chỉ làm được trước khi giao video theo khoảng.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Số video<input type="number" min={1} value={size} onChange={(event) => { setSize(event.target.value); setPlan(null); }} className={`${input} w-24`} /></label>
        <button type="button" className={button} disabled={busy || !pool} onClick={() => run(
          async () => { const result = await post<Planned[]>("plan", { size: Number(size) }); setPlan(result); return result; },
          (result) => `Xem trước ${result.length} video.`)}>Xem trước</button>
        <button type="button" className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40"
          disabled={busy || !plan || overview.handed_out} onClick={() => {
            if (!window.confirm(`Tạo nhóm agreement ${size} video và đánh số lại toàn bộ video?`)) return;
            void run(() => post<{ group_size: number }>("create-group", { size: Number(size) }),
              (result) => `Đã tạo nhóm ${result.group_size} video; nhóm là số 1-${result.group_size}.`);
          }}>Tạo nhóm</button>
        {overview.handed_out && <span className="text-xs text-amber">Đã có video giao theo khoảng nên không đổi nhóm được nữa.</span>}
      </div>
      {plan && <div className="overflow-x-auto"><table className="text-sm tabular-nums">
        <thead className="text-xs text-muted"><tr><th className="pr-6 text-left font-normal">Sẽ chọn</th>
          {DIFFICULTIES.map((difficulty) => <th key={difficulty} className="px-3 text-right font-normal">{difficulty}</th>)}</tr></thead>
        <tbody>{EVENTS.map((event) => <tr key={event}><td className="pr-6">{event}</td>
          {DIFFICULTIES.map((difficulty) => <td key={difficulty} className="px-3 text-right">{planned(event, difficulty)}</td>)}
        </tr>)}</tbody>
      </table></div>}
      {overview.group_size > 0 && <fieldset className="flex flex-col gap-3 border-t border-border pt-3">
        <legend className="sr-only">Giao theo vòng training</legend>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">Số video mỗi vòng<input type="number" min={1} value={roundSize}
            onChange={(event) => { setRoundSize(event.target.value); setRound(0); }} className={`${input} w-24`} /></label>
          <span className="pb-2 text-xs text-muted">{`${overview.group_size} video · ${rounds.length} vòng`}</span>
        </div>
        <div className="flex flex-col gap-1.5">{rounds.map((item, index) => {
          const names = holders(item.from, item.to);
          return <label key={item.from} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="radio" name="round" checked={current === item} onChange={() => setRound(index)} />
            <span className="w-16 font-medium">{`Vòng ${item.number}`}</span>
            <span className="w-20 tabular-nums text-muted">{`#${item.from}-${item.to}`}</span>
            <span className="text-xs text-muted">{names.length ? `Đã giao: ${names.join(", ")}` : "Chưa giao"}</span>
          </label>;
        })}</div>
        <div className="flex flex-wrap gap-3">{people.map((person) => <label key={person.id} className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={groupPeople.includes(person.id)} onChange={(event) => setGroupPeople(event.target.checked
            ? [...groupPeople, person.id] : groupPeople.filter((id) => id !== person.id))} />
          {person.name}{person.label ? <span className="text-xs text-muted">({person.label})</span> : null}
        </label>)}</div>
        {current && <button type="button" className={`${button} self-start`} disabled={busy || !groupPeople.length} onClick={() => run(
          () => post<{ assigned: number; videos: number }>("assign-group", { annotator_ids: groupPeople, from: current.from, to: current.to }),
          (result) => `Vòng ${current.number}: đã giao thêm ${result.assigned} lượt (${result.videos} video).`)}>
          {`Giao vòng ${current.number} (#${current.from}-${current.to}) cho ${groupPeople.length} người`}</button>}
      </fieldset>}
    </section>

    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h3 className="font-medium">3. Giao theo khoảng số</h3>
      <p className="text-xs text-muted">Mỗi video thường chỉ có 1 người. Video agreement, video đã giao cho người khác và video chưa đủ 9 bản nháp được bỏ qua. Gỡ chỉ gỡ video người đó chưa làm gì.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Người gán nhãn<select value={annotator} onChange={(event) => setAnnotator(event.target.value)} className={input}>
          <option value="">Chọn…</option>
          {people.map((person) => <option key={person.id} value={person.id}>{person.name}{person.label ? ` · ${person.label}` : ""}</option>)}
        </select></label>
        <label className="flex flex-col gap-1 text-sm">Từ số<input type="number" min={1} value={from} onChange={(event) => setFrom(event.target.value)} className={`${input} w-24`} /></label>
        <label className="flex flex-col gap-1 text-sm">Đến số<input type="number" min={1} value={to} onChange={(event) => setTo(event.target.value)} className={`${input} w-24`} /></label>
        <label className="flex flex-col gap-1 text-sm">Tên đợt<input value={batch} placeholder={`${from}-${to}`} maxLength={100} onChange={(event) => setBatch(event.target.value)} className={`${input} w-36`} /></label>
        <button type="button" className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40" disabled={busy || !annotator} onClick={() => run(
          () => post<{ assigned: number; skipped_agreement: number; skipped_taken: number; skipped_not_ready: number; already_mine: number }>(
            "range", { annotator_id: annotator, from: Number(from), to: Number(to), batch: batch || `${from}-${to}` }),
          (result) => `Đã giao ${result.assigned} video. Bỏ qua: ${result.skipped_agreement} agreement, ${result.skipped_taken} đã giao người khác, ${result.skipped_not_ready} chưa sẵn sàng, ${result.already_mine} đã có.`)}>
          Giao</button>
        <button type="button" className={button} disabled={busy || !annotator} onClick={() => run(
          () => post<{ removed: number; kept_started: number }>("unassign", { annotator_id: annotator, from: Number(from), to: Number(to) }),
          (result) => `Đã gỡ ${result.removed} video; giữ lại ${result.kept_started} video đã bắt đầu làm.`)}>Gỡ</button>
      </div>
      <fieldset className="flex flex-col gap-2 border-t border-border pt-3">
        <legend className="sr-only">Chia đều cho người đã training</legend>
        <p className="text-sm">{`Chia đều ${overview.unassigned} video chưa giao cho`}</p>
        <div className="flex flex-wrap gap-3">{candidates.map((person) => <label key={person.id} className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={splitPeople.includes(person.id)} onChange={(event) => { setSuggested(null); setSplitPeople(event.target.checked
            ? [...splitPeople, person.id] : splitPeople.filter((id) => id !== person.id)); }} />
          {person.name}{person.trained && <span className="rounded border border-green/50 px-1 text-xs text-green">trained</span>}
        </label>)}</div>
        <p className="text-xs text-muted">Mặc định chọn người đã vào nhóm agreement (trained), không tính admin. Tính khoảng chỉ gợi ý, chưa giao.</p>
        <button type="button" className={`${button} self-start`} disabled={busy || !splitPeople.length || !overview.unassigned} onClick={() => void suggest()}>
          Tính khoảng</button>
        {suggested && <table className="text-sm tabular-nums">
          <thead className="text-xs text-muted"><tr><th className="py-1 pr-4 text-left font-normal">Người</th>
            <th className="px-3 text-right font-normal">Từ số</th><th className="px-3 text-right font-normal">Đến số</th>
            <th className="px-3 text-right font-normal">Số video</th><th /></tr></thead>
          <tbody>{suggested.map((row, index) => <tr key={row.part} className="border-t border-border">
            <td className="py-1.5 pr-4">{row.person.name}</td>
            <td className="px-3 text-right">{row.seq_from}</td><td className="px-3 text-right">{row.seq_to}</td>
            <td className="px-3 text-right">{row.videos}</td>
            <td className="py-1.5 pl-3">{row.result ? <span className="text-xs text-green">{row.result}</span>
              : <button type="button" className={button} disabled={busy} onClick={() => void assignSuggested(index)}>Giao</button>}</td>
          </tr>)}</tbody>
        </table>}
      </fieldset>
    </section>

    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h3 className="font-medium">4. Xuất câu trả lời (CSV)</h3>
      <p className="text-xs text-muted">Mỗi dòng là một câu của một người: verdict, lý do, đáp án đã sửa (edited_answer) và đáp án người đó chốt (effective_answer). Dùng để tính độ đồng thuận.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Phạm vi<select value={scope} onChange={(event) => setScope(event.target.value)} className={input}>
          <option value="agreement">Nhóm agreement</option><option value="all">Tất cả video</option>
        </select></label>
        <label className="flex flex-col gap-1 text-sm">Từ số<input type="number" min={1} value={exportFrom} placeholder="1" onChange={(event) => setExportFrom(event.target.value)} className={`${input} w-24`} /></label>
        <label className="flex flex-col gap-1 text-sm">Đến số<input type="number" min={1} value={exportTo} placeholder="hết" onChange={(event) => setExportTo(event.target.value)} className={`${input} w-24`} /></label>
        <a href={exportHref} className="rounded bg-accent px-3 py-1.5 text-sm text-white">Tải CSV</a>
      </div>
    </section>

    <section className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs text-muted"><tr>
          <th className="p-3">Người</th><th className="p-3">Nhãn</th><th className="p-3">Khoảng đã giao</th>
          <th className="p-3 text-right">Agreement</th><th className="p-3 text-right">Hoàn thành</th>
        </tr></thead>
        <tbody>{overview.annotators.map((person) => <tr key={person.id} className="border-b border-border last:border-0">
          <td className="p-3">{person.name}<div className="text-xs text-muted">{person.email}{person.role === "admin" ? " · admin" : ""}{person.enabled ? "" : " · tạm khóa"}</div></td>
          <td className="p-3"><span className="flex flex-wrap items-center gap-1.5">
            {person.label ?? (person.trained ? null : <span className="text-muted">-</span>)}
            {person.trained && <span className="rounded border border-green/50 px-1 text-xs text-green">trained</span>}
          </span></td>
          <td className="p-3 tabular-nums">{person.ranges || <span className="text-muted">-</span>}</td>
          <td className="p-3 text-right tabular-nums">{person.agreement ? `#${person.agreement_ranges} · ${person.agreement_completed}/${person.agreement}` : <span className="text-muted">-</span>}</td>
          <td className="p-3 text-right tabular-nums">{person.completed}/{person.total}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </div>;
}
