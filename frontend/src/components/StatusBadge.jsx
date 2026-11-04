const tone = (name) => ({ bg: `hsl(var(--${name}-muted))`, text: `hsl(var(--${name === 'success' || name === 'warning' ? `${name}-foreground` : name}))`, dot: `hsl(var(--${name}))` });
const neutral = { bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))", dot: "hsl(var(--muted-foreground))" };
export const STATO_COLORS = {
  BOZZA: { ...neutral, label: "Bozza" },
  DA_COMPLETARE: { ...neutral, label: "Da completare" },
  INVIATA: { ...tone("info"), label: "Inviata" },
  IN_ISTRUTTORIA: { ...tone("warning"), label: "In istruttoria" },
  IN_VERIFICA: { ...tone("warning"), label: "In verifica" },
  INTEGRAZIONE_RICHIESTA: { ...tone("warning"), label: "Integrazione richiesta" },
  APPROVATA: { ...tone("success"), label: "Approvata" },
  RIFIUTATA: { ...tone("destructive"), label: "Rifiutata" },
  PRENOTAZIONE_SCADUTA: { ...tone("destructive"), label: "Prenotazione scaduta" },
  PAGAMENTO_SCADUTO: { ...tone("destructive"), label: "Pagamento scaduto" },
  ANNULLATA: { ...neutral, label: "Annullata" },
};
export const TipoBadge = ({ tipo }) => <span data-testid={`badge-tipo-${tipo || "OSP"}`} className="inline-flex whitespace-nowrap rounded-md border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{tipo === "OOH" ? "Campagna OOH" : "OSP / Evento"}</span>;
export const StatusBadge = ({ stato }) => {
  const s = STATO_COLORS[stato] || STATO_COLORS.BOZZA;
  return <span data-testid={`badge-stato-${stato}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} aria-hidden="true" />{s.label}</span>;
};
