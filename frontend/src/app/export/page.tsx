export default function ExportPage() {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-6 text-sm text-muted max-w-lg">
      <p className="text-foreground mb-2">Not yet implemented.</p>
      <p>
        `app.py`&apos;s Export tab writes a manifest over approved clips in{" "}
        <code>trimmed/</code>. Porting it needs a new sidecar endpoint (the logic is inline in
        `app.py` today, not in a `vqa/` module) -- deferred per the phased plan. See{" "}
        <code>features/nextjs-frontend-migration/architecture.md</code>.
      </p>
      <p className="mt-3">
        Use the Streamlit app (<code>streamlit run app.py</code>) for exports until this ships.
      </p>
    </div>
  );
}
