import { getCodebook } from "@/lib/codebook";

export type AdminAnswer = {
  annotator_id: string;
  annotator_name: string;
  annotator_email: string;
  assignment_status: string;
  answer_format: "text" | "slots";
  qgroup: string;
  question: string;
  verdict: string | null;
  edited_answer: string | null;
  slots: Record<string, unknown> | null;
  codebook_version: string | null;
};

function slotValueLabel(value: unknown, options: { id: string; label: string }[] = []): string {
  if (Array.isArray(value)) return value.map((item) => slotValueLabel(item, options)).filter(Boolean).join("; ");
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const item = value as { option?: unknown; options?: unknown; entity?: unknown; text?: unknown };
  const ids = Array.isArray(item.options) ? item.options : typeof item.option === "string" ? [item.option] : [];
  const labels = ids.map((id) => {
    if (typeof id !== "string") return String(id);
    return options.find((option) => option.id === id)?.label ?? id;
  });
  if (typeof item.entity === "string") labels.push(`Thực thể ${item.entity}`);
  if (typeof item.text === "string" && item.text.trim()) labels.push(`“${item.text.trim()}”`);
  if (labels.length) return labels.join(", ");
  return JSON.stringify(value);
}

export function AdminAnswerReview({ answers }: { answers: AdminAnswer[] }) {
  const people = new Map<string, AdminAnswer[]>();
  for (const answer of answers) people.set(answer.annotator_id, [...(people.get(answer.annotator_id) ?? []), answer]);

  return <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4" data-testid="admin-answer-review">
    <div>
      <h3 className="font-medium">Câu trả lời của annotator</h3>
      <p className="mt-1 text-xs text-muted">Hiển thị dữ liệu đã lưu theo từng người và nhóm câu hỏi. Với câu dạng ô, phần chi tiết có lựa chọn đã giải mã và JSON gốc.</p>
    </div>
    {people.size === 0 && <p className="text-sm text-muted">Chưa có annotator nào lưu câu trả lời cho video này.</p>}
    {[...people.entries()].map(([annotatorId, rows], index) => {
      const first = rows[0];
      const slotCount = rows.filter((row) => row.slots !== null).length;
      return <details key={annotatorId} open={index === 0} className="rounded border border-border bg-background">
        <summary className="cursor-pointer px-3 py-2 text-sm">
          <span className="font-medium">{first.annotator_name}</span>
          {first.annotator_email && <span className="ml-2 text-muted">{first.annotator_email}</span>}
          <span className="ml-2 text-muted">{rows.length} câu · {slotCount} dạng slots · {first.assignment_status}</span>
        </summary>
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {rows.map((row) => {
            const candidateBook = row.codebook_version ? getCodebook(row.codebook_version) : undefined;
            const book = candidateBook?.group === row.qgroup ? candidateBook : undefined;
            const hasSlots = row.slots !== null;
            return <article key={`${row.annotator_id}-${row.qgroup}`} className="rounded border border-border/70 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-accent">{row.qgroup}</span>
                <span className="text-muted">{hasSlots ? `slots · ${row.codebook_version ?? "chưa rõ phiên bản"}` : "chữ"}</span>
                {row.verdict && <span className="rounded border border-border px-1.5 py-0.5 text-xs">{row.verdict}</span>}
              </div>
              <p className="mt-1 text-xs text-muted">{row.question}</p>
              {hasSlots ? <>
                {row.edited_answer && <p className="mt-2 whitespace-pre-wrap"><span className="font-medium">Câu ghép: </span>{row.edited_answer}</p>}
                {book && <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(8rem,auto)_1fr]">
                  {book.cells.filter((cell) => row.slots?.[cell.id] !== undefined).map((cell) => <div key={cell.id} className="contents">
                    <dt className="text-muted">{cell.label}</dt>
                    <dd className="break-words">{slotValueLabel(row.slots?.[cell.id], cell.options ?? [])}</dd>
                  </div>)}
                </dl>}
                {!book && <p className="mt-2 text-xs text-amber">Không tìm thấy codebook {row.codebook_version} trong bản frontend này.</p>}
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-accent">Xem JSON slots gốc</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded bg-surface p-2 text-xs">{JSON.stringify(row.slots, null, 2)}</pre>
                </details>
              </> : <p className="mt-2 whitespace-pre-wrap">{row.edited_answer || "Chưa có nội dung đã lưu."}</p>}
            </article>;
          })}
        </div>
      </details>;
    })}
  </section>;
}
