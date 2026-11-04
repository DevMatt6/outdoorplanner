import { useConfirm } from "../../components/ConfirmDialog";
import { useEffect, useState } from "react";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

const EMPTY = { zona_id: "", nome: "", descrizione: "", impianti_ids: [], form_template_id: "", attivo: true };

export default function ComunePacchetti() {
  const confirm = useConfirm();
  const [pacchetti, setPacchetti] = useState([]);
  const [zone, setZone] = useState([]);
  const [impianti, setImpianti] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(null);
  const [filtroImp, setFiltroImp] = useState({ tipologia: "", via: "" });

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
    const payload = { zona_id: form.zona_id, nome: form.nome, descrizione: form.descrizione, impianti_ids: form.impianti_ids, form_template_id: form.form_template_id || null, attivo: form.attivo !== false };
    try {
      if (form.id) await api.put(`/comune/pacchetti/${form.id}`, payload);
      else await api.post("/comune/pacchetti", payload);
      toast.success("Circuito salvato");
      setForm(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const remove = async (p) => {
    if (!(await confirm(`Eliminare il circuito ${p.nome}?`))) return;
    try { await api.delete(`/comune/pacchetti/${p.id}`); toast.success("Circuito eliminato"); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  const toggleImp = (id) => setForm((f) => ({ ...f, impianti_ids: f.impianti_ids.includes(id) ? f.impianti_ids.filter((x) => x !== id) : [...f.impianti_ids, id] }));
  const impiantiZona = impianti.filter((i) => i.zona_id === form?.zona_id);
  const impiantiFiltrati = impiantiZona.filter((i) =>
    (!filtroImp.tipologia || i.tipologia === filtroImp.tipologia) && (!filtroImp.via || i.via === filtroImp.via));
  const selImp = impianti.filter((i) => form?.impianti_ids.includes(i.id));
  const totaleAuto = selImp.reduce((a, i) => a + (i.prezzo || 0), 0);
  const perFormato = selImp.reduce((m, i) => ({ ...m, [i.formato]: (m[i.formato] || 0) + 1 }), {});
  const tipologieZona = [...new Set(impiantiZona.map((i) => i.tipologia))];
  const vieZona = [...new Set(impiantiZona.map((i) => i.via).filter(Boolean))];
  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-card w-full";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-semibold tracking-tight">Circuiti / Pacchetti OOH</h1>
        <button data-testid="nuovo-pacchetto-button" onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-5 py-2.5 font-semibold hover:bg-primary transition-colors">
          <Plus size={17} /> Nuovo circuito
        </button>
      </div>

      {form && (
        <form onSubmit={submit} className="mt-6 border border-slate-100 bg-card rounded-xl p-6" data-testid="pacchetto-form">
          <h2 className="font-heading font-semibold text-lg mb-4">{form.id ? `Modifica ${form.nome}` : "Nuovo circuito"}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input aria-label="Nome (es. Circuito EUR 10)" data-testid="pacchetto-nome" className={input} placeholder="Nome (es. Circuito EUR 10)" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <select aria-label="pacchetto zona" data-testid="pacchetto-zona" className={input} required value={form.zona_id} onChange={(e) => { setForm({ ...form, zona_id: e.target.value, impianti_ids: [] }); setFiltroImp({ tipologia: "", via: "" }); }}>
              <option value="">— Zona —</option>
              {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
            </select>
          </div>
          <textarea aria-label="Descrizione" className={`${input} mt-3`} rows={2} placeholder="Descrizione" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
          <select aria-label="pacchetto modulo" data-testid="pacchetto-modulo" className={`${input} mt-3 max-w-md`} value={form.form_template_id || ""} onChange={(e) => setForm({ ...form, form_template_id: e.target.value })}>
            <option value="">Modulo: predefinito del Comune</option>
            {templates.map((t) => <option key={t.id} value={t.id}>Modulo: {t.nome}</option>)}
          </select>
          {form.zona_id && (
            <>
              <div className="flex flex-wrap items-center gap-3 mt-5 mb-2">
                <div className="text-xs font-semibold tracking-normal text-slate-500">Impianti del circuito ({form.impianti_ids.length} selezionati)</div>
                <select aria-label="filtro circ tipologia" data-testid="filtro-circ-tipologia" className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-card" value={filtroImp.tipologia} onChange={(e) => setFiltroImp({ ...filtroImp, tipologia: e.target.value })}>
                  <option value="">Tutte le tipologie</option>
                  {tipologieZona.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select aria-label="filtro circ via" data-testid="filtro-circ-via" className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-card" value={filtroImp.via} onChange={(e) => setFiltroImp({ ...filtroImp, via: e.target.value })}>
                  <option value="">Tutte le vie</option>
                  {vieZona.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-auto">
                {impiantiFiltrati.map((i) => (
                  <label key={i.id} className={`flex items-center gap-2.5 border rounded-xl px-3 py-2 text-xs cursor-pointer transition-colors ${form.impianti_ids.includes(i.id) ? "border-primary bg-accent" : "border-slate-100 hover:border-primary"}`}>
                    <input type="checkbox" data-testid={`pacchetto-imp-${i.id}`} className="w-4 h-4 accent-primary" checked={form.impianti_ids.includes(i.id)} onChange={() => toggleImp(i.id)} />
                    <span className="flex-1"><strong>{i.codice}</strong> · {i.tipologia}<br /><span className="text-slate-500">{i.via}</span></span>
                    <span className="font-semibold">{(i.prezzo || 0).toFixed(0)} €</span>
                  </label>
                ))}
                {impiantiFiltrati.length === 0 && <div className="col-span-full text-xs text-slate-500 p-3">Nessun impianto con questi filtri.</div>}
              </div>
              <div className="mt-4 bg-muted rounded-xl px-5 py-4" data-testid="pacchetto-riepilogo">
                <div className="text-xs font-semibold tracking-normal text-slate-500 mb-2">Riepilogo circuito</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span><strong>{selImp.length}</strong> impianti</span>
                  <span>Formati: {Object.entries(perFormato).map(([f, n]) => `${n} × ${f}`).join(" · ") || "—"}</span>
                  <span>Vie: {[...new Set(selImp.map((i) => i.via).filter(Boolean))].join(", ") || "—"}</span>
                </div>
                <div className="mt-2 font-heading font-semibold text-xl" data-testid="pacchetto-totale-auto">Prezzo totale (auto): {totaleAuto.toFixed(2)} €</div>
              </div>
            </>
          )}
          <div className="mt-4 flex gap-3">
            <button data-testid="pacchetto-submit" className="px-6 py-2.5 font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary transition-colors">Salva circuito</button>
            <button type="button" onClick={() => setForm(null)} className="px-6 py-2.5 font-semibold border border-slate-200 rounded-md hover:border-primary transition-colors">Annulla</button>
          </div>
        </form>
      )}

      <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pacchetti.map((p) => (
          <div key={p.id} className="bg-card border border-slate-100 rounded-xl p-5" data-testid={`pacchetto-card-${p.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold tracking-normal text-brand-foreground">{p.zona_nome}</div>
                <div className="font-heading font-semibold text-lg">{p.nome}</div>
              </div>
              <div className="flex gap-2">
                <button data-testid={`edit-pacchetto-${p.id}`} aria-label="Modifica" onClick={() => setForm({ ...EMPTY, ...p })}
                  className="border border-slate-200 rounded-lg p-1.5 hover:border-primary transition-colors"><Pencil size={13} /></button>
                <button data-testid={`delete-pacchetto-${p.id}`} aria-label="Elimina" onClick={() => remove(p)}
                  className="border border-slate-200 rounded-lg p-1.5 hover:border-destructive hover:text-destructive transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold rounded-md bg-muted px-2.5 py-1">{p.n_impianti} impianti</span>
              <span className="font-heading font-semibold">{p.prezzo_giornaliero} €<span className="text-xs font-normal text-slate-500">/g</span></span>
            </div>
          </div>
        ))}
        {pacchetti.length === 0 && <div className="col-span-full bg-card border border-slate-100 rounded-xl p-8 text-center text-sm text-slate-500">Nessun circuito configurato.</div>}
      </div>
    </BackofficeLayout>
  );
}
