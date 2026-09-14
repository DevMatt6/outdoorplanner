import { useEffect, useState } from "react";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

const EMPTY = { zona_id: "", nome: "", descrizione: "", impianti_ids: [], prezzo_giornaliero: "", form_template_id: "", attivo: true };

export default function ComunePacchetti() {
  const [pacchetti, setPacchetti] = useState([]);
  const [zone, setZone] = useState([]);
  const [impianti, setImpianti] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => api.get("/comune/pacchetti").then(({ data }) => setPacchetti(data));
  useEffect(() => {
    load();
    api.get("/comune/zone").then(({ data }) => setZone(data));
    api.get("/comune/impianti").then(({ data }) => setImpianti(data));
    api.get("/comune/form-templates").then(({ data }) => setTemplates(data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (form.impianti_ids.length === 0) return toast.error("Seleziona almeno un impianto");
    const payload = { ...form, prezzo_giornaliero: parseFloat(form.prezzo_giornaliero), form_template_id: form.form_template_id || null };
    try {
      if (form.id) await api.put(`/comune/pacchetti/${form.id}`, payload);
      else await api.post("/comune/pacchetti", payload);
      toast.success("Circuito salvato");
      setForm(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Eliminare il circuito ${p.nome}?`)) return;
    try { await api.delete(`/comune/pacchetti/${p.id}`); toast.success("Circuito eliminato"); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  const toggleImp = (id) => setForm((f) => ({ ...f, impianti_ids: f.impianti_ids.includes(id) ? f.impianti_ids.filter((x) => x !== id) : [...f.impianti_ids, id] }));
  const impiantiZona = impianti.filter((i) => i.zona_id === form?.zona_id);
  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2F5B41] bg-white w-full";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Circuiti / Pacchetti OOH</h1>
        <button data-testid="nuovo-pacchetto-button" onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-2 bg-[#2F5B41] text-white rounded-full px-5 py-2.5 font-bold hover:bg-[#26492F] transition-colors">
          <Plus size={17} /> Nuovo circuito
        </button>
      </div>

      {form && (
        <form onSubmit={submit} className="mt-6 border border-slate-100 bg-white rounded-2xl p-6" data-testid="pacchetto-form">
          <h2 className="font-heading font-extrabold text-lg mb-4">{form.id ? `Modifica ${form.nome}` : "Nuovo circuito"}</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input data-testid="pacchetto-nome" className={input} placeholder="Nome (es. Circuito EUR 10)" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <select data-testid="pacchetto-zona" className={input} required value={form.zona_id} onChange={(e) => setForm({ ...form, zona_id: e.target.value, impianti_ids: [] })}>
              <option value="">— Zona —</option>
              {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
            </select>
            <input data-testid="pacchetto-prezzo" className={input} type="number" step="0.5" placeholder="Prezzo €/giorno" required value={form.prezzo_giornaliero} onChange={(e) => setForm({ ...form, prezzo_giornaliero: e.target.value })} />
          </div>
          <textarea className={`${input} mt-3`} rows={2} placeholder="Descrizione" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
          <select data-testid="pacchetto-modulo" className={`${input} mt-3 max-w-md`} value={form.form_template_id || ""} onChange={(e) => setForm({ ...form, form_template_id: e.target.value })}>
            <option value="">Modulo: predefinito del Comune</option>
            {templates.map((t) => <option key={t.id} value={t.id}>Modulo: {t.nome}</option>)}
          </select>
          {form.zona_id && (
            <>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-5 mb-2">Impianti del circuito ({form.impianti_ids.length} selezionati)</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-auto">
                {impiantiZona.map((i) => (
                  <label key={i.id} className={`flex items-center gap-2.5 border rounded-xl px-3 py-2 text-xs cursor-pointer transition-colors ${form.impianti_ids.includes(i.id) ? "border-[#2F5B41] bg-[#F5F8F4]" : "border-slate-100 hover:border-[#2F5B41]"}`}>
                    <input type="checkbox" data-testid={`pacchetto-imp-${i.id}`} className="w-4 h-4 accent-[#2F5B41]" checked={form.impianti_ids.includes(i.id)} onChange={() => toggleImp(i.id)} />
                    <span><strong>{i.codice}</strong> · {i.tipologia} · {i.formato}</span>
                  </label>
                ))}
                {impiantiZona.length === 0 && <div className="col-span-full text-xs text-slate-500 p-3">Nessun impianto in questa zona.</div>}
              </div>
            </>
          )}
          <div className="mt-4 flex gap-3">
            <button data-testid="pacchetto-submit" className="px-6 py-2.5 font-bold rounded-full bg-[#2F5B41] text-white hover:bg-[#26492F] transition-colors">Salva circuito</button>
            <button type="button" onClick={() => setForm(null)} className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#2F5B41] transition-colors">Annulla</button>
          </div>
        </form>
      )}

      <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pacchetti.map((p) => (
          <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-5" data-testid={`pacchetto-card-${p.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2F5B41]">{p.zona_nome}</div>
                <div className="font-heading font-extrabold text-lg">{p.nome}</div>
              </div>
              <div className="flex gap-2">
                <button data-testid={`edit-pacchetto-${p.id}`} onClick={() => setForm({ ...EMPTY, ...p })}
                  className="border border-slate-200 rounded-lg p-1.5 hover:border-[#2F5B41] transition-colors"><Pencil size={13} /></button>
                <button data-testid={`delete-pacchetto-${p.id}`} onClick={() => remove(p)}
                  className="border border-slate-200 rounded-lg p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-bold rounded-full bg-[#F5F6F3] px-2.5 py-1">{p.n_impianti} impianti</span>
              <span className="font-heading font-extrabold">{p.prezzo_giornaliero} €<span className="text-xs font-normal text-slate-500">/g</span></span>
            </div>
          </div>
        ))}
        {pacchetti.length === 0 && <div className="col-span-full bg-white border border-slate-100 rounded-2xl p-8 text-center text-sm text-slate-500">Nessun circuito configurato.</div>}
      </div>
    </BackofficeLayout>
  );
}
