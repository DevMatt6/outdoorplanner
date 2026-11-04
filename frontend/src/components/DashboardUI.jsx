import { Card, CardContent } from "./ui/card";
import { Inbox } from "lucide-react";
export function StatCard({ label, value, icon: Icon, description }) {
  return <Card className="shadow-none"><CardContent className="p-5"><div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{label}</span>{Icon && <Icon size={16} strokeWidth={1.6} className="text-muted-foreground" />}</div><div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>{description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}</CardContent></Card>;
}
export function EmptyState({ title = "Nessun risultato", description, children }) {
  return <div className="flex flex-col items-center justify-center px-5 py-12 text-center"><span className="mb-4 rounded-lg border bg-muted p-3 text-muted-foreground"><Inbox size={22} strokeWidth={1.5} /></span><p className="text-sm font-medium">{title}</p>{description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}{children && <div className="mt-5">{children}</div>}</div>;
}
