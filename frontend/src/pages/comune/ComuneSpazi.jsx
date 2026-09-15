import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError, BACKEND_URL } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

const EMPTY = { nome: "", zona: "", zona_id: "", form_template_id: "", opzioni: {}, indirizzo: "", lat: null, lng: null, canone_giornaliero: 300, descrizione: "", foto_url: "https://images.unsplash.com/photo-1777403705903-9704d002ca8a?crop=entropy&cs=srgb&fm=jpg&q=85" };

const ClickPicker = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
};

const imgSrc = (url) => (url?.startsWith("/api/") ? `${BACKEND_URL}${url}` : url);

export default function ComuneSpazi() {
  const [spazi, setSpazi] = useState([]);
  const [profilo, setProfilo] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [zone, setZone] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/comune/spazi").then(({ data }) => setSpazi(data));
  useEffect(() => {
    load();
    api.get("/comune/profilo").then(({ data }) => setProfilo(data));
    api.get("/comune/form-templates").then(({ data }) => setTemplates(data));
    api.get("/comune/zone").then(({ data }) => setZone(data));
  }, []);

  const uploadFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/comune/spazi/upload-foto", fd);
      setEditing({ ...editing, foto_url: data.url });
      toast.success("Immagine caricata");
    } catch (err) { toast.error(apiError(err)); }
    e.target.value = "";
  };

  const save = async (e) => {
    e.preventDefault();
    if (editing.lat == null) return toast.error("Posiziona lo spazio cliccando sulla mappa");
    try {
      const payload = {
        nome: editing.nome,
        zona: zone.find((z) => z.id === editing.zona_id)?.nome || "",
        zona_id: editing.zona_id || null,
        form_template_id: editing.form_template_id || null,
        opzioni: editing.opzioni || {}, indirizzo: editing.indirizzo,
        lat: editing.lat, lng: editing.lng,
        canone_giornaliero: parseFloat(editing.canone_giornaliero),
        descrizione: editing.descrizione || "", foto_url: editing.foto_url,
      };
      if (editing.id) await api.put(`/comune/spazi/${editing.id}`, payload);
      else await api.post("/comune/spazi", payload);
      toast.success("Spazio salvato");
      setEditing(null);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const remove = async (id) => {
    await api.delete(`/comune/spazi/${id}`);
    toast.success("Spazio eliminato");
    load();
  };

  const input = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1F3BB3] transition-colors bg-white";
  const label = "block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Aree OSP / Progetti Speciali</h1>
        <button data-testid="nuovo-spazio-button" onClick={() => setEditing({ ...EMPTY, lat: profilo?.lat, lng: profilo?.lng })}
          className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-5 py-2.5 font-bold hover:bg-[#172E93] transition-colors">
          <Plus size={17} /> Nuova area OSP
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-6 border border-slate-100 bg-white rounded-2xl p-6 grid lg:grid-cols-2 gap-6" data-testid="spazio-form">
          <div className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg">{editing.id ? "Modifica area OSP" : "Nuova area OSP"}</h2>
            <div className="text-xs text-slate-500 -mt-1">Tipologia assegnata automaticamente: <strong>Progetto Speciale</strong>. Disponibilità gestita a calendario dalle richieste.</div>
            <input data-testid="spazio-nome-input" className={input} placeholder="Nome area (es. Area Eventi Piazza...)" required value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Zona (condivisa del Comune)</label>
                <select data-testid="spazio-zona-select" className={input} value={editing.zona_id || ""} onChange={(e) => setEditing({ ...editing, zona_id: e.target.value })}>
                  <option value="">— Nessuna zona —</option>
                  {zone.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Canone €/giorno</label>
                <input className={input} type="number" step="0.5" required value={editing.canone_giornaliero} onChange={(e) => setEditing({ ...editing, canone_giornaliero: e.target.value })} />
              </div>
            </div>
            <input className={input} placeholder="Indirizzo" required value={editing.indirizzo} onChange={(e) => setEditing({ ...editing, indirizzo: e.target.value })} />
            <div>
              <label className={label}>Modulo associato</label>
              <select data-testid="spazio-modulo-select" className={input} value={editing.form_template_id || ""} onChange={(e) => setEditing({ ...editing, form_template_id: e.target.value })}>
                <option value="">— Modulo predefinito del Comune —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <img src={imgSrc(editing.foto_url)} alt="" className="w-20 h-14 object-cover rounded-lg border border-slate-100" />
              <label className="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-full px-4 py-2 text-sm font-bold hover:border-[#1F3BB3] hover:text-[#1F3BB3] transition-colors">
                <Upload size={15} /> Carica immagine
                <input data-testid="spazio-foto-input" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={uploadFoto} />
              </label>
              <span className="text-xs text-slate-400">JPG, PNG, WebP</span>
            </div>
            <textarea className={input} rows={2} placeholder="Descrizione" value={editing.descrizione || ""} onChange={(e) => setEditing({ ...editing, descrizione: e.target.value })} />
            <div className="flex gap-3 pt-2">
              <button data-testid="salva-spazio-button" className="px-6 py-2.5 font-bold rounded-full bg-[#1F3BB3] text-white hover:bg-[#172E93] transition-colors">Salva</button>
              <button type="button" onClick={() => setEditing(null)} className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#1F3BB3] transition-colors">Annulla</button>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Posizionamento — clicca sulla mappa</div>
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <MapContainer center={[editing.lat || profilo?.lat || 41.9, editing.lng || profilo?.lng || 12.5]} zoom={12} style={{ height: 380 }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="flat-tiles" />
                <ClickPicker onPick={(ll) => setEditing({ ...editing, lat: ll.lat, lng: ll.lng })} />
                {editing.lat != null && <CircleMarker center={[editing.lat, editing.lng]} radius={10} pathOptions={{ color: "#2B4BDB", fillColor: "#1F3BB3", fillOpacity: 1 }} />}
              </MapContainer>
            </div>
            {editing.lat != null && <div className="text-xs font-mono text-slate-500 mt-1">lat {editing.lat.toFixed(5)}, lng {editing.lng.toFixed(5)}</div>}
          </div>
        </form>
      )}

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F8F9FD] border-b border-slate-100 text-left">
              {["Area", "Zona", "Modulo", "Canone", "Azioni"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spazi.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-[#F0F4FF] transition-colors" data-testid={`spazio-row-${s.id}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={imgSrc(s.foto_url)} alt="" className="w-12 h-9 object-cover rounded-lg border border-slate-100" />
                    <div><div className="font-bold">{s.nome}</div><div className="text-xs text-slate-400">{s.indirizzo}</div></div>
                  </div>
                </td>
                <td className="px-4 py-3">{s.zona || "—"}</td>
                <td className="px-4 py-3 text-xs">{templates.find((t) => t.id === s.form_template_id)?.nome || "Predefinito"}</td>
                <td className="px-4 py-3 font-semibold">{s.canone_giornaliero} €/g</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button data-testid={`edit-spazio-${s.id}`} onClick={() => setEditing({ ...EMPTY, ...s })} className="border border-slate-200 rounded-lg p-1.5 hover:border-[#1F3BB3] transition-colors"><Pencil size={14} /></button>
                    <button data-testid={`delete-spazio-${s.id}`} onClick={() => remove(s.id)} className="border border-slate-200 rounded-lg p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors"><Trash2 size={14} /></button>
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
