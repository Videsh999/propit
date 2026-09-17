import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-[var(--r-sm)]", className)} />;
}

export function PropertyCardSkeleton() {
  return (
    <div className="border-b border-line p-4">
      <Skeleton className="mb-3 aspect-[4/3] w-full rounded-[var(--r-md)]" />
      <Skeleton className="mb-2 h-4 w-3/5" />
      <Skeleton className="mb-2 h-3 w-2/5" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
