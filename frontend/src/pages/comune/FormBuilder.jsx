import { useEffect, useState } from "react";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, FilePlus2, FileUp } from "lucide-react";

const NUOVO_CAMPO = { label: "", tipo: "text", opzioni: "", required: false, cond_campo: "", cond_valore: "" };
const TIPI_CAMPO = ["text", "textarea", "number", "date", "select", "checkbox", "file"];
const slugId = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export default function FormBuilder() {
  const [templates, setTemplates] = useState([]);
  const [tpl, setTpl] = useState(null);
  const [nuovo, setNuovo] = useState(NUOVO_CAMPO);
  const [nuovoDoc, setNuovoDoc] = useState({ label: "", required: false });

  const load = async (selectId) => {
    const { data } = await api.get("/comune/form-templates");
    setTemplates(data);
    if (selectId) setTpl(data.find((t) => t.id === selectId) || data[0] || null);
    else if (!tpl && data.length) setTpl(data[0]);
  };
  useEffect(() => { load(); }, []);

  const nuovoModulo = async () => {
    const nome = window.prompt("Nome del nuovo modulo (es. Modulo Poster Standard):");
    if (!nome?.trim()) return;
    try {
      const { data } = await api.post("/comune/form-templates", { nome: nome.trim(), campi: [] });
      toast.success("Modulo creato");
      await load(data.id);
    } catch (e) { toast.error(apiError(e)); }
  };

  const eliminaModulo = async () => {
    if (!tpl?.id) return;
    try {
      await api.delete(`/comune/form-templates/${tpl.id}`);
      toast.success("Modulo eliminato");
      setTpl(null);
      await load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const addCampo = () => {
    if (!nuovo.label.trim()) return toast.error("Inserisci l'etichetta del campo");
    const id = slugId(nuovo.label);
    if (tpl.campi.some((c) => c.id === id)) return toast.error("Esiste già un campo con questa etichetta");
    const campo = {
      id, label: nuovo.label, tipo: nuovo.tipo,
      opzioni: nuovo.tipo === "select" ? nuovo.opzioni.split(",").map((s) => s.trim()).filter(Boolean) : [],
      required: nuovo.required,
      condizione: nuovo.cond_campo ? { campo: nuovo.cond_campo, valore: nuovo.cond_valore === "true" ? true : nuovo.cond_valore } : null,
    };
    setTpl({ ...tpl, campi: [...tpl.campi, campo] });
    setNuovo(NUOVO_CAMPO);
  };

  const addDoc = () => {
    if (!nuovoDoc.label.trim()) return toast.error("Inserisci il nome del documento");
    const id = slugId(nuovoDoc.label);
    const docs = tpl.documenti_richiesti || [];
    if (docs.some((d) => d.id === id)) return toast.error("Documento già presente");
    setTpl({ ...tpl, documenti_richiesti: [...docs, { id, label: nuovoDoc.label.trim(), required: nuovoDoc.required }] });
    setNuovoDoc({ label: "", required: false });
  };

  const save = async () => {
    try {
      await api.put(`/comune/form-templates/${tpl.id}`, { nome: tpl.nome, campi: tpl.campi, documenti_richiesti: tpl.documenti_richiesti || [] });
      toast.success("Modulo salvato");
      load(tpl.id);
    } catch (e) { toast.error(apiError(e)); }
  };

  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1F3BB3] transition-colors bg-white";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Moduli dinamici</h1>
        <div className="flex gap-3">
          <button data-testid="nuovo-modulo-button" onClick={nuovoModulo}
            className="inline-flex items-center gap-2 border border-slate-200 rounded-full px-5 py-2.5 font-bold bg-white hover:border-[#1F3BB3] hover:text-[#1F3BB3] transition-colors">
            <FilePlus2 size={16} /> Nuovo modulo
          </button>
          {tpl && (
            <button data-testid="salva-template-button" onClick={save}
              className="bg-[#1F3BB3] text-white rounded-full px-6 py-2.5 font-bold hover:bg-[#172E93] transition-colors">
              Salva modulo
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-500 mt-1">Crea più moduli (es. "Modulo Poster Standard", "Modulo Maxi Affissione") e assegnali agli spazi dal Catalogo. I campi di tipo <strong>file</strong> compaiono allo step Documenti della candidatura come "Documenti specifici".</p>

      <div className="mt-5 flex flex-wrap gap-2" data-testid="moduli-tabs">
        {templates.map((t) => (
          <button key={t.id} data-testid={`modulo-tab-${t.id}`} onClick={() => setTpl(t)}
            className={`px-4 py-2 text-sm font-bold rounded-full border transition-colors ${tpl?.id === t.id ? "bg-[#1F3BB3] text-white border-[#1F3BB3]" : "bg-white border-slate-200 hover:border-[#1F3BB3]"}`}>
            {t.nome}
          </button>
        ))}
        {templates.length === 0 && <span className="text-sm text-slate-500">Nessun modulo. Creane uno con "Nuovo modulo".</span>}
      </div>

      {tpl && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input className={`${input} w-full max-w-lg font-bold`} value={tpl.nome} data-testid="template-nome-input"
              onChange={(e) => setTpl({ ...tpl, nome: e.target.value })} placeholder="Nome del modulo" />
            <button data-testid="elimina-modulo-button" onClick={eliminaModulo}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#B91C1C] border border-red-200 rounded-full px-4 py-2 hover:bg-red-50 transition-colors">
              <Trash2 size={14} /> Elimina modulo
            </button>
          </div>

          <div className="mt-4 border border-dashed border-slate-300 rounded-2xl bg-white p-5" data-testid="nuovo-campo-form">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Aggiungi campo</div>
            <div className="flex flex-wrap gap-3">
              <input data-testid="nuovo-campo-label" className={`${input} flex-1 min-w-[180px]`} placeholder="Etichetta (es. Ragione sociale, Bozzetto grafico)"
                value={nuovo.label} onChange={(e) => setNuovo({ ...nuovo, label: e.target.value })} />
              <select data-testid="nuovo-campo-tipo" className={input} value={nuovo.tipo} onChange={(e) => setNuovo({ ...nuovo, tipo: e.target.value })}>
                {TIPI_CAMPO.map((t) => <option key={t} value={t}>{t === "file" ? "file (upload documento)" : t}</option>)}
              </select>
              {nuovo.tipo === "select" && (
                <input className={`${input} min-w-[200px]`} placeholder="Opzioni separate da virgola"
                  value={nuovo.opzioni} onChange={(e) => setNuovo({ ...nuovo, opzioni: e.target.value })} />
              )}
              <label className="flex items-center gap-2 text-sm font-semibold px-2">
                <input type="checkbox" className="w-4 h-4 accent-[#1F3BB3]" checked={nuovo.required} onChange={(e) => setNuovo({ ...nuovo, required: e.target.checked })} />
                Obbligatorio
              </label>
              <button data-testid="aggiungi-campo-button" onClick={addCampo}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#1F3BB3] text-white px-5 py-2 text-sm font-bold hover:bg-[#172E93] transition-colors">
                <Plus size={15} /> Aggiungi
              </button>
            </div>
            {nuovo.tipo !== "file" && (
              <div className="mt-3 flex flex-wrap gap-3 items-center">
                <span className="text-xs text-slate-500 font-semibold">Logica condizionale (opzionale):</span>
                <select className={input} value={nuovo.cond_campo} onChange={(e) => setNuovo({ ...nuovo, cond_campo: e.target.value })}>
                  <option value="">— sempre visibile —</option>
                  {tpl.campi.filter((c) => c.tipo !== "file").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                {nuovo.cond_campo && (
                  <input className={input} placeholder="valore (es. Azienda, true)"
                    value={nuovo.cond_valore} onChange={(e) => setNuovo({ ...nuovo, cond_valore: e.target.value })} />
                )}
              </div>
            )}
          </div>

          <div className="mt-4 border border-slate-100 bg-white rounded-2xl overflow-hidden">
            {tpl.campi.map((c, i) => (
              <div key={c.id + i} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100" data-testid={`campo-row-${c.id}`}>
                <GripVertical size={15} className="text-slate-300" />
                <span className="font-bold text-sm flex-1 min-w-[140px]">{c.label}</span>
                <span className={`text-[10px] font-bold uppercase rounded-full px-2.5 py-1 ${c.tipo === "file" ? "bg-[#E8EFFF] text-[#1F3BB3]" : "bg-slate-100 text-slate-600"}`}>{c.tipo === "file" ? "Upload file" : c.tipo}</span>
                {c.required && <span className="text-[10px] font-bold uppercase rounded-full bg-red-100 text-[#B91C1C] px-2.5 py-1">Obbligatorio</span>}
                {c.condizione && <span className="text-[10px] font-bold uppercase rounded-full bg-[#2B4BDB] text-white px-2.5 py-1">se {c.condizione.campo} = {String(c.condizione.valore)}</span>}
                {c.opzioni?.length > 0 && <span className="text-xs text-slate-500">[{c.opzioni.join(", ")}]</span>}
                <button data-testid={`rimuovi-campo-${c.id}`} onClick={() => setTpl({ ...tpl, campi: tpl.campi.filter((_, j) => j !== i) })}
                  className="ml-auto border border-slate-200 rounded-lg p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {tpl.campi.length === 0 && <div className="p-6 text-sm text-slate-500">Nessun campo. Aggiungine uno qui sopra.</div>}
          </div>

          <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid="documenti-richiesti-section">
            <div className="px-5 py-3 border-b border-slate-100 bg-[#F8F9FD]">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Documenti allegati richiesti</div>
              <p className="text-xs text-slate-400 mt-0.5">Personalizza lo step "Documenti" della candidatura per questo modulo: aggiungi o rimuovi i campi di upload.</p>
            </div>
            <div className="p-5 space-y-2">
              {(tpl.documenti_richiesti || []).map((d, i) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-xl px-4 py-2.5" data-testid={`doc-row-${d.id}`}>
                  <FileUp size={15} className="text-[#1F3BB3]" />
                  <span className="font-bold text-sm flex-1 min-w-[160px]">{d.label}</span>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input data-testid={`doc-required-${d.id}`} type="checkbox" className="w-4 h-4 accent-[#1F3BB3]" checked={d.required}
                      onChange={(e) => { const dd = [...tpl.documenti_richiesti]; dd[i] = { ...dd[i], required: e.target.checked }; setTpl({ ...tpl, documenti_richiesti: dd }); }} />
                    Obbligatorio
                  </label>
                  <button data-testid={`rimuovi-doc-${d.id}`} onClick={() => setTpl({ ...tpl, documenti_richiesti: tpl.documenti_richiesti.filter((_, j) => j !== i) })}
                    className="border border-slate-200 rounded-lg p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(tpl.documenti_richiesti || []).length === 0 && (
                <div className="text-sm text-slate-500">Nessun documento richiesto: lo step Documenti della candidatura non chiederà allegati.</div>
              )}
              <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-dashed border-slate-200 mt-3">
                <input data-testid="nuovo-doc-label" className={`${input} flex-1 min-w-[200px]`} placeholder="Nome documento (es. Polizza assicurativa)"
                  value={nuovoDoc.label} onChange={(e) => setNuovoDoc({ ...nuovoDoc, label: e.target.value })} />
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" className="w-4 h-4 accent-[#1F3BB3]" checked={nuovoDoc.required} onChange={(e) => setNuovoDoc({ ...nuovoDoc, required: e.target.checked })} />
                  Obbligatorio
                </label>
                <button data-testid="aggiungi-doc-button" onClick={addDoc}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1F3BB3] text-white px-5 py-2 text-sm font-bold hover:bg-[#172E93] transition-colors">
                  <Plus size={15} /> Aggiungi documento
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </BackofficeLayout>
  );
}
