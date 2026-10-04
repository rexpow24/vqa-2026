// Placeholder blocks for route-level loading.tsx files.
//
// Without a loading.tsx, an App Router navigation to a dynamic page leaves the
// browser sitting on the previous screen until the server has finished every
// query -- nothing moves, so the app reads as frozen rather than busy. These
// let the shell paint immediately while the data streams in behind it.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-border/60 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <Skeleton className="h-4 w-3/4" />
      <div className="mt-3 flex justify-between gap-2">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-1/5" />
      </div>
    </div>
  );
}
