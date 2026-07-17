import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { NavBar } from "../components/NavBar";
import { api } from "../lib/api";
import { MapPin } from "lucide-react";

export default function Spazi() {
  const [params, setParams] = useSearchParams();
  const [spazi, setSpazi] = useState([]);
  const [loading, setLoading] = useState(true);
  const filters = {
    regione: params.get("regione") || "",
    citta: params.get("citta") || "",
    tipologia: params.get("tipologia") || "",
    prezzo_max: params.get("prezzo_max") || "",
    q: params.get("q") || "",
  };

  useEffect(() => {
    setLoading(true);
    const query = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) query[k] = v; });
    api.get("/spazi", { params: query }).then(({ data }) => setSpazi(data)).finally(() => setLoading(false));
  }, [params]);

  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next);
  };

  const center = useMemo(() => {
    if (spazi.length === 0) return [42.0, 12.5];
    return [spazi.reduce((a, s) => a + s.lat, 0) / spazi.length, spazi.reduce((a, s) => a + s.lng, 0) / spazi.length];
  }, [spazi]);

  const tipologie = ["Billboard", "Poster", "Totem", "Suolo pubblico"];
  const input = "border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0033FF] bg-white";

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight">
          Spazi disponibili {filters.regione && <span className="text-[#0A3D91]">· {filters.regione}</span>}
        </h1>
        <div className="mt-6 border border-slate-900 bg-white p-4 flex flex-wrap gap-3 items-center" data-testid="filtri-spazi">
          <input data-testid="filter-q" className={input} placeholder="Cerca per nome, indirizzo, città..."
            defaultValue={filters.q} onKeyDown={(e) => e.key === "Enter" && setFilter("q", e.target.value)} />
          <select data-testid="filter-tipologia" className={input} value={filters.tipologia} onChange={(e) => setFilter("tipologia", e.target.value)}>
            <option value="">Tutte le tipologie</option>
            {tipologie.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select data-testid="filter-prezzo" className={input} value={filters.prezzo_max} onChange={(e) => setFilter("prezzo_max", e.target.value)}>
            <option value="">Qualsiasi prezzo</option>
            <option value="30">Fino a 30 €/g</option>
            <option value="60">Fino a 60 €/g</option>
            <option value="120">Fino a 120 €/g</option>
          </select>
          {filters.regione && (
            <button data-testid="clear-regione" onClick={() => setFilter("regione", "")}
              className="px-3 py-2 text-sm font-semibold border border-slate-900 bg-slate-900 text-white hover:bg-white hover:text-slate-900 transition-colors">
              {filters.regione} ✕
            </button>
          )}
          <span className="ml-auto text-sm text-slate-500 font-mono" data-testid="risultati-count">{spazi.length} risultati</span>
        </div>

        <div className="mt-6 grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {loading && <div className="text-slate-500 p-8">Caricamento...</div>}
            {!loading && spazi.length === 0 && (
              <div className="border border-slate-300 bg-white p-10 text-center text-slate-500">Nessuno spazio trovato con questi filtri.</div>
            )}
            {spazi.map((s) => (
              <Link key={s.id} to={`/spazi/${s.id}`} data-testid={`spazio-card-${s.id}`}
                className="grid grid-cols-[140px_1fr] border border-slate-300 bg-white hover:border-slate-900 transition-colors group">
                <div className="border-r border-slate-300 overflow-hidden">
                  <img src={s.foto_url} alt={s.nome} className="w-full h-full object-cover min-h-[120px]" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0033FF]">{s.tipologia}</div>
                      <h3 className="font-heading font-extrabold text-lg leading-tight group-hover:text-[#0A3D91] transition-colors">{s.nome}</h3>
                    </div>
                    {!s.disponibile && <span className="text-[10px] font-bold uppercase bg-slate-900 text-white px-2 py-1">Occupato</span>}
                  </div>
                  <div className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                    <MapPin size={13} /> {s.indirizzo} — {s.citta} ({s.regione})
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{s.dimensioni}</span>
                    <span className="font-heading font-extrabold text-xl">{s.canone_giornaliero} €<span className="text-xs font-normal text-slate-500">/giorno</span></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="sticky top-24 border border-slate-900">
              <MapContainer key={center.join(",")} center={center} zoom={spazi.length && filters.regione ? 9 : 5.5}
                style={{ height: 520 }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {spazi.map((s) => (
                  <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={9}
                    pathOptions={{ color: "#020617", weight: 1.5, fillColor: s.disponibile ? "#0033FF" : "#94A3B8", fillOpacity: 1 }}>
                    <Popup>
                      <div className="font-bold">{s.nome}</div>
                      <div className="text-xs">{s.canone_giornaliero} €/giorno</div>
                      <Link to={`/spazi/${s.id}`} className="text-[#0033FF] text-xs font-bold">Dettaglio →</Link>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
