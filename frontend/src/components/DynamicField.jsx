export const DynamicField = ({ campo, value, onChange }) => {
  const base = "w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0033FF] focus:border-2 transition-colors bg-white";
  const tid = `field-${campo.id}`;

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-1.5">
        {campo.label} {campo.required && <span className="text-[#EF4444]">*</span>}
      </label>
      {campo.tipo === "textarea" ? (
        <textarea data-testid={tid} rows={3} className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : campo.tipo === "select" ? (
        <select data-testid={tid} className={base} value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Seleziona —</option>
          {campo.opzioni.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : campo.tipo === "checkbox" ? (
        <label className="flex items-center gap-2 border border-slate-300 px-3 py-2.5 cursor-pointer hover:border-slate-900 transition-colors">
          <input data-testid={tid} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 accent-[#0033FF]" />
          <span className="text-sm">Sì</span>
        </label>
      ) : (
        <input data-testid={tid} type={campo.tipo === "number" ? "number" : campo.tipo === "date" ? "date" : "text"}
          className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
};

export const isVisible = (campo, values) => {
  if (!campo.condizione) return true;
  return values[campo.condizione.campo] === campo.condizione.valore;
};
