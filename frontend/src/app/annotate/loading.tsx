import { Skeleton, SkeletonCard } from "@/components/Skeleton";

// Mirrors the real queue page's structure so the shell does not jump when the
// data arrives: heading, progress panel, then the card grid.
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Đang tải danh sách video">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
        <div className="flex justify-between gap-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} />)}
      </div>
    </div>
  );
}
