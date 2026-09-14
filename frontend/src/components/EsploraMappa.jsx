import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { imgSrc } from "../lib/api";

const BASE_STYLE = { fillColor: "#DDE8DE", fillOpacity: 1, color: "#8FAE96", weight: 1 };
const ACTIVE_STYLE = { fillColor: "#2F5B41", fillOpacity: 1, color: "#1F3D2B", weight: 1.5 };
const FLAT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const Crumb = ({ label, onClick, active }) => (
  <button type="button" onClick={onClick} disabled={active}
    className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${active ? "bg-[#2F5B41] text-white cursor-default" : "bg-white border border-slate-200 hover:border-[#2F5B41] text-slate-600"}`}>
    {label}
  </button>
);

const PinTooltip = ({ s }) => (
  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
    <div style={{ width: 176 }}>
      <img src={imgSrc(s.foto_url)} alt="" style={{ width: 176, height: 132, objectFit: "cover", borderRadius: 8 }} />
      <div style={{ fontWeight: 800, fontSize: 12, marginTop: 4 }}>{s.nome}</div>
      <div style={{ fontSize: 10, color: "#475569" }}>{s.tipologia}{s.formato ? ` · ${s.formato}` : ""}</div>
      <div style={{ fontSize: 10 }}>{s.zona ? `${s.zona} — ` : ""}<b>{s.canone_giornaliero} €/giorno</b></div>
    </div>
  </Tooltip>
);

export const EsploraMappa = ({ comuni, spazi, regione, comune, zona, onRegione, onComune, onZona,
  selectable = false, selectedIds = [], onToggle, onPinClick, height = 460 }) => {
  const [geo, setGeo] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    fetch("/geo/italy_regions.json").then((r) => r.json()).then(setGeo);
  }, []);

  const comuneObj = comuni.find((c) => c.nome === comune);

  const zone = useMemo(() => {
    if (!comune) return [];
    const map = {};
    spazi.forEach((s) => {
      const z = s.zona || "Altro";
      if (!map[z]) map[z] = { nome: z, lats: [], lngs: [], count: 0 };
      map[z].lats.push(s.lat); map[z].lngs.push(s.lng); map[z].count++;
    });
    return Object.values(map).map((z) => ({
      nome: z.nome, count: z.count,
      lat: z.lats.reduce((a, b) => a + b, 0) / z.lats.length,
      lng: z.lngs.reduce((a, b) => a + b, 0) / z.lngs.length,
    }));
  }, [spazi, comune]);

  const showPins = comune && (zona || zone.length <= 1);
  const pins = zona ? spazi.filter((s) => (s.zona || "Altro") === zona) : spazi;
  const comuniRegione = regione ? comuni.filter((c) => c.regione === regione) : [];

  const onEach = (feature, layer) => {
    const nome = feature.properties.reg_name;
    layer.on({
      mouseover: (e) => { e.target.setStyle(ACTIVE_STYLE); setHovered(nome); },
      mouseout: (e) => { if (nome !== regione) e.target.setStyle(BASE_STYLE); setHovered(null); },
      click: () => onRegione(nome === regione ? null : nome),
    });
    layer.bindTooltip(nome, { sticky: true, direction: "top" });
  };

  const hint = !comune
    ? (regione ? "Clicca un Comune sulla mappa o nella griglia sotto" : "Clicca una regione per iniziare")
    : (!showPins ? "Scegli una zona / quartiere" : "Passa sui pin per vedere la scheda dello spazio");

  return (
    <div className="relative border border-slate-100 rounded-2xl overflow-hidden bg-white" data-testid="esplora-mappa">
      {!comune ? (
        <MapContainer key={`italia-${regione || "all"}`} center={[42.0, 12.5]} zoom={5.6} zoomSnap={0.2}
          style={{ height, width: "100%", background: "#F7F8F6" }} scrollWheelZoom={false} attributionControl={false}>
          {geo && <GeoJSON key={regione || "none"} data={geo}
            style={(f) => (f.properties.reg_name === regione ? ACTIVE_STYLE : BASE_STYLE)} onEachFeature={onEach} />}
          {comuniRegione.map((c) => (
            <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={11}
              eventHandlers={{ click: () => onComune(c.nome) }}
              pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: "#F59E0B", fillOpacity: 1 }}>
              <Tooltip permanent direction="right" offset={[10, 0]} opacity={1} interactive
                eventHandlers={{ click: () => onComune(c.nome) }}>
                <span style={{ fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{c.nome}</span>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      ) : (
        <MapContainer key={`${comune}-${zona || "zone"}`}
          center={[comuneObj?.lat || 42, comuneObj?.lng || 12.5]} zoom={zona ? 13 : 12}
          style={{ height, width: "100%" }} scrollWheelZoom={false} attributionControl={false}>
          <TileLayer url={FLAT_TILES} className="flat-tiles" />
          {!showPins && zone.map((z) => (
            <CircleMarker key={z.nome} center={[z.lat, z.lng]} radius={14}
              eventHandlers={{ click: () => onZona(z.nome) }}
              pathOptions={{ color: "#1F3D2B", weight: 2, fillColor: "#2F5B41", fillOpacity: 0.9 }}>
              <Tooltip permanent direction="right" offset={[12, 0]} opacity={1} interactive
                eventHandlers={{ click: () => onZona(z.nome) }}>
                <span style={{ fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{z.nome} · {z.count}</span>
              </Tooltip>
            </CircleMarker>
          ))}
          {showPins && pins.map((s) => {
            const sel = selectable && selectedIds.includes(s.id);
            return (
              <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={10}
                eventHandlers={{ click: () => (selectable ? onToggle(s.id) : onPinClick?.(s)) }}
                pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: sel ? "#F59E0B" : s.disponibile === false ? "#94A3B8" : "#2F5B41", fillOpacity: 1 }}>
                <PinTooltip s={s} />
              </CircleMarker>
            );
          })}
        </MapContainer>
      )}

      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5" data-testid="mappa-breadcrumb">
        <Crumb label="Italia" active={!regione && !comune} onClick={() => { onRegione(null); }} />
        {regione && <Crumb label={regione} active={!comune} onClick={() => onRegione(regione)} />}
        {comune && <Crumb label={comune} active={!zona} onClick={() => onZona(null)} />}
        {zona && <Crumb label={zona} active onClick={() => {}} />}
      </div>

      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 border border-slate-100 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600" data-testid="mappa-hint">
        {hovered && !comune ? <span className="text-[#2F5B41] font-bold">{hovered} →</span> : hint}
      </div>
    </div>
  );
};
