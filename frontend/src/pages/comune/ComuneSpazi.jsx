import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const EMPTY = { nome: "", tipologia: "Billboard", indirizzo: "", lat: null, lng: null, canone_giornaliero: 50, dimensioni: "", descrizione: "", disponibile: true, foto_url: "https://images.unsplash.com/photo-1699480114704-ac153307d2a0?crop=entropy&cs=srgb&fm=jpg&q=85" };

const ClickPicker = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
};

export default function ComuneSpazi() {
  const [spazi, setSpazi] = useState([]);
  const [profilo, setProfilo] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/comune/spazi").then(({ data }) => setSpazi(data));
  useEffect(() => {
    load();
    api.get("/comune/profilo").then(({ data }) => setProfilo(data));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (editing.lat == null) return toast.error("Posiziona lo spazio cliccando sulla mappa");
    try {
      const payload = { ...editing, canone_giornaliero: parseFloat(editing.canone_giornaliero) };
      delete payload.id; delete payload.comune_id; delete payload.citta; delete payload.regione; delete payload.created_at;
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

  const input = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2F5B41] transition-colors";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Catalogo spazi</h1>
        <button data-testid="nuovo-spazio-button" onClick={() => setEditing({ ...EMPTY, lat: profilo?.lat, lng: profilo?.lng })}
          className="inline-flex items-center gap-2 bg-[#2F5B41] text-white rounded-full px-5 py-2.5 font-bold hover:bg-[#26492F] transition-colors">
          <Plus size={17} /> Nuovo spazio
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-6 border border-slate-100 bg-white rounded-2xl p-6 grid lg:grid-cols-2 gap-6" data-testid="spazio-form">
          <div className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg">{editing.id ? "Modifica spazio" : "Nuovo spazio"}</h2>
            <input data-testid="spazio-nome-input" className={input} placeholder="Nome spazio" required value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className={input} value={editing.tipologia} onChange={(e) => setEditing({ ...editing, tipologia: e.target.value })}>
                {["Billboard", "Poster", "Totem", "Suolo pubblico"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <input className={input} type="number" step="0.5" placeholder="€/giorno" required value={editing.canone_giornaliero} onChange={(e) => setEditing({ ...editing, canone_giornaliero: e.target.value })} />
            </div>
            <input className={input} placeholder="Indirizzo" required value={editing.indirizzo} onChange={(e) => setEditing({ ...editing, indirizzo: e.target.value })} />
            <input className={input} placeholder="Dimensioni (es. 6x3 m)" value={editing.dimensioni} onChange={(e) => setEditing({ ...editing, dimensioni: e.target.value })} />
            <textarea className={input} rows={2} placeholder="Descrizione" value={editing.descrizione} onChange={(e) => setEditing({ ...editing, descrizione: e.target.value })} />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="w-4 h-4 accent-[#2F5B41]" checked={editing.disponibile} onChange={(e) => setEditing({ ...editing, disponibile: e.target.checked })} />
              Disponibile
            </label>
            <div className="flex gap-3 pt-2">
              <button data-testid="salva-spazio-button" className="px-6 py-2.5 font-bold rounded-full bg-[#2F5B41] text-white hover:bg-[#26492F] transition-colors">Salva</button>
              <button type="button" onClick={() => setEditing(null)} className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#2F5B41] transition-colors">Annulla</button>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Posizionamento — clicca sulla mappa</div>
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <MapContainer center={[editing.lat || profilo?.lat || 41.9, editing.lng || profilo?.lng || 12.5]} zoom={12} style={{ height: 320 }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ClickPicker onPick={(ll) => setEditing({ ...editing, lat: ll.lat, lng: ll.lng })} />
                {editing.lat != null && <CircleMarker center={[editing.lat, editing.lng]} radius={10} pathOptions={{ color: "#020617", fillColor: "#2F5B41", fillOpacity: 1 }} />}
              </MapContainer>
            </div>
            {editing.lat != null && <div className="text-xs font-mono text-slate-500 mt-1">lat {editing.lat.toFixed(5)}, lng {editing.lng.toFixed(5)}</div>}
          </div>
        </form>
      )}

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#FAFAF8] border-b border-slate-100 text-left">
              {["Nome", "Tipologia", "Indirizzo", "Canone", "Stato", "Azioni"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spazi.map((s) => (
              <tr key={s.id} className="border-b border-slate-200 hover:bg-[#F1F5F0] transition-colors" data-testid={`spazio-row-${s.id}`}>
                <td className="px-4 py-3 font-bold">{s.nome}</td>
                <td className="px-4 py-3">{s.tipologia}</td>
                <td className="px-4 py-3 text-slate-600">{s.indirizzo}</td>
                <td className="px-4 py-3 font-semibold">{s.canone_giornaliero} €/g</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 ${s.disponibile ? "bg-[#D8EADB] text-[#1F5B33]" : "bg-[#26292B] text-white"}`}>
                    {s.disponibile ? "Disponibile" : "Occupato"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button data-testid={`edit-spazio-${s.id}`} onClick={() => setEditing(s)} className="border border-slate-200 rounded-xl p-1.5 hover:border-[#2F5B41] transition-colors"><Pencil size={14} /></button>
                    <button data-testid={`delete-spazio-${s.id}`} onClick={() => remove(s.id)} className="border border-slate-200 rounded-xl p-1.5 hover:border-[#EF4444] hover:text-[#EF4444] transition-colors"><Trash2 size={14} /></button>
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
