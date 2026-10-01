import { CampaignBrief, BudgetSummary, RecommendationPanel, initialBrief, briefPayload, briefError, catalogCompatible } from "../../components/CampaignBrief";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { UserShell } from "../../components/BackofficeLayout";
import { DateRangePicker, fmtDay } from "../../components/DateRangePicker";
import { api, apiError, imgSrc } from "../../lib/api";
import { toast } from "sonner";
import { Landmark, Check, ChevronDown, ChevronUp, MapPin, ImageOff, Info, X } from "lucide-react";

const STEPS = [[0,"Obiettivo e budget"],[1,"Periodo"],[2,"Comuni"],[3,"Proposta"],[4,"Circuiti"],[5,"Riepilogo"]];
const FLAT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const ZoomTracker = ({ onZoom }) => {
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) });
  return null;
};

const centroide = (poly) => {
  const lat = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const lng = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  return [lat, lng];
};

const clusterIcon = (n) => L.divIcon({
  className: "",
  html: `<div style="width:38px;height:38px;border-radius:50%;background:#1F3BB3;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:0 2px 8px rgba(31,59,179,.45)">${n}</div>`,
  iconSize: [38, 38], iconAnchor: [19, 19],
});

const Thumb = ({ src, className }) => {
  if (!src) return <span className={`${className} bg-[#F0F4FF] flex items-center justify-center text-[#93A6E8] shrink-0`}><ImageOff size={13} /></span>;
  return <img src={imgSrc(src)} alt="" className={`${className} shrink-0`}
    onError={(e) => { e.currentTarget.outerHTML = '<span class="' + className + ' bg-[#F0F4FF] rounded-lg shrink-0"></span>'; }} />;
};

