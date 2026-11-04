import { Skeleton } from "./ui/skeleton";
export function LoadingState() {
  return <div role="status" aria-label="Caricamento in corso" className="space-y-5 py-4"><span className="sr-only">Caricamento in corso…</span><Skeleton className="h-7 w-52" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-24 rounded-xl" />)}</div><div className="space-y-3 rounded-xl border bg-card p-5">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-10 w-full" />)}</div></div>;
}
