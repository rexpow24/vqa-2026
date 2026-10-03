"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { PromptRegistry, PromptVersion } from "@/lib/types";

// The prompt inventory, read-only.
//
// Text comes from `prompt_versions` in annotations.db -- what was actually sent
// -- not from vlm/prompts.py, which only ever holds the current wording. Editing
// a prompt would otherwise erase the older one, and with it any way to read what
// produced the older drafts.

/** Everything before "Câu hỏi: " is the shared preamble for that version. */
function splitPrompt(text: string): { preamble: string; question: string } {
  const i = text.lastIndexOf("Câu hỏi:");
  if (i < 0) return { preamble: text, question: "" };
  return {
    preamble: text.slice(0, i + "Câu hỏi:".length),
    question: text.slice(i + "Câu hỏi:".length).trim(),
  };
}

export default function PromptsPage() {
  const [reg, setReg] = useState<PromptRegistry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"draft" | "judge">("draft");
  const [picked, setPicked] = useState<number | null>(null);
  const [compare, setCompare] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<PromptRegistry>("/prompts")
      .then((r) => {
        setReg(r);
        const vs = [...new Set(r.versions.map((v) => v.prompt_version))].sort(
          (a, b) => b - a,
        );
        setPicked(vs[0] ?? r.draft.version);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const allVersions = useMemo(
    () =>
      reg
        ? [...new Set(reg.versions.map((v) => v.prompt_version))].sort((a, b) => b - a)
        : [],
    [reg],
  );

  if (error) return <p className="text-sm text-red">{error}</p>;
  if (!reg || picked === null) return <p className="text-sm text-muted">Đang tải…</p>;

  const rowsOf = (v: number) => reg.versions.filter((x) => x.prompt_version === v);
  const current = rowsOf(picked);
  const other = compare !== null ? rowsOf(compare) : [];

  const preambleOf = (rows: PromptVersion[]) =>
    rows.length ? splitPrompt(rows[0].prompt_text).preamble : reg.draft.preamble;

  const statOf = (v: number, g: string) =>
    reg.usage.find((u) => u.prompt_version === v && u.qgroup === g);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["draft", `Prompt tạo nhãn (${reg.draft.groups.length})`],
            ["judge", `Prompt chấm điểm (${reg.judge.rubrics.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === k
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "draft" ? (
        <>
          {/* version picker */}
          <div className="flex flex-wrap items-end gap-4 rounded-md border border-border bg-surface px-4 py-3">
            <code className="pb-1.5 text-sm text-foreground">{reg.draft.name}</code>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Phiên bản</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={picked}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPicked(v);
                  if (compare === v) setCompare(null);
                }}
              >
                {allVersions.map((v) => (
                  <option key={v} value={v}>
                    v{v}
                    {v === reg.draft.version ? " — đang dùng" : " — bản cũ"}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">So sánh với</span>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={compare ?? ""}
                onChange={(e) =>
                  setCompare(e.target.value === "" ? null : Number(e.target.value))
                }
              >
                <option value="">— không so sánh —</option>
                {allVersions
                  .filter((v) => v !== picked)
                  .map((v) => (
                    <option key={v} value={v}>
                      v{v}
                    </option>
                  ))}
              </select>
            </label>

            <div className="pb-1.5 text-xs text-muted">
              repeat_penalty {reg.draft.repeat_penalty} · {allVersions.length} phiên bản
              đã chạy
            </div>
          </div>

          {/* preamble, one column or two */}
          <div
            className={`grid gap-4 ${compare !== null ? "lg:grid-cols-2" : "grid-cols-1"}`}
          >
            <PreambleBox
              label={`v${picked}`}
              text={preambleOf(current)}
              other={compare !== null ? preambleOf(other) : null}
              highlight={compare !== null}
            />
            {compare !== null && (
              <PreambleBox
                label={`v${compare}`}
                text={preambleOf(other)}
                other={preambleOf(current)}
                highlight
              />
            )}
          </div>

          {/* per-group table for the selected version */}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-4xl text-sm">
              <thead className="bg-surface text-xs text-muted">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2 text-left">Nhóm</th>
                  <th className="px-3 py-2 text-left">Câu hỏi (v{picked})</th>
                  <th className="px-3 py-2 text-right">trần tok</th>
                  <th className="px-3 py-2 text-right">đã nháp</th>
                  <th className="px-3 py-2 text-right">bị cắt</th>
                  <th className="px-3 py-2 text-right">tok TB</th>
                  <th className="px-3 py-2 text-right">ms TB</th>
                  <th className="px-3 py-2 text-left">kết quả duyệt</th>
                </tr>
              </thead>
              <tbody>
                {reg.draft.groups.map((g) => {
                  const mine = current.find((v) => v.qgroup === g.code);
                  const theirs = other.find((v) => v.qgroup === g.code);
                  const q = mine ? splitPrompt(mine.prompt_text).question : g.question;
                  const u = statOf(picked, g.code);
                  const isOpen = open === g.code;
                  const qChanged =
                    theirs && splitPrompt(theirs.prompt_text).question !== q;
                  return (
                    <tr
                      key={g.code}
                      className="cursor-pointer border-t border-border align-top hover:bg-surface"
                      onClick={() => setOpen(isOpen ? null : g.code)}
                    >
                      <td className="px-2 py-2 text-muted">{isOpen ? "▾" : "▸"}</td>
                      <td className="px-3 py-2">
                        <span className="rounded border border-border bg-background px-1.5 py-0.5 text-xs font-semibold text-accent">
                          {g.code}
                        </span>
                        <div className="mt-1 text-xs text-muted">{g.name}</div>
                      </td>
                      <td className="max-w-md px-3 py-2 text-xs">
                        {isOpen ? (
                          <div className="flex flex-col gap-2">
                            <p>{q}</p>
                            {theirs && (
                              <div className="rounded border border-border bg-background p-2">
                                <span className="text-muted">v{compare}: </span>
                                <span className={qChanged ? "text-amber" : "text-muted"}>
                                  {splitPrompt(theirs.prompt_text).question}
                                </span>
                                {!qChanged && (
                                  <span className="text-muted"> (không đổi)</span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {q.slice(0, 68)}
                            {q.length > 68 ? "…" : ""}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {mine?.max_tokens ?? g.max_tokens}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {u?.n_drafts ?? "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          u?.n_truncated ? "text-amber" : "text-muted"
                        }`}
                      >
                        {u ? (u.n_truncated ?? 0) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {u?.avg_out_tokens ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {u?.avg_latency_ms ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {!u || (u.agree ?? 0) + (u.not_answerable ?? 0) + (u.disagree ?? 0) === 0 ? (
                          <span className="text-muted">chưa duyệt</span>
                        ) : (
                          <span className="flex gap-2">
                            <span className="text-green">{u.agree ?? 0} đồng ý</span>
                            <span className="text-amber">{u.not_answerable ?? 0} n/a</span>
                            <span className="text-red">{u.disagree ?? 0} không</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Text lấy từ bản ghi lúc gửi đi, không phải từ code hiện tại — nên sửa prompt
            bao nhiêu lần vẫn đọc lại được bản cũ. Cột &ldquo;kết quả duyệt&rdquo; là
            phản hồi thật của Team B trên chính phiên bản đang chọn.
          </p>
        </>
      ) : (
        <>
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <code className="text-sm text-foreground">{reg.judge.name}</code>
              <span className="rounded border border-accent bg-accent/20 px-2 py-0.5 text-xs text-foreground">
                v{reg.judge.version}
              </span>
              <span className="text-xs text-amber">chưa chạy lần nào</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Bốn rubric cho chín nhóm. DC.pdf nói rõ là không dùng chung một prompt:
              nhóm S chấm chặt theo đáp án chuẩn, còn nhóm Prev có nhiều đáp án đúng và
              phải cho điểm từng phần — một rubric chung sẽ đánh trượt những câu Prev
              đúng. Judge chỉ chạy được sau khi đã có đáp án chuẩn, tức là sau khi Team B
              duyệt xong.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {reg.judge.rubrics.map((j) => (
              <div key={j.key} className="rounded-md border border-border bg-surface">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 text-xs font-semibold text-accent">
                    {j.key}
                  </span>
                  <span className="text-sm text-foreground">{j.title}</span>
                  <span className="ml-auto flex gap-1">
                    {j.groups.map((g) => (
                      <span
                        key={g}
                        className="rounded border border-border px-1.5 py-0.5 text-xs text-muted"
                      >
                        {g}
                      </span>
                    ))}
                  </span>
                </div>
                <p className="px-4 py-3 text-sm">{j.rubric}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** One version's preamble. When comparing, lines unique to this side are tinted
 *  -- that is precisely what changed between the two versions. */
function PreambleBox({
  label, text, other, highlight,
}: {
  label: string;
  text: string;
  other: string | null;
  highlight: boolean;
}) {
  const otherLines = new Set(
    (other ?? "").split("\n").map((l) => l.trim()).filter(Boolean),
  );
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded border border-accent bg-accent/20 px-2 py-0.5 text-xs text-foreground">
          {label}
        </span>
        {highlight && other && (
          <span className="text-xs text-muted">
            dòng <span className="text-green">bôi xanh</span> chỉ có ở bản này
          </span>
        )}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-border bg-background p-3 text-xs leading-relaxed">
        {text.split("\n").map((line, i) => {
          const t = line.trim();
          const unique = highlight && other !== null && t !== "" && !otherLines.has(t);
          return (
            <span key={i} className={unique ? "block bg-green/15 text-green" : "block"}>
              {line || " "}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
