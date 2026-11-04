import { useConfirm } from "../../components/ConfirmDialog";
import { DataTable } from "../../components/DataTable";
import { CatalogPlanningFields } from "../../components/CampaignBrief";
import { useEffect, useState } from "react";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError, imgSrc } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

const EMPTY = { codice: "", zona_id: "", via: "", lat: "", lng: "", tipologia: "", prezzo: "", foto_url: "", foto_urls_txt: "", giorni_minimi: "1", note: "", attivo: true };

const FORMATO_HINT = {
  "Manifesto 200x140": "200x140 cm", "Manifesto 100x140": "100x140 cm", "Manifesto 70x100": "70x100 cm",
  "Maxi Ledwall Stradale": "Ledwall 6x3 m", "Mupi Digitale / Totem Smart": "Mupi 120x180 cm",
  "Schermo su Edicola/Chiosco": 'Schermo 55"', "Impianto Digitale Temporaneo – SCIA": "Ledwall 4x3 m",
  "Poster Maxi 6x3": "6x3 m", "Mega Poster Stradale >18mq": "12x6 m",
};

export default function ComuneImpianti() {
  const confirm = useConfirm();
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
    const payload = { contesti: form.contesti || [], pubblici: form.pubblici || [], codice: form.codice, zona_id: form.zona_id, via: form.via, lat: parseFloat(form.lat), lng: parseFloat(form.lng), tipologia: form.tipologia, prezzo: parseFloat(form.prezzo), foto_url: form.foto_url, foto_urls: (form.foto_urls_txt || "").split("\n").map((s) => s.trim()).filter(Boolean), giorni_minimi: Math.max(1, parseInt(form.giorni_minimi) || 1), note: form.note || "", attivo: form.attivo !== false };
    try {
      if (form.id) await api.put(`/comune/impianti/${form.id}`, payload);
      else await api.post("/comune/impianti", payload);
      toast.success("Impianto salvato");
      setForm(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const remove = async (i) => {
    if (!(await confirm(`Eliminare l'impianto ${i.codice}?`))) return;
    try { await api.delete(`/comune/impianti/${i.id}`); toast.success("Impianto eliminato"); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  const zonaNome = (zid) => zone.find((z) => z.id === zid)?.nome || "—";
  const formati = [...new Set(impianti.map((i) => i.formato).filter(Boolean))];
  const visibili = impianti.filter((i) =>
    (!filtri.zona || i.zona_id === filtri.zona) &&
    (!filtri.tipologia || i.tipologia === filtri.tipologia) &&
    (!filtri.formato || i.formato === filtri.formato));
  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-card w-full";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-semibold tracking-tight">Impianti OOH</h1>
        <button data-testid="nuovo-impianto-button" onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-5 py-2.5 font-semibold hover:bg-primary transition-colors">
          <Plus size={17} /> Nuovo impianto
        </button>
      </div>

      {form && (
        <form onSubmit={submit} className="mt-6 border border-slate-100 bg-card rounded-xl p-6" data-testid="impianto-form">
          <h2 className="font-heading font-semibold text-lg mb-4">{form.id ? `Modifica ${form.codice}` : "Nuovo impianto"}</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input aria-label="Codice (es. RM-EUR-013)" data-testid="impianto-codice" className={input} placeholder="Codice (es. RM-EUR-013)" required value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} />
            <select aria-label="impianto zona" data-testid="impianto-zona" className={input} required value={form.zona_id} onChange={(e) => setForm({ ...form, zona_id: e.target.value })}>
              <option value="">— Zona —</option>
              {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
            </select>
            <select aria-label="impianto tipologia" data-testid="impianto-tipologia" className={input} required value={form.tipologia} onChange={(e) => setForm({ ...form, tipologia: e.target.value })}>
              <option value="">— Tipologia —</option>
              {tipologie.map((c) => (
                <optgroup key={c.id} label={c.categoria}>
                  {c.tipi.map((t) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              ))}
            </select>
            <input aria-label="Via (es. Via dei Sommozzatori)" className={input} placeholder="Via (es. Via dei Sommozzatori)" required value={form.via} onChange={(e) => setForm({ ...form, via: e.target.value })} />
            <input aria-label="Prezzo € (singolo impianto)" data-testid="impianto-prezzo" className={input} type="number" step="0.5" placeholder="Prezzo € (singolo impianto)" required value={form.prezzo} onChange={(e) => setForm({ ...form, prezzo: e.target.value })} />
            <input aria-label="Latitudine" className={input} type="number" step="any" placeholder="Latitudine" required value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
            <input aria-label="Longitudine" className={input} type="number" step="any" placeholder="Longitudine" required value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
            <input aria-label="URL foto" className={input} placeholder="URL foto" value={form.foto_url} onChange={(e) => setForm({ ...form, foto_url: e.target.value })} />
            <input aria-label="Prenotazione minima (giorni)" data-testid="impianto-giorni-minimi" className={input} type="number" min="1" placeholder="Prenotazione minima (giorni)" value={form.giorni_minimi} onChange={(e) => setForm({ ...form, giorni_minimi: e.target.value })} />
            <textarea aria-label="Altre foto: un URL per riga" data-testid="impianto-foto-urls" className={`${input} sm:col-span-2`} rows={2} placeholder="Altre foto: un URL per riga" value={form.foto_urls_txt} onChange={(e) => setForm({ ...form, foto_urls_txt: e.target.value })} />
          </div>
          <div className="mt-4"><CatalogPlanningFields value={form} onChange={setForm} /></div>
          {form.tipologia && <div className="mt-3 text-xs text-slate-500">Formato derivato dalla tipologia: <strong>{FORMATO_HINT[form.tipologia] || "—"}</strong></div>}
          <div className="mt-4 flex gap-3">
            <button data-testid="impianto-submit" className="px-6 py-2.5 font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary transition-colors">Salva impianto</button>
            <button type="button" onClick={() => setForm(null)} className="px-6 py-2.5 font-semibold border border-slate-200 rounded-md hover:border-primary transition-colors">Annulla</button>
          </div>
        </form>
      )}

      <div className="mt-6 bg-card border border-slate-100 rounded-xl p-4 flex flex-wrap gap-3 items-center" data-testid="impianti-filtri">
        <select aria-label="filtro impianto zona" data-testid="filtro-imp-zona" className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-card" value={filtri.zona} onChange={(e) => setFiltri({ ...filtri, zona: e.target.value })}>
          <option value="">Tutte le zone</option>
          {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
        </select>
        <select aria-label="filtro impianto tipologia" data-testid="filtro-imp-tipologia" className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-card" value={filtri.tipologia} onChange={(e) => setFiltri({ ...filtri, tipologia: e.target.value })}>
          <option value="">Tutte le tipologie</option>
          {tipologie.map((c) => (
            <optgroup key={c.id} label={c.categoria}>
              {c.tipi.map((t) => <option key={t} value={t}>{t}</option>)}
            </optgroup>
          ))}
        </select>
        <select aria-label="filtro impianto formato" data-testid="filtro-imp-formato" className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-card" value={filtri.formato} onChange={(e) => setFiltri({ ...filtri, formato: e.target.value })}>
          <option value="">Tutti i formati</option>
          {formati.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="ml-auto text-sm text-slate-500 tabular-nums" data-testid="impianti-count">{visibili.length} impianti</span>
      </div>

      <div className="mt-4 border border-slate-100 bg-card rounded-xl overflow-hidden overflow-x-auto">
        <DataTable data={visibili} label="Cerca un impianto…" columns={[{ label: "Impianto", key: "codice" }, { label: "Zona", key: "zona_id", value: (row) => zonaNome(row.zona_id) }, { label: "Via", key: "via" }, { label: "Tipologia", key: "tipologia" }, { label: "Formato", key: "formato" }, { label: "Prezzo", key: "prezzo" }, { label: "Azioni" }]} renderRow={(i) => (
<tr key={i.id} className="border-b border-slate-100 hover:bg-accent transition-colors" data-testid={`impianto-row-${i.id}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <img src={imgSrc(i.foto_url)} alt="" className="w-12 h-9 object-cover rounded-lg" />
                    <span className="font-semibold tabular-nums text-xs">{i.codice}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">{zonaNome(i.zona_id)}</td>
                <td className="px-4 py-2.5 text-xs">{i.via}</td>
                <td className="px-4 py-2.5 text-xs">{i.tipologia}</td>
                <td className="px-4 py-2.5 text-xs tabular-nums">{i.formato}</td>
                <td className="px-4 py-2.5 font-heading font-semibold">{(i.prezzo || 0).toFixed(2)} €</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button data-testid={`edit-impianto-${i.id}`} aria-label="Modifica" onClick={() => setForm({ ...EMPTY, ...i })}
                      className="border border-slate-200 rounded-lg p-1.5 hover:border-primary transition-colors"><Pencil size={13} /></button>
                    <button data-testid={`delete-impianto-${i.id}`} aria-label="Elimina" onClick={() => remove(i)}
                      className="border border-slate-200 rounded-lg p-1.5 hover:border-destructive hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
)} />
      </div>
    </BackofficeLayout>
  );
}
