import { Skeleton } from "@/components/Skeleton";

// The labeling screen is the one an annotator opens hundreds of times, and it
// is reached by completing the previous video, so it must never look stuck.
// Two columns, matching HostedLabeling: player on the left, drafts on the right.
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Đang tải video">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-72" />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-video w-full rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-md border border-border bg-surface p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