export default function OOHPlanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState(initialBrief);
  const [proposal, setProposal] = useState(null);
  const [excluded, setExcluded] = useState([]);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalError, setProposalError] = useState("");
  const [nome, setNome] = useState("");
  const [range, setRange] = useState();
  const [comuni, setComuni] = useState([]);
  const [regioneSel, setRegioneSel] = useState(null);
  const [comuniSel, setComuniSel] = useState([]);
  const [comuneIdx, setComuneIdx] = useState(0);
  const [zone, setZone] = useState({});
  const [pacchetti, setPacchetti] = useState({});
  const [zonaSel, setZonaSel] = useState({});
  const [selected, setSelected] = useState([]);
  const [impSel, setImpSel] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapZoom, setMapZoom] = useState(12);
  const [dettaglio, setDettaglio] = useState(null);

  const dal = fmtDay(range?.from);
  const al = fmtDay(range?.to);
  const giorni = range?.from && range?.to ? Math.floor((range.to - range.from) / 86400000) + 1 : 0;

  useEffect(() => {
    api.get("/comuni").then(({ data }) => setComuni(data));
  }, []);

  useEffect(() => {
    if (step !== 4 && step !== 3) return;
    comuniSel.forEach(async (cid) => {
      try {
      const [z, p] = await Promise.all([
        api.get(`/ooh/zone?comune_id=${cid}`),
        api.get(`/ooh/pacchetti`, { params: { comune_id: cid, data_inizio: dal, data_fine: al } }),
      ]);
      setZone((x) => ({ ...x, [cid]: z.data }));
      setPacchetti((x) => ({ ...x, [cid]: p.data }));
      } catch (e) { setError(apiError(e)); }
    });
  }, [step, comuniSel, dal, al]);

  const toggleComune = (id) => setComuniSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const liberiIds = (p) => p.impianti.filter((i) => catalogCompatible(i, brief, "OOH", giorni)).map((i) => i.id);
  const togglePacchetto = (p) => {
    if (selected.includes(p.id)) {
      setSelected((s) => s.filter((x) => x !== p.id));
      setImpSel((m) => { const n = { ...m }; delete n[p.id]; return n; });
    } else {
      setSelected((s) => [...s, p.id]);
      setImpSel((m) => ({ ...m, [p.id]: liberiIds(p) }));
    }
  };
  const toggleImpianto = (p, iid) => {
    if (!selected.includes(p.id)) {
      setSelected((s) => [...s, p.id]);
      setImpSel((m) => ({ ...m, [p.id]: [iid] }));
      return;
    }
    const cur = impSel[p.id] ?? liberiIds(p);
    const nextIds = cur.includes(iid) ? cur.filter(x => x !== iid) : [...cur, iid];
    setImpSel(m => ({ ...m, [p.id]: nextIds }));
    if (!nextIds.length) setSelected(ids => ids.filter(id => id !== p.id));
  };

  const tuttiPacchetti = useMemo(() => Object.values(pacchetti).flat(), [pacchetti]);
  const pacchettiSel = tuttiPacchetti.filter((p) => selected.includes(p.id));
  const prezzoSel = (p) => {
    const ids = impSel[p.id];
    if (!ids) return p.prezzo_giornaliero;
    return p.impianti.filter((i) => ids.includes(i.id)).reduce((a, i) => a + (i.prezzo || 0), 0);
  };
  const totale = pacchettiSel.reduce((a, p) => a + prezzoSel(p) * giorni, 0);
  const perCity = {};
  pacchettiSel.forEach(p => { const name = comuni.find(c => c.id === p.comune_id)?.nome || p.comune_id; perCity[name] = (perCity[name] || 0) + prezzoSel(p) * giorni; });

  const regioni = useMemo(() => [...new Set(comuni.map((c) => c.regione))].sort(), [comuni]);
  const circuitiDelComune = (cid) => pacchettiSel.filter((p) => p.comune_id === cid);

  const calculate = async (omit = []) => {
    setProposalBusy(true); setProposalError(""); setProposal(null);
    try {
      const { data } = await api.post("/planning/recommend", { tipo: "OOH", brief: briefPayload(brief, comuniSel), data_inizio: dal, data_fine: al, esclusi: omit });
      const names = Object.fromEntries(comuni.map(c => [c.id, c.nome]));
      data.avvisi = data.avvisi.map(w => Object.entries(names).reduce((text, [id, name]) => text.replaceAll(id, name), w));
      setProposal(data);
    } catch (e) { setProposalError(apiError(e)); } finally { setProposalBusy(false); }
  };
  const applyProposal = () => {
    if (!proposal?.fattibile) return;
      const grouped = {};
      proposal.items.forEach(i => { grouped[i.pacchetto_id] = [...(grouped[i.pacchetto_id] || []), i.id]; });
      setSelected(Object.keys(grouped)); setImpSel(grouped); setComuneIdx(0);
    setStep(4);
  };
  const excludeSuggestion = (id) => { const omit = [...excluded, id]; setExcluded(omit); calculate(omit); };
  const next = async () => {
    setError("");
    if (step === 0) {
      const invalid = briefError(brief);
      if (invalid) return setError(invalid);
      setStep(1);
    } else if (step === 1) {
      if (!nome.trim()) return setError("Dai un nome alla campagna");
      if (!dal || !al) return setError("Seleziona il periodo sul calendario");
      if (al < dal) return setError("Periodo non valido");
      setSelected([]); setProposal(null); setExcluded([]);
      setStep(2);
    } else if (step === 2) {
      if (comuniSel.length === 0) return setError("Seleziona almeno un Comune");
      setComuneIdx(0);
      setSelected([]); setImpSel({}); setExcluded([]);
      setStep(3); calculate([]);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      const cid = comuniSel[comuneIdx];
      if (totale > Number(brief.budget) + 0.001) return setError("La selezione supera il budget massimo");
      if (brief.distribuzione === "tutti" && circuitiDelComune(cid).length === 0) return setError(`Seleziona almeno un circuito per ${comuneNome(cid)} (oppure torna indietro e deseleziona il Comune)`);
      if (circuitiDelComune(cid).some((p) => (impSel[p.id] || liberiIds(p)).length === 0)) return setError("Seleziona almeno un impianto per ogni circuito");
      if (comuneIdx < comuniSel.length - 1) {
        setComuneIdx(comuneIdx + 1);
        setExpanded(null);
      } else {
        setStep(5);
      }
    } else if (step === 5) {
      if (!selected.some(id => (impSel[id] || []).length)) return setError("Seleziona almeno un impianto");
      if (totale > Number(brief.budget) + 0.001) return setError("La selezione supera il budget massimo");
      setBusy(true);
      try {
        const { data } = await api.post("/ooh/campagne", { nome, data_inizio: dal, data_fine: al, pacchetti_ids: selected.filter(id => (impSel[id] || []).length > 0), impianti_sel: impSel, brief: briefPayload(brief, comuniSel) });
        toast.success(`Campagna generata: impianti opzionati`);
        navigate(`/campagne/ooh/${data.id}`);
      } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
    }
  };

  const input = "border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1F3BB3] transition-colors bg-white";
  const comuneNome = (cid) => comuni.find((c) => c.id === cid)?.nome || "";

  return (
    <UserShell>
      <div className="max-w-7xl mx-auto" data-testid="ooh-planner">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Campagna OOH</div>
        <h1 className="text-3xl font-heading font-extrabold tracking-tight mt-1">Pianifica una campagna</h1>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 bg-white border border-slate-100 rounded-2xl overflow-hidden" data-testid="ooh-steps">
          {STEPS.map(([stage, s], i) => (
            <div key={s} className={`py-3 px-2 text-center text-[11px] font-bold uppercase tracking-wider transition-colors
              ${stage === step ? "bg-[#1F3BB3] text-white" : stage < step ? "bg-[#2B4BDB] text-white" : "text-slate-400"}`}>
              {i + 1}. {s}
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-8">
          {step === 3 && <RecommendationPanel proposal={proposal} busy={proposalBusy} error={proposalError} onCalculate={() => { setExcluded([]); calculate([]); }} onApply={applyProposal} onExclude={excludeSuggestion} cityName={comuneNome} />}
          {step >= 4 && <div className="mb-5"><BudgetSummary brief={brief} total={totale} perCity={perCity} /></div>}
          {step === 0 && <CampaignBrief value={brief} onChange={setBrief} tipo="OOH" />}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Nome e periodo</h2>
              <input data-testid="ooh-nome-input" className={`${input} w-full max-w-md`} placeholder="Nome campagna (es. Lancio autunno)"
                value={nome} onChange={(e) => setNome(e.target.value)} />
              <DateRangePicker value={range} onChange={setRange} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Scegli prima la regione</h2>
              <div className="flex flex-wrap gap-2" data-testid="ooh-regioni">
                {regioni.map((r) => (
                  <button key={r} type="button" data-testid={`ooh-regione-${r}`} onClick={() => setRegioneSel(regioneSel === r ? null : r)}
                    className={`px-4 py-2 text-sm font-bold rounded-full border transition-colors ${regioneSel === r ? "bg-[#1F3BB3] text-white border-[#1F3BB3]" : "bg-white border-slate-200 hover:border-[#1F3BB3]"}`}>
                    {r} · {comuni.filter((c) => c.regione === r).length}
                  </button>
                ))}
                {regioni.length === 0 && <span className="text-sm text-slate-500">Nessun comune attivo al momento.</span>}
              </div>
              {regioneSel && (
                <>
                  <h2 className="font-heading font-extrabold text-xl">Comuni attivi in {regioneSel} (anche più di uno)</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="ooh-comuni-grid">
                    {comuni.filter((c) => c.regione === regioneSel).map((c) => (
                      <button key={c.id} type="button" data-testid={`ooh-comune-${c.id}`} onClick={() => toggleComune(c.id)}
                        className={`border rounded-2xl p-6 text-left transition-colors relative ${comuniSel.includes(c.id) ? "border-[#1F3BB3] ring-2 ring-[#1F3BB3]/30 bg-[#F0F4FF]" : "border-slate-100 hover:border-[#1F3BB3]"}`}>
                        {comuniSel.includes(c.id) && <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#1F3BB3] text-white flex items-center justify-center"><Check size={13} /></span>}
                        {c.logo_url ? <img src={imgSrc(c.logo_url)} alt="" className="w-10 h-10 rounded-xl object-contain border border-slate-100 bg-white" />
                          : <span className="w-10 h-10 rounded-xl bg-[#F0F4FF] flex items-center justify-center text-[#1F3BB3]"><Landmark size={18} /></span>}
                        <div className="font-heading font-extrabold mt-3">{c.nome}</div>
                        <div className="text-xs text-slate-500">{c.regione}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {comuniSel.length > 0 && (
                <div className="bg-[#F8F9FD] rounded-xl px-5 py-3 text-sm font-bold" data-testid="ooh-comuni-selezionati">
                  {comuniSel.length} comuni selezionati: <span className="font-normal text-slate-600">{comuniSel.map((id) => comuneNome(id)).join(" · ")}</span>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-8">
              {comuniSel.length > 1 && (
                <div className="flex flex-wrap items-center gap-2" data-testid="ooh-substeps">
                  {comuniSel.map((cid, i) => (
                    <span key={cid} className={`text-[11px] font-bold uppercase tracking-wider rounded-full px-3 py-1.5 transition-colors
                      ${i === comuneIdx ? "bg-[#1F3BB3] text-white" : i < comuneIdx ? "bg-[#E8EFFF] text-[#1F3BB3]" : "bg-slate-100 text-slate-400"}`}>
                      {i + 1}. {comuneNome(cid)}{circuitiDelComune(cid).length > 0 ? " ✓" : ""}
                    </span>
                  ))}
                </div>
              )}
              {[comuniSel[comuneIdx]].filter(Boolean).map((cid) => {
                const zs = zone[cid] || [];
                const zsel = zonaSel[cid] || null;
                const pacs = (pacchetti[cid] || []).filter((p) => !zsel || p.zona_id === zsel);
                const zonaObj = zs.find((z) => z.id === zsel);
                const comune = comuni.find((c) => c.id === cid);
                return (
                  <div key={cid} data-testid={`ooh-sezione-${cid}`}>
                    <h2 className="font-heading font-extrabold text-xl">
                      {comuniSel.length > 1 && <span className="text-slate-400">Comune {comuneIdx + 1} di {comuniSel.length} · </span>}
                      {comuneNome(cid)} — zone e circuiti
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setZonaSel({ ...zonaSel, [cid]: null })}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors ${!zsel ? "bg-[#1F3BB3] text-white border-[#1F3BB3]" : "bg-white border-slate-200 hover:border-[#1F3BB3]"}`}>
                        Tutte le zone
                      </button>
                      {zs.map((z) => (
                        <button key={z.id} type="button" data-testid={`ooh-zona-${z.id}`} onClick={() => setZonaSel({ ...zonaSel, [cid]: z.id })}
                          className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors ${zsel === z.id ? "bg-[#1F3BB3] text-white border-[#1F3BB3]" : "bg-white border-slate-200 hover:border-[#1F3BB3]"}`}>
                          {z.nome} · {z.pacchetti_count}
                        </button>
                      ))}
                    </div>
                    {zonaObj && (
                      <div className="mt-2 text-xs text-slate-500">
                        {zonaObj.quartiere} — vie principali: {zonaObj.vie.join(", ")}
                      </div>
                    )}
                    <div className="mt-4 border border-slate-100 rounded-2xl overflow-hidden aspect-[16/10] w-full">
                      <MapContainer key={`${cid}-${zsel || "all"}`} center={[zonaObj ? zonaObj.polygon[0][0] + 0.008 : comune?.lat, zonaObj ? zonaObj.polygon[0][1] + 0.011 : comune?.lng]}
                        zoom={zsel ? 14 : 12} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} attributionControl={false}>
                        <TileLayer url={FLAT_TILES} className="flat-tiles" />
                        <ZoomTracker onZoom={setMapZoom} />
                        {zs.map((z) => (
                          <Polygon key={z.id} positions={z.polygon}
                            eventHandlers={{ click: () => setZonaSel({ ...zonaSel, [cid]: z.id }) }}
                            pathOptions={{ color: zsel === z.id ? "#2B4BDB" : "#93A6E8", fillColor: zsel === z.id ? "#1F3BB3" : "#DCE4F7", fillOpacity: 0.45, weight: 2 }}>
                            <Tooltip sticky>{z.nome} · {z.impianti_count} impianti</Tooltip>
                          </Polygon>
                        ))}
                        {mapZoom < 13 && zs.map((z) => (
                          z.impianti_count > 0 && (
                            <Marker key={`cl-${z.id}`} position={centroide(z.polygon)} icon={clusterIcon(z.impianti_count)}
                              eventHandlers={{ click: () => setZonaSel({ ...zonaSel, [cid]: z.id }) }}>
                              <Tooltip direction="top" offset={[0, -14]}>{z.nome}: {z.impianti_count} impianti — clicca o zooma per vederli</Tooltip>
                            </Marker>
                          )
                        ))}
                        {mapZoom >= 13 && pacs.filter((p) => selected.includes(p.id) || expanded === p.id).flatMap((p) => p.impianti.map((i) => ({ ...i, _p: p, _libSel: (impSel[p.id] || liberiIds(p)).includes(i.id) && selected.includes(p.id) }))).map((i) => (
                          <CircleMarker key={i.id} center={[i.lat, i.lng]} radius={8}
                            eventHandlers={{ click: () => { if (catalogCompatible(i, brief, "OOH", giorni)) toggleImpianto(i._p, i.id); } }}
                            pathOptions={{ color: "#fff", weight: 2, fillColor: i.occupato ? "#94A3B8" : i._libSel ? "#1F3BB3" : "#93A6E8", fillOpacity: 1 }}>
                            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                              <div style={{ width: 150, overflow: "hidden" }}>
                                {i.foto_url && <img src={imgSrc(i.foto_url)} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8 }} />}
                                <div style={{ fontWeight: 800, fontSize: 12, marginTop: 4, whiteSpace: "normal" }}>{i.codice} · {i.tipologia}</div>
                                <div style={{ fontSize: 10, color: "#475569", whiteSpace: "normal" }}>{i.indirizzo || i.via}{i.formato ? ` · ${i.formato}` : ""}</div>
                                <div style={{ fontSize: 10, whiteSpace: "normal" }}><b>{(i.prezzo || 0).toFixed(0)} €/giorno</b>{(i.giorni_minimi || 1) > 1 ? ` · min ${i.giorni_minimi} gg` : ""} · {i.stato_disponibilita === "occupato" ? "Occupato" : i.stato_disponibilita === "opzionato" ? "Opzionato" : i._libSel ? "Selezionato ✓" : "Clicca per selezionare"}</div>
                              </div>
                            </Tooltip>
                          </CircleMarker>
                        ))}
                      </MapContainer>
                    </div>
                    <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {pacs.map((p) => (
                        <div key={p.id} data-testid={`ooh-pacchetto-${p.id}`}
                          className={`border rounded-2xl p-5 transition-colors ${selected.includes(p.id) ? "border-[#1F3BB3] ring-2 ring-[#1F3BB3]/30 bg-[#F0F4FF]" : p.disponibile ? "border-slate-100" : "border-slate-100 opacity-50"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1F3BB3]">{p.zona_nome}</div>
                              <div className="font-heading font-extrabold text-lg">{p.nome}</div>
                            </div>
                            {!p.disponibile ? <span className="text-[10px] font-bold rounded-full bg-[#26292B] text-white px-2.5 py-1">Occupato</span>
                              : p.impianti_liberi < p.n_impianti ? <span className="text-[10px] font-bold rounded-full bg-[#FEF3C7] text-[#B45309] px-2.5 py-1">{p.impianti_liberi}/{p.n_impianti} liberi</span> : null}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{p.descrizione}</div>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-[11px] font-bold rounded-full bg-[#F8F9FD] px-2.5 py-1">
                              {selected.includes(p.id) ? `${(impSel[p.id] || []).length}/${p.n_impianti} impianti scelti` : `${p.n_impianti} impianti · formati misti`}
                            </span>
                            <span className="font-heading font-extrabold">{prezzoSel(p).toFixed(0)} €<span className="text-xs font-normal text-slate-500">/g</span></span>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button type="button" data-testid={`ooh-toggle-${p.id}`} disabled={!liberiIds(p).length} onClick={() => togglePacchetto(p)}
                              className={`flex-1 rounded-full py-2 text-sm font-bold transition-colors disabled:opacity-40 ${selected.includes(p.id) ? "bg-[#1F3BB3] text-white" : "border border-slate-200 hover:border-[#1F3BB3]"}`}>
                              {selected.includes(p.id) ? "Selezionato ✓" : "Seleziona"}
                            </button>
                            <button type="button" data-testid={`ooh-impianti-${p.id}`} onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                              className="border border-slate-200 rounded-full px-3 hover:border-[#1F3BB3] transition-colors">
                              {expanded === p.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          </div>
                          {expanded === p.id && (
                            <div className="mt-3 space-y-1.5 max-h-56 overflow-auto">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Componi il circuito: spunta gli impianti che preferisci</div>
                              {p.impianti.map((i) => {
                                const sel = (impSel[p.id] ?? liberiIds(p)).includes(i.id) && selected.includes(p.id);
                                return (
                                  <label key={i.id} data-testid={`ooh-imp-check-${i.id}`}
                                    className={`flex items-center gap-2.5 text-xs border rounded-xl px-2.5 py-1.5 transition-colors ${i.occupato ? "bg-slate-50 border-slate-100 opacity-60" : sel ? "bg-[#F0F4FF] border-[#1F3BB3] cursor-pointer" : "bg-[#F8F9FD] border-slate-100 cursor-pointer hover:border-[#1F3BB3]"}`}>
                                    <input type="checkbox" disabled={!catalogCompatible(i, brief, "OOH", giorni)} checked={sel}
                                      onChange={() => toggleImpianto(p, i.id)}
                                      className="accent-[#1F3BB3] w-4 h-4 shrink-0" />
                                    <Thumb src={i.foto_url} className="w-10 h-8 object-cover rounded-lg" />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-bold">{i.codice} · {i.tipologia}</div>
                                      <div className="text-slate-500 truncate flex items-center gap-1"><MapPin size={10} />{i.indirizzo} · {i.formato}{(i.giorni_minimi || 1) > 1 ? ` · min ${i.giorni_minimi} gg` : ""}</div>
                                    </div>
                                    <button type="button" data-testid={`ooh-imp-dettaglio-${i.id}`}
                                      onClick={(e) => { e.preventDefault(); setDettaglio(i); }}
                                      className="shrink-0 text-[#1F3BB3] hover:text-[#172E93] transition-colors" title="Dettaglio impianto">
                                      <Info size={15} />
                                    </button>
                                    <span className="font-bold shrink-0">{i.occupato ? <span className="text-[10px] text-slate-500 uppercase">{i.stato_disponibilita === "occupato" ? "Occupato" : "Opzionato"}</span> : `${(i.prezzo || 0).toFixed(0)} €/g`}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                      {pacs.length === 0 && <div className="col-span-full text-sm text-slate-500 p-4">Nessun circuito in questa zona.</div>}
                    </div>
                  </div>
                );
              })}
              <div className="bg-[#F8F9FD] rounded-xl px-5 py-3 flex flex-wrap gap-2 justify-between items-center text-sm font-bold" data-testid="ooh-totale">
                <span>{selected.length} circuiti selezionati{pacchettiSel.length > 0 && <span className="font-normal text-slate-500"> — {pacchettiSel.map((p) => p.nome).join(" · ")}</span>}</span>
                <span className="font-heading">{totale.toFixed(2)} €</span>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Riepilogo campagna "{nome}"</h2>
              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {pacchettiSel.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex flex-wrap justify-between gap-2 text-sm">
                    <span><strong>{p.nome}</strong> · {comuneNome(p.comune_id)} / {p.zona_nome} · {(impSel[p.id] || liberiIds(p)).length} impianti selezionati</span>
                    <span className="font-mono">{(prezzoSel(p) * giorni).toFixed(2)} €</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex justify-between font-bold bg-[#F8F9FD]">
                  <span>Totale · {dal} → {al} ({giorni} giorni)</span>
                  <span className="font-heading text-lg" data-testid="ooh-riepilogo-totale">{totale.toFixed(2)} €</span>
                </div>
              </div>
              <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-800">
                Generando la campagna gli impianti selezionati saranno <strong>opzionati</strong>. Completa moduli, documenti e creatività e invia le pratiche: il pagamento sarà richiesto dopo l’approvazione.
              </div>
            </div>
          )}

          {error && <div data-testid="ooh-error" className="mt-4 border border-red-200 bg-red-50 rounded-xl text-[#B91C1C] text-sm px-4 py-3">{error}</div>}

          {dettaglio && (
            <div className="fixed inset-0 z-[1400] bg-black/50 flex items-center justify-center p-4" onClick={() => setDettaglio(null)}>
              <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="impianto-popup">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                  <div className="font-heading font-extrabold">{dettaglio.codice} · {dettaglio.tipologia}</div>
                  <button data-testid="impianto-popup-close" onClick={() => setDettaglio(null)} className="text-slate-400 hover:text-slate-900"><X size={18} /></button>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-2">
                    {[dettaglio.foto_url, ...(dettaglio.foto_urls || [])].filter(Boolean).map((u, idx) => (
                      <a key={idx} href={imgSrc(u)} target="_blank" rel="noreferrer" className={idx === 0 ? "col-span-2" : ""}>
                        <img src={imgSrc(u)} alt="" className={`w-full object-cover rounded-xl border border-slate-100 ${idx === 0 ? "h-52" : "h-28"}`}
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      </a>
                    ))}
                    {![dettaglio.foto_url, ...(dettaglio.foto_urls || [])].filter(Boolean).length && (
                      <div className="col-span-2 h-32 bg-[#F0F4FF] rounded-xl flex items-center justify-center text-[#93A6E8]"><ImageOff size={22} /></div>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    {[["Indirizzo", dettaglio.indirizzo || dettaglio.via], ["Formato", dettaglio.formato],
                      ["Prezzo", `${(dettaglio.prezzo || 0).toFixed(2)} €/giorno`],
                      ["Prenotazione minima", `${dettaglio.giorni_minimi || 1} giorni`],
                      ["Disponibilità", dettaglio.stato_disponibilita === "occupato" ? "Occupato" : dettaglio.stato_disponibilita === "opzionato" ? "Opzionato" : "Libero"],
                      dettaglio.note && ["Note", dettaglio.note]].filter(Boolean).map(([k, v]) => (
                      <div key={k}>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k}</div>
                        <div className="font-semibold">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button onClick={() => {
              setError("");
              if (step === 4 && comuneIdx > 0) { setComuneIdx(comuneIdx - 1); setExpanded(null); }
              else setStep(Math.max(0, step - 1));
            }} disabled={step === 0}
              className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#1F3BB3] transition-colors disabled:opacity-40">
              Indietro
            </button>
            <button data-testid="ooh-next-button" onClick={next} disabled={busy || proposalBusy}
              className="px-8 py-2.5 font-bold rounded-full bg-[#1F3BB3] text-white hover:bg-[#172E93] transition-colors disabled:opacity-50">
              {busy ? "Attendi..." : step === 5 ? "Genera Campagna"
                : step === 4 && comuneIdx < comuniSel.length - 1 ? `Avanti: ${comuneNome(comuniSel[comuneIdx + 1])}` : step === 3 ? "Selezione manuale" : "Avanti"}
            </button>
          </div>
        </div>
      </div>
    </UserShell>
  );
}
