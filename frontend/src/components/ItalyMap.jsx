import { useEffect, useState } from "react";
import { MapContainer, GeoJSON } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import { api } from "../lib/api";

const BASE_STYLE = { fillColor: "#DDE8DE", fillOpacity: 1, color: "#8FAE96", weight: 1 };
const HOVER_STYLE = { fillColor: "#2F5B41", fillOpacity: 1, color: "#1F3D2B", weight: 1.5 };

export const ItalyMap = () => {
  const [geo, setGeo] = useState(null);
  const [counts, setCounts] = useState({});
  const [hovered, setHovered] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/geo/italy_regions.json").then((r) => r.json()).then(setGeo);
    api.get("/geo/regioni").then(({ data }) => setCounts(data)).catch(() => {});
  }, []);

  const onEach = (feature, layer) => {
    const nome = feature.properties.reg_name;
    layer.on({
      mouseover: (e) => {
        e.target.setStyle(HOVER_STYLE);
        setHovered(nome);
      },
      mouseout: (e) => {
        e.target.setStyle(BASE_STYLE);
        setHovered(null);
      },
      click: () => navigate(`/spazi?regione=${encodeURIComponent(nome)}`),
    });
    layer.bindTooltip(`${nome}`, { sticky: true, direction: "top" });
  };

  return (
    <div className="relative border border-slate-100 rounded-2xl overflow-hidden" data-testid="italy-map">
      <MapContainer center={[42.0, 12.5]} zoom={5.4} zoomSnap={0.2} style={{ height: 560, width: "100%" }}
        scrollWheelZoom={false} zoomControl={true} attributionControl={false}>
        {geo && <GeoJSON data={geo} style={() => BASE_STYLE} onEachFeature={onEach} />}
      </MapContainer>
      <div className="absolute bottom-4 left-4 z-[1000] bg-white border border-slate-100 rounded-2xl overflow-hidden px-4 py-3 min-w-[220px]">
        {hovered ? (
          <>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Regione</div>
            <div className="font-heading font-extrabold text-xl" data-testid="hovered-region">{hovered}</div>
            <div className="text-sm text-slate-600">
              {counts[hovered] ? `${counts[hovered]} spazi disponibili` : "Nessuno spazio attivo"}
            </div>
            <div className="text-xs font-semibold text-[#2F5B41] mt-1">Clicca per esplorare →</div>
          </>
        ) : (
          <div className="text-sm text-slate-600">Passa il mouse su una regione<br />e clicca per filtrare gli spazi</div>
        )}
      </div>
    </div>
  );
};
