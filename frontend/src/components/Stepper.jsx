import { Check } from "lucide-react";
export function Stepper({ steps, current, ...props }) {
  return <ol aria-label="Fasi della pianificazione" className="mt-7 flex overflow-x-auto rounded-xl border bg-card" {...props}>{steps.map((item, index) => {
    const [stage, label] = Array.isArray(item) ? item : [index, item];
    const active = stage === current, complete = stage < current;
    return <li key={stage} aria-current={active ? "step" : undefined} className={`flex min-w-max flex-1 items-center justify-center gap-2 border-b-2 px-3 py-4 text-xs ${active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground"}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${active ? "bg-primary text-primary-foreground" : complete ? "bg-muted text-foreground" : "border"}`}>{complete ? <Check size={12} aria-label="Completato" /> : index + 1}</span><span className="whitespace-nowrap">{label}</span></li>;
  })}</ol>;
}
