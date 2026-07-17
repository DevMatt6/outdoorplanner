export const STATO_COLORS = {
  BOZZA: { bg: "#E9EAE7", text: "#4B5563", dot: "#9CA3AF", label: "Bozza" },
  INVIATA: { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6", label: "Inviata" },
  IN_ISTRUTTORIA: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B", label: "In istruttoria" },
  INTEGRAZIONE_RICHIESTA: { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444", label: "Integrazione richiesta" },
  APPROVATA: { bg: "#D8EADB", text: "#1F5B33", dot: "#2F5B41", label: "Approvata" },
  RIFIUTATA: { bg: "#26292B", text: "#FFFFFF", dot: "#26292B", label: "Rifiutata" },
};

export const StatusBadge = ({ stato }) => {
  const s = STATO_COLORS[stato] || STATO_COLORS.BOZZA;
  return (
    <span
      data-testid={`badge-stato-${stato}`}
      className="inline-block px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
};
