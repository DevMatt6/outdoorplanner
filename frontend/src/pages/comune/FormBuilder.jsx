import { useEffect, useState } from "react";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";

const NUOVO_CAMPO = { label: "", tipo: "text", opzioni: "", required: false, cond_campo: "", cond_valore: "" };

export default function FormBuilder() {
  const [tpl, setTpl] = useState(null);
  const [nuovo, setNuovo] = useState(NUOVO_CAMPO);

  useEffect(() => {
    api.get("/comune/form-template").then(({ data }) => setTpl(data));
  }, []);

  if (!tpl) return <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}><div className="text-slate-500">Caricamento...</div></BackofficeLayout>;

  const addCampo = () => {
    if (!nuovo.label.trim()) return toast.error("Inserisci l'etichetta del campo");
    const id = nuovo.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const campo = {
      id, label: nuovo.label, tipo: nuovo.tipo,
      opzioni: nuovo.tipo === "select" ? nuovo.opzioni.split(",").map((s) => s.trim()).filter(Boolean) : [],
      required: nuovo.required,
      condizione: nuovo.cond_campo ? { campo: nuovo.cond_campo, valore: nuovo.cond_valore === "true" ? true : nuovo.cond_valore } : null,
    };
    setTpl({ ...tpl, campi: [...tpl.campi, campo] });
    setNuovo(NUOVO_CAMPO);
  };

  const save = async () => {
    try {
      await api.put("/comune/form-template", { nome: tpl.nome, campi: tpl.campi });
      toast.success("Modulo salvato");
    } catch (e) { toast.error(apiError(e)); }
  };

  const input = "border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0033FF] transition-colors bg-white";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Configuratore modulo</h1>
        <button data-testid="salva-template-button" onClick={save}
          className="bg-[#0033FF] text-white px-6 py-2.5 font-bold hover:bg-[#0A3D91] transition-colors">
          Salva modulo
        </button>
      </div>
      <p className="text-sm text-slate-600 mt-1">Questi campi compaiono nel wizard di candidatura degli inserzionisti. La logica condizionale mostra un campo solo se un altro campo ha un certo valore.</p>

      <input className={`${input} mt-6 w-full max-w-lg font-bold`} value={tpl.nome} data-testid="template-nome-input"
        onChange={(e) => setTpl({ ...tpl, nome: e.target.value })} placeholder="Nome del modulo" />

      <div className="mt-4 border border-slate-900 bg-white">
        {tpl.campi.map((c, i) => (
          <div key={c.id + i} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200" data-testid={`campo-row-${c.id}`}>
            <GripVertical size={15} className="text-slate-300" />
            <span className="font-bold text-sm flex-1 min-w-[140px]">{c.label}</span>
            <span className="text-[10px] font-bold uppercase bg-slate-100 border border-slate-300 px-2 py-1">{c.tipo}</span>
            {c.required && <span className="text-[10px] font-bold uppercase bg-[#EF4444] text-white px-2 py-1">Obbligatorio</span>}
            {c.condizione && <span className="text-[10px] font-bold uppercase bg-[#0A3D91] text-white px-2 py-1">se {c.condizione.campo} = {String(c.condizione.valore)}</span>}
            {c.opzioni?.length > 0 && <span className="text-xs text-slate-500">[{c.opzioni.join(", ")}]</span>}
            <button data-testid={`rimuovi-campo-${c.id}`} onClick={() => setTpl({ ...tpl, campi: tpl.campi.filter((_, j) => j !== i) })}
              className="ml-auto border border-slate-300 p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {tpl.campi.length === 0 && <div className="p-6 text-sm text-slate-500">Nessun campo. Aggiungine uno qui sotto.</div>}
      </div>

      <div className="mt-4 border-2 border-dashed border-slate-400 bg-white p-5" data-testid="nuovo-campo-form">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Aggiungi campo</div>
        <div className="flex flex-wrap gap-3">
          <input data-testid="nuovo-campo-label" className={`${input} flex-1 min-w-[180px]`} placeholder="Etichetta (es. Ragione sociale)"
            value={nuovo.label} onChange={(e) => setNuovo({ ...nuovo, label: e.target.value })} />
          <select className={input} value={nuovo.tipo} onChange={(e) => setNuovo({ ...nuovo, tipo: e.target.value })}>
            {["text", "textarea", "number", "date", "select", "checkbox"].map((t) => <option key={t}>{t}</option>)}
          </select>
          {nuovo.tipo === "select" && (
            <input className={`${input} min-w-[200px]`} placeholder="Opzioni separate da virgola"
              value={nuovo.opzioni} onChange={(e) => setNuovo({ ...nuovo, opzioni: e.target.value })} />
          )}
          <label className="flex items-center gap-2 text-sm font-semibold px-2">
            <input type="checkbox" className="w-4 h-4 accent-[#0033FF]" checked={nuovo.required} onChange={(e) => setNuovo({ ...nuovo, required: e.target.checked })} />
            Obbligatorio
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 items-center">
          <span className="text-xs text-slate-500 font-semibold">Logica condizionale (opzionale):</span>
          <select className={input} value={nuovo.cond_campo} onChange={(e) => setNuovo({ ...nuovo, cond_campo: e.target.value })}>
            <option value="">— sempre visibile —</option>
            {tpl.campi.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {nuovo.cond_campo && (
            <input className={input} placeholder="valore (es. Azienda, true)"
              value={nuovo.cond_valore} onChange={(e) => setNuovo({ ...nuovo, cond_valore: e.target.value })} />
          )}
          <button data-testid="aggiungi-campo-button" onClick={addCampo}
            className="ml-auto inline-flex items-center gap-2 border-2 border-slate-900 px-5 py-2 text-sm font-bold hover:bg-slate-900 hover:text-white transition-colors">
            <Plus size={15} /> Aggiungi
          </button>
        </div>
      </div>
    </BackofficeLayout>
  );
}
