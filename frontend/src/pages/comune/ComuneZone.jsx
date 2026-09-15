import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Eraser } from "lucide-react";

const FLAT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const EMPTY = { nome: "", descrizione: "", quartiere: "", polygon: [] };

const ClickCapture = ({ onPoint }) => {
  useMapEvents({ click: (e) => onPoint([e.latlng.lat, e.latlng.lng]) });
  return null;
};

export default function ComuneZone() {
  const [zone, setZone] = useState([]);
  const [profilo, setProfilo] = useState(null);
  const [form, setForm] = useState(null);

  const load = () => api.get("/comune/zone").then(({ data }) => setZone(data));
  useEffect(() => { load(); api.get("/comune/profilo").then(({ data }) => setProfilo(data)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if ((form.polygon || []).length < 3) return toast.error("Disegna il confine: servono almeno 3 punti (clicca sulla mappa)");
    const payload = { nome: form.nome, descrizione: form.descrizione, quartiere: form.quartiere, polygon: form.polygon };
    try {
      if (form.id) await api.put(`/comune/zone/${form.id}`, payload);
      else await api.post("/comune/zone", payload);
      toast.success("Zona salvata");
      setForm(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const remove = async (z) => {
    if (!window.confirm(`Eliminare la zona ${z.nome}?`)) return;
    try { await api.delete(`/comune/zone/${z.id}`); toast.success("Zona eliminata"); load(); }
    catch (err) { toast.error(apiError(err)); }
  };

  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1F3BB3] bg-white w-full";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Zone & confini</h1>
        <button data-testid="nuova-zona-button" onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-5 py-2.5 font-bold hover:bg-[#172E93] transition-colors">
          <Plus size={17} /> Nuova zona
        </button>
      </div>

      {form && (
        <form onSubmit={submit} className="mt-6 border border-slate-100 bg-white rounded-2xl p-6" data-testid="zona-form">
          <h2 className="font-heading font-extrabold text-lg mb-4">{form.id ? `Modifica ${form.nome}` : "Nuova zona"}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <input data-testid="zona-nome" className={input} placeholder="Nome zona (es. EUR)" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input className={input} placeholder="Quartiere / Municipio" value={form.quartiere} onChange={(e) => setForm({ ...form, quartiere: e.target.value })} />
          </div>
          <textarea className={`${input} mt-3`} rows={2} placeholder="Descrizione" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
          <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Confine: clicca sulla mappa per aggiungere i vertici ({(form.polygon || []).length} punti)</div>
            <button type="button" data-testid="zona-reset-polygon" onClick={() => setForm({ ...form, polygon: [] })}
              className="inline-flex items-center gap-1.5 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-bold hover:border-[#EF4444] hover:text-[#EF4444] transition-colors">
              <Eraser size={13} /> Cancella confine
            </button>
          </div>
          <div className="mt-2 border border-slate-100 rounded-2xl overflow-hidden">
            <MapContainer center={[profilo?.lat || 41.9, profilo?.lng || 12.5]} zoom={12} style={{ height: 340, width: "100%" }} attributionControl={false}>
              <TileLayer url={FLAT_TILES} className="flat-tiles" />
              <ClickCapture onPoint={(pt) => setForm((f) => ({ ...f, polygon: [...(f.polygon || []), pt] }))} />
              {(form.polygon || []).length >= 2 && (
                <Polygon positions={form.polygon} pathOptions={{ color: "#2B4BDB", fillColor: "#1F3BB3", fillOpacity: 0.35 }} />
              )}
              {zone.filter((z) => z.id !== form.id).map((z) => (
                <Polygon key={z.id} positions={z.polygon} pathOptions={{ color: "#93A6E8", fillColor: "#DCE4F7", fillOpacity: 0.3, weight: 1 }} />
              ))}
            </MapContainer>
          </div>
          <div className="mt-4 flex gap-3">
            <button data-testid="zona-submit" className="px-6 py-2.5 font-bold rounded-full bg-[#1F3BB3] text-white hover:bg-[#172E93] transition-colors">Salva zona</button>
            <button type="button" onClick={() => setForm(null)} className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#1F3BB3] transition-colors">Annulla</button>
          </div>
        </form>
      )}

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {zone.map((z) => (
          <div key={z.id} className="bg-white border border-slate-100 rounded-2xl p-5" data-testid={`zona-card-${z.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-heading font-extrabold text-lg">{z.nome}</div>
                <div className="text-xs text-slate-500">{z.quartiere} · {z.impianti_count} impianti · {z.pacchetti_count} circuiti</div>
              </div>
              <div className="flex gap-2">
                <button data-testid={`edit-zona-${z.id}`} onClick={() => setForm({ id: z.id, nome: z.nome, descrizione: z.descrizione || "", quartiere: z.quartiere || "", polygon: z.polygon || [] })}
                  className="border border-slate-200 rounded-lg p-1.5 hover:border-[#1F3BB3] transition-colors"><Pencil size={14} /></button>
                <button data-testid={`delete-zona-${z.id}`} onClick={() => remove(z)}
                  className="border border-slate-200 rounded-lg p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">Vie (dagli impianti): {(z.vie || []).join(", ") || "—"}</div>
          </div>
        ))}
        {zone.length === 0 && <div className="col-span-full bg-white border border-slate-100 rounded-2xl p-8 text-center text-sm text-slate-500">Nessuna zona configurata.</div>}
      </div>
    </BackofficeLayout>
  );
}
