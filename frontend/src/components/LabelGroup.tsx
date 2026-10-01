// Shared difficulty/event button-group, used by both the live review flow
// (review/page.tsx) and the backlog relabel flow (relabel/page.tsx).

export function LabelGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T | null;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs text-muted mb-1">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            className={`px-3 py-1.5 rounded-md border text-sm ${value === option
              ? "border-accent bg-accent/20 text-foreground" : "border-border text-muted"}`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
