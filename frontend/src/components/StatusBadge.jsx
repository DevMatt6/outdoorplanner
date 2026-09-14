export const STATO_COLORS = {
  BOZZA: { bg: "#E9EAE7", text: "#4B5563", dot: "#9CA3AF", label: "Bozza" },
  DA_COMPLETARE: { bg: "#E9EAE7", text: "#4B5563", dot: "#9CA3AF", label: "Da completare" },
  INVIATA: { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6", label: "Inviata" },
  IN_ISTRUTTORIA: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B", label: "In istruttoria" },
  IN_VERIFICA: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B", label: "In verifica" },
  INTEGRAZIONE_RICHIESTA: { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444", label: "Integrazione richiesta" },
  APPROVATA: { bg: "#D8EADB", text: "#1F5B33", dot: "#2F5B41", label: "Approvata" },
  RIFIUTATA: { bg: "#26292B", text: "#FFFFFF", dot: "#26292B", label: "Rifiutata" },
  PRENOTAZIONE_SCADUTA: { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444", label: "Prenotazione scaduta" },
  ANNULLATA: { bg: "#E9EAE7", text: "#6B7280", dot: "#9CA3AF", label: "Annullata" },
};

export const TipoBadge = ({ tipo }) => (
  <span data-testid={`badge-tipo-${tipo || "OSP"}`}
    className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full whitespace-nowrap border ${tipo === "OOH" ? "border-[#2F5B41] text-[#2F5B41] bg-[#E4EEE6]" : "border-[#B45309] text-[#B45309] bg-[#FEF3C7]"}`}>
    {tipo === "OOH" ? "Campagna OOH" : "OSP / Evento"}
  </span>
);

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
