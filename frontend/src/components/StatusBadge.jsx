export const STATO_COLORS = {
  BOZZA: { bg: "#94A3B8", text: "#020617", label: "Bozza" },
  INVIATA: { bg: "#3B82F6", text: "#FFFFFF", label: "Inviata" },
  IN_ISTRUTTORIA: { bg: "#F59E0B", text: "#020617", label: "In istruttoria" },
  INTEGRAZIONE_RICHIESTA: { bg: "#EF4444", text: "#FFFFFF", label: "Integrazione richiesta" },
  APPROVATA: { bg: "#10B981", text: "#020617", label: "Approvata" },
  RIFIUTATA: { bg: "#0F172A", text: "#FFFFFF", label: "Rifiutata" },
};

export const StatusBadge = ({ stato }) => {
  const s = STATO_COLORS[stato] || STATO_COLORS.BOZZA;
  return (
    <span
      data-testid={`badge-stato-${stato}`}
      className="inline-block px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
};
