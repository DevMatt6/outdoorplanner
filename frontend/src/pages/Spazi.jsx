import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { NavBar } from "../components/NavBar";
import { api, imgSrc } from "../lib/api";
import { TIPOLOGIE, FORMATI } from "../lib/catalogo";
import { MapPin, Megaphone } from "lucide-react";

export default function Spazi() {
  const [params, setParams] = useSearchParams();
  const [spazi, setSpazi] = useState([]);
  const [comuni, setComuni] = useState([]);
  const [zone, setZone] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const filters = {
    regione: params.get("regione") || "",
    citta: params.get("citta") || "",
    tipologia: params.get("tipologia") || "",
    formato: params.get("formato") || "",
    zona: params.get("zona") || "",
    q: params.get("q") || "",
  };

  useEffect(() => {
    api.get("/comuni").then(({ data }) => setComuni(data));
  }, []);

  useEffect(() => {
    api.get("/spazi/zone", { params: filters.citta ? { citta: filters.citta } : {} }).then(({ data }) => setZone(data));
  }, [filters.citta]);

  useEffect(() => {
    setLoading(true);
    const query = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) query[k] = v; });
    api.get("/spazi", { params: query }).then(({ data }) => setSpazi(data)).finally(() => setLoading(false));
  }, [params]);

  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k === "citta") next.delete("zona");
    setParams(next);
  };

  const center = useMemo(() => {
    if (spazi.length === 0) return [42.0, 12.5];
    return [spazi.reduce((a, s) => a + s.lat, 0) / spazi.length, spazi.reduce((a, s) => a + s.lng, 0) / spazi.length];
  }, [spazi]);

  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2F5B41] bg-white";

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-heading font-extrabold tracking-tight">
            Spazi disponibili {filters.regione && <span className="text-[#2F5B41]">· {filters.regione}</span>}
          </h1>
          <button data-testid="avvia-campagna-button" onClick={() => navigate("/campagne/nuova")}
            className="inline-flex items-center gap-2 bg-[#2F5B41] text-white rounded-full px-6 py-3 font-bold hover:bg-[#26492F] transition-colors">
            <Megaphone size={17} /> Avvia una campagna
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-1">Prenota un singolo spazio oppure avvia una campagna multi-spazio con un unico flusso.</p>

        <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-4 flex flex-wrap gap-3 items-center" data-testid="filtri-spazi">
          <input data-testid="filter-q" className={input} placeholder="Cerca per nome o indirizzo..."
            defaultValue={filters.q} onKeyDown={(e) => e.key === "Enter" && setFilter("q", e.target.value)} />
          <select data-testid="filter-comune" className={input} value={filters.citta} onChange={(e) => setFilter("citta", e.target.value)}>
            <option value="">Tutti i Comuni</option>
            {comuni.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <select data-testid="filter-tipologia" className={input} value={filters.tipologia} onChange={(e) => setFilter("tipologia", e.target.value)}>
            <option value="">Tipologia impianto</option>
            {TIPOLOGIE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select data-testid="filter-formato" className={input} value={filters.formato} onChange={(e) => setFilter("formato", e.target.value)}>
            <option value="">Formato</option>
            {FORMATI.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select data-testid="filter-zona" className={input} value={filters.zona} onChange={(e) => setFilter("zona", e.target.value)}>
            <option value="">Zona / quartiere</option>
            {zone.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          {filters.regione && (
            <button data-testid="clear-regione" onClick={() => setFilter("regione", "")}
              className="px-3 py-2 text-sm font-semibold rounded-full bg-[#2F5B41] text-white hover:bg-[#26492F] transition-colors">
              {filters.regione} ✕
            </button>
          )}
          <span className="ml-auto text-sm text-slate-500 font-mono" data-testid="risultati-count">{spazi.length} risultati</span>
        </div>

        <div className="mt-6 grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {loading && <div className="text-slate-500 p-8">Caricamento...</div>}
            {!loading && spazi.length === 0 && (
              <div className="border border-slate-100 bg-white rounded-2xl p-10 text-center text-slate-500">Nessuno spazio trovato con questi filtri.</div>
            )}
            {spazi.map((s) => (
              <Link key={s.id} to={`/spazi/${s.id}`} data-testid={`spazio-card-${s.id}`}
                className="grid grid-cols-[140px_1fr] border border-slate-100 bg-white rounded-2xl overflow-hidden hover:border-[#2F5B41] transition-colors group">
                <div className="border-r border-slate-100 overflow-hidden">
                  <img src={imgSrc(s.foto_url)} alt={s.nome} className="w-full h-full object-cover min-h-[120px]" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2F5B41]">{s.tipologia}</div>
                      <h3 className="font-heading font-extrabold text-lg leading-tight group-hover:text-[#1F3D2B] transition-colors">{s.nome}</h3>
                    </div>
                    {!s.disponibile && <span className="text-[10px] font-bold rounded-full bg-[#26292B] text-white px-2.5 py-1">Occupato</span>}
                  </div>
                  <div className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                    <MapPin size={13} /> {s.indirizzo} — {s.citta} ({s.regione}){s.zona ? ` · ${s.zona}` : ""}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold rounded-full bg-[#F5F6F3] px-2.5 py-1 text-slate-600">{s.formato || s.dimensioni}</span>
                    <span className="font-heading font-extrabold text-xl">{s.canone_giornaliero} €<span className="text-xs font-normal text-slate-500">/giorno</span></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="sticky top-24 border border-slate-100 rounded-2xl overflow-hidden">
              <MapContainer key={center.join(",")} center={center} zoom={spazi.length && (filters.regione || filters.citta) ? 9 : 5.5}
                style={{ height: 520 }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {spazi.map((s) => (
                  <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={9}
                    pathOptions={{ color: "#1F3D2B", weight: 1.5, fillColor: s.disponibile ? "#2F5B41" : "#94A3B8", fillOpacity: 1 }}>
                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                      <div style={{ width: 150 }}>
                        <img src={imgSrc(s.foto_url)} alt="" style={{ width: 150, height: 84, objectFit: "cover", borderRadius: 8 }} />
                        <div style={{ fontWeight: 700, fontSize: 12, marginTop: 4 }}>{s.nome}</div>
                        <div style={{ fontSize: 10 }}>{s.zona ? `${s.zona} · ` : ""}{s.canone_giornaliero} €/giorno</div>
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="font-bold">{s.nome}</div>
                      <div className="text-xs">{s.canone_giornaliero} €/giorno · {s.formato}</div>
                      <Link to={`/spazi/${s.id}`} className="text-[#2F5B41] text-xs font-bold">Dettaglio →</Link>
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
