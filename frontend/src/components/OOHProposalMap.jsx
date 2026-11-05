import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const COLORS = ["#2563eb", "#c2410c", "#7c3aed", "#047857", "#be185d", "#0e7490"];
export const hasCoordinates = (item) => typeof item.lat === "number" && typeof item.lng === "number" && Number.isFinite(item.lat) && Number.isFinite(item.lng) && Math.abs(item.lat) <= 90 && Math.abs(item.lng) <= 180;
export function groupCircuits(items) {
  const groups = new Map();
  items.forEach((item) => {
    const id = item.pacchetto_id || item.id;
    if (!groups.has(id)) groups.set(id, { id, nome: item.circuito_nome || item.nome || "Circuito", items: [], color: COLORS[groups.size % COLORS.length] });
    groups.get(id).items.push(item);
  });
  return [...groups.values()];
}
function FitProposal({ points, city }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (points.length) map.fitBounds(points.map(i => [i.lat, i.lng]), { padding: [35, 35], maxZoom: 16 });
    else map.setView(hasCoordinates(city || {}) ? [city.lat, city.lng] : [42.5, 12.5], 11);
  }, [map, points, city]);
  return null;
}
export function OOHProposalMap({ proposal, comuni, busy, onExclude }) {
  const [cityId, setCityId] = useState(null);
  const [circuitId, setCircuitId] = useState(null);
  const activeCity = comuni.find(c => c.id === cityId) || comuni[0];
  const items = useMemo(() => (proposal?.items || []).filter(i => i.comune_id === activeCity?.id), [proposal, activeCity]);
  const groups = useMemo(() => groupCircuits(items), [items]);
  useEffect(() => { if (circuitId && !groups.some(g => g.id === circuitId)) setCircuitId(null); }, [groups, circuitId]);
  const visible = groups.filter(g => !circuitId || g.id === circuitId);
  const points = useMemo(() => groups.flatMap(g => !circuitId || g.id === circuitId ? g.items.filter(hasCoordinates) : []), [groups, circuitId]);
  if (!proposal) return null;
  return <div className="space-y-4" data-testid="ooh-proposal-map">
    <div className="flex flex-wrap gap-2" aria-label="Comuni della proposta">
      {comuni.map(c => <button key={c.id} type="button" aria-pressed={activeCity?.id === c.id} onClick={() => { setCityId(c.id); setCircuitId(null); }} className={`rounded-md border px-4 py-2 text-sm font-semibold ${activeCity?.id === c.id ? "bg-primary text-primary-foreground" : "bg-card"}`}>{c.nome} · {(proposal.items || []).filter(i => i.comune_id === c.id).length} impianti</button>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="space-y-2">
        <button type="button" aria-pressed={!circuitId} onClick={() => setCircuitId(null)} className="w-full rounded-md border px-3 py-2 text-left text-sm font-semibold">Tutti i circuiti di {activeCity?.nome}</button>
        {groups.map(g => <button key={g.id} type="button" aria-pressed={circuitId === g.id} onClick={() => setCircuitId(circuitId === g.id ? null : g.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${circuitId === g.id ? "bg-accent ring-1 ring-primary" : "bg-card"}`}><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: g.color }} /><strong>{g.nome}</strong><span className="mt-1 block text-xs text-muted-foreground">{g.items.length} impianti · {g.items.reduce((sum, i) => sum + i.costo, 0).toFixed(2)} €</span></button>)}
        {!items.length && <p className="text-sm text-muted-foreground">Nessun impianto consigliato per questo Comune. Prova a ricalcolare o modifica il brief.</p>}
      </aside>
      <div className="min-w-0">
        <div className="relative z-0 h-[460px] overflow-hidden rounded-xl border" aria-label={`Mappa della proposta per ${activeCity?.nome || "Comune"}`}>
          <MapContainer center={[42.5, 12.5]} zoom={6} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
            <FitProposal points={points} city={activeCity} />
            {visible.map(g => <Polyline key={g.id} positions={g.items.filter(hasCoordinates).map(i => [i.lat, i.lng])} pathOptions={{ color: g.color, weight: 3, opacity: 0.65, dashArray: "6 6" }} />)}
            {visible.flatMap(g => g.items.filter(hasCoordinates).map(i => <CircleMarker key={i.id} center={[i.lat, i.lng]} radius={9} pathOptions={{ color: "#fff", weight: 2, fillColor: g.color, fillOpacity: 1 }}>
              <Popup><div className="space-y-2"><strong>{i.codice || i.nome}</strong><div>{g.nome}</div><div>{i.indirizzo || i.via} · {i.formato}</div><div>{i.costo.toFixed(2)} € nel periodo</div><ul>{(i.motivi || []).map((r, n) => <li key={n}>{r}</li>)}</ul><button type="button" disabled={busy} onClick={() => onExclude(i.id)} className="font-semibold text-destructive">Escludi e cerca un’alternativa</button></div></Popup>
            </CircleMarker>))}
          </MapContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Ogni colore identifica un circuito. I collegamenti mostrano la distribuzione degli impianti proposti: sono indicativi e non rappresentano un percorso o una copertura pubblicitaria misurata. Clicca un punto per dettagli e alternative.</p>
        {items.some(i => !hasCoordinates(i)) && <div className="mt-3 rounded-lg border p-3 text-sm"><strong>Impianti senza coordinate</strong>{items.filter(i => !hasCoordinates(i)).map(i => <div key={i.id} className="mt-2 flex flex-wrap justify-between gap-2"><span>{i.codice || i.nome} · {i.circuito_nome} · {i.costo.toFixed(2)} €</span><button type="button" disabled={busy} onClick={() => onExclude(i.id)} className="text-destructive">Escludi e cerca un’alternativa</button></div>)}</div>}
      </div>
    </div>
  </div>;
}
