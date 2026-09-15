import { useEffect, useState } from "react";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError, imgSrc } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

const EMPTY = { codice: "", zona_id: "", via: "", lat: "", lng: "", tipologia: "", prezzo: "", foto_url: "", note: "", attivo: true };

const FORMATO_HINT = {
  "Manifesto 200x140": "200x140 cm", "Manifesto 100x140": "100x140 cm", "Manifesto 70x100": "70x100 cm",
  "Maxi Ledwall Stradale": "Ledwall 6x3 m", "Mupi Digitale / Totem Smart": "Mupi 120x180 cm",
  "Schermo su Edicola/Chiosco": 'Schermo 55"', "Impianto Digitale Temporaneo – SCIA": "Ledwall 4x3 m",
  "Poster Maxi 6x3": "6x3 m", "Mega Poster Stradale >18mq": "12x6 m",
};

export default function ComuneImpianti() {
  const [impianti, setImpianti] = useState([]);
  const [zone, setZone] = useState([]);
  const [tipologie, setTipologie] = useState([]);
  const [form, setForm] = useState(null);
  const [filtri, setFiltri] = useState({ zona: "", tipologia: "", formato: "" });

  const load = () => api.get("/comune/impianti").then(({ data }) => setImpianti(data));
  useEffect(() => {
    load();
    api.get("/comune/zone").then(({ data }) => setZone(data));
    api.get("/ooh/tipologie").then(({ data }) => setTipologie(data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = { codice: form.codice, zona_id: form.zona_id, via: form.via, lat: parseFloat(form.lat), lng: parseFloat(form.lng), tipologia: form.tipologia, prezzo: parseFloat(form.prezzo), foto_url: form.foto_url, note: form.note || "", attivo: form.attivo !== false };
    try {
      if (form.id) await api.put(`/comune/impianti/${form.id}`, payload);
      else await api.post("/comune/impianti", payload);
      toast.success("Impianto salvato");
      setForm(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const remove = async (i) => {
    if (!window.confirm(`Eliminare l'impianto ${i.codice}?`)) return;
    try { await api.delete(`/comune/impianti/${i.id}`); toast.success("Impianto eliminato"); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  const zonaNome = (zid) => zone.find((z) => z.id === zid)?.nome || "—";
  const formati = [...new Set(impianti.map((i) => i.formato).filter(Boolean))];
  const visibili = impianti.filter((i) =>
    (!filtri.zona || i.zona_id === filtri.zona) &&
    (!filtri.tipologia || i.tipologia === filtri.tipologia) &&
    (!filtri.formato || i.formato === filtri.formato));
  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1F3BB3] bg-white w-full";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Impianti OOH</h1>
        <button data-testid="nuovo-impianto-button" onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-5 py-2.5 font-bold hover:bg-[#172E93] transition-colors">
          <Plus size={17} /> Nuovo impianto
        </button>
      </div>

      {form && (
        <form onSubmit={submit} className="mt-6 border border-slate-100 bg-white rounded-2xl p-6" data-testid="impianto-form">
          <h2 className="font-heading font-extrabold text-lg mb-4">{form.id ? `Modifica ${form.codice}` : "Nuovo impianto"}</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input data-testid="impianto-codice" className={input} placeholder="Codice (es. RM-EUR-013)" required value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} />
            <select data-testid="impianto-zona" className={input} required value={form.zona_id} onChange={(e) => setForm({ ...form, zona_id: e.target.value })}>
              <option value="">— Zona —</option>
              {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
            </select>
            <select data-testid="impianto-tipologia" className={input} required value={form.tipologia} onChange={(e) => setForm({ ...form, tipologia: e.target.value })}>
              <option value="">— Tipologia —</option>
              {tipologie.map((c) => (
                <optgroup key={c.id} label={c.categoria}>
                  {c.tipi.map((t) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
            <input className={input} placeholder="Via (es. Via dei Sommozzatori)" required value={form.via} onChange={(e) => setForm({ ...form, via: e.target.value })} />
            <input data-testid="impianto-prezzo" className={input} type="number" step="0.5" placeholder="Prezzo € (singolo impianto)" required value={form.prezzo} onChange={(e) => setForm({ ...form, prezzo: e.target.value })} />
            <input className={input} type="number" step="any" placeholder="Latitudine" required value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            <input className={input} type="number" step="any" placeholder="Longitudine" required value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
            <input className={input} placeholder="URL foto" value={form.foto_url} onChange={(e) => setForm({ ...form, foto_url: e.target.value })} />
          </div>
          {form.tipologia && <div className="mt-3 text-xs text-slate-500">Formato derivato dalla tipologia: <strong>{FORMATO_HINT[form.tipologia] || "—"}</strong></div>}
          <div className="mt-4 flex gap-3">
            <button data-testid="impianto-submit" className="px-6 py-2.5 font-bold rounded-full bg-[#1F3BB3] text-white hover:bg-[#172E93] transition-colors">Salva impianto</button>
            <button type="button" onClick={() => setForm(null)} className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#1F3BB3] transition-colors">Annulla</button>
          </div>
        </form>
      )}

      <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-4 flex flex-wrap gap-3 items-center" data-testid="impianti-filtri">
        <select data-testid="filtro-imp-zona" className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" value={filtri.zona} onChange={(e) => setFiltri({ ...filtri, zona: e.target.value })}>
          <option value="">Tutte le zone</option>
          {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
        </select>
        <select data-testid="filtro-imp-tipologia" className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" value={filtri.tipologia} onChange={(e) => setFiltri({ ...filtri, tipologia: e.target.value })}>
          <option value="">Tutte le tipologie</option>
          {tipologie.map((c) => (
            <optgroup key={c.id} label={c.categoria}>
              {c.tipi.map((t) => <option key={t} value={t}>{t}</option>)}
            </optgroup>
          ))}
        </select>
        <select data-testid="filtro-imp-formato" className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" value={filtri.formato} onChange={(e) => setFiltri({ ...filtri, formato: e.target.value })}>
          <option value="">Tutti i formati</option>
          {formati.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="ml-auto text-sm text-slate-500 font-mono" data-testid="impianti-count">{visibili.length} impianti</span>
      </div>

      <div className="mt-4 border border-slate-100 bg-white rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F8F9FD] border-b border-slate-100 text-left">
              {["Impianto", "Zona", "Via", "Tipologia", "Formato", "Prezzo", "Azioni"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibili.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 hover:bg-[#F0F4FF] transition-colors" data-testid={`impianto-row-${i.id}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <img src={imgSrc(i.foto_url)} alt="" className="w-12 h-9 object-cover rounded-lg" />
                    <span className="font-bold font-mono text-xs">{i.codice}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">{zonaNome(i.zona_id)}</td>
                <td className="px-4 py-2.5 text-xs">{i.via}</td>
                <td className="px-4 py-2.5 text-xs">{i.tipologia}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{i.formato}</td>
                <td className="px-4 py-2.5 font-heading font-extrabold">{(i.prezzo || 0).toFixed(2)} €</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button data-testid={`edit-impianto-${i.id}`} onClick={() => setForm({ ...EMPTY, ...i })}
                      className="border border-slate-200 rounded-lg p-1.5 hover:border-[#1F3BB3] transition-colors"><Pencil size={13} /></button>
                    <button data-testid={`delete-impianto-${i.id}`} onClick={() => remove(i)}
                      className="border border-slate-200 rounded-lg p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BackofficeLayout>
  );
}
