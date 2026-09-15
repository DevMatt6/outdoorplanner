import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polygon, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { UserShell } from "../../components/BackofficeLayout";
import { DateRangePicker, fmtDay } from "../../components/DateRangePicker";
import { api, apiError, imgSrc } from "../../lib/api";
import { toast } from "sonner";
import { Landmark, Check, ChevronDown, ChevronUp, MapPin } from "lucide-react";

const STEPS = ["Periodo", "Comuni", "Zone & Circuiti", "Riepilogo"];
const FLAT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function OOHPlanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [range, setRange] = useState();
  const [comuni, setComuni] = useState([]);
  const [comuniSel, setComuniSel] = useState([]);
  const [zone, setZone] = useState({});
  const [pacchetti, setPacchetti] = useState({});
  const [zonaSel, setZonaSel] = useState({});
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dal = fmtDay(range?.from);
  const al = fmtDay(range?.to);
  const giorni = range?.from && range?.to ? Math.floor((range.to - range.from) / 86400000) + 1 : 0;

  useEffect(() => {
    api.get("/comuni").then(({ data }) => setComuni(data));
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    comuniSel.forEach(async (cid) => {
      const [z, p] = await Promise.all([
        api.get(`/ooh/zone?comune_id=${cid}`),
        api.get(`/ooh/pacchetti`, { params: { comune_id: cid, data_inizio: dal, data_fine: al } }),
      ]);
      setZone((x) => ({ ...x, [cid]: z.data }));
      setPacchetti((x) => ({ ...x, [cid]: p.data }));
    });
  }, [step, comuniSel, dal, al]);

  const toggleComune = (id) => setComuniSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const togglePacchetto = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const tuttiPacchetti = useMemo(() => Object.values(pacchetti).flat(), [pacchetti]);
  const pacchettiSel = tuttiPacchetti.filter((p) => selected.includes(p.id));
  const totale = pacchettiSel.reduce((a, p) => a + p.prezzo_giornaliero * giorni, 0);

  const next = async () => {
    setError("");
    if (step === 0) {
      if (!nome.trim()) return setError("Dai un nome alla campagna");
      if (!dal || !al) return setError("Seleziona il periodo sul calendario");
      setStep(1);
    } else if (step === 1) {
      if (comuniSel.length === 0) return setError("Seleziona almeno un Comune");
      setStep(2);
    } else if (step === 2) {
      if (selected.length === 0) return setError("Seleziona almeno un circuito");
      setStep(3);
    } else if (step === 3) {
      setBusy(true);
      try {
        const { data } = await api.post("/ooh/campagne", { nome, data_inizio: dal, data_fine: al, pacchetti_ids: selected });
        toast.success(`Campagna generata: circuiti riservati per 24 ore`);
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

        <div className="mt-8 grid grid-cols-4 bg-white border border-slate-100 rounded-2xl overflow-hidden" data-testid="ooh-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`py-3 px-2 text-center text-[11px] font-bold uppercase tracking-wider transition-colors
              ${i === step ? "bg-[#1F3BB3] text-white" : i < step ? "bg-[#2B4BDB] text-white" : "text-slate-400"}`}>
              {i + 1}. {s}
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-8">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Nome e periodo</h2>
              <input data-testid="ooh-nome-input" className={`${input} w-full max-w-md`} placeholder="Nome campagna (es. Lancio autunno)"
                value={nome} onChange={(e) => setNome(e.target.value)} />
              <DateRangePicker value={range} onChange={setRange} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Seleziona i Comuni (anche più di uno)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="ooh-comuni-grid">
                {comuni.map((c) => (
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              {comuniSel.map((cid) => {
                const zs = zone[cid] || [];
                const zsel = zonaSel[cid] || null;
                const pacs = (pacchetti[cid] || []).filter((p) => !zsel || p.zona_id === zsel);
                const zonaObj = zs.find((z) => z.id === zsel);
                const comune = comuni.find((c) => c.id === cid);
                return (
                  <div key={cid} data-testid={`ooh-sezione-${cid}`}>
                    <h2 className="font-heading font-extrabold text-xl">{comuneNome(cid)} — zone e circuiti</h2>
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
                    <div className="mt-4 border border-slate-100 rounded-2xl overflow-hidden">
                      <MapContainer key={`${cid}-${zsel || "all"}`} center={[zonaObj ? zonaObj.polygon[0][0] + 0.008 : comune?.lat, zonaObj ? zonaObj.polygon[0][1] + 0.011 : comune?.lng]}
                        zoom={zsel ? 14 : 12} style={{ height: 260, width: "100%" }} scrollWheelZoom={false} attributionControl={false}>
                        <TileLayer url={FLAT_TILES} className="flat-tiles" />
                        {zs.map((z) => (
                          <Polygon key={z.id} positions={z.polygon}
                            eventHandlers={{ click: () => setZonaSel({ ...zonaSel, [cid]: z.id }) }}
                            pathOptions={{ color: zsel === z.id ? "#2B4BDB" : "#93A6E8", fillColor: zsel === z.id ? "#1F3BB3" : "#DCE4F7", fillOpacity: 0.45, weight: 2 }}>
                            <Tooltip sticky>{z.nome} · {z.impianti_count} impianti</Tooltip>
                          </Polygon>
                        ))}
                        {pacs.filter((p) => selected.includes(p.id) || expanded === p.id).flatMap((p) => p.impianti).map((i) => (
                          <CircleMarker key={i.id} center={[i.lat, i.lng]} radius={7}
                            pathOptions={{ color: "#fff", weight: 1.5, fillColor: "#F59E0B", fillOpacity: 1 }}>
                            <Tooltip direction="top">{i.codice} · {i.tipologia}</Tooltip>
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
                            {!p.disponibile && <span className="text-[10px] font-bold rounded-full bg-[#26292B] text-white px-2.5 py-1">Occupato</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{p.descrizione}</div>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-[11px] font-bold rounded-full bg-[#F8F9FD] px-2.5 py-1">{p.n_impianti} impianti · formati misti</span>
                            <span className="font-heading font-extrabold">{p.prezzo_giornaliero} €<span className="text-xs font-normal text-slate-500">/g</span></span>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button type="button" data-testid={`ooh-toggle-${p.id}`} disabled={!p.disponibile} onClick={() => togglePacchetto(p.id)}
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
                              {p.impianti.map((i) => (
                                <div key={i.id} className="flex items-center gap-2.5 text-xs bg-[#F8F9FD] border border-slate-100 rounded-xl px-2.5 py-1.5">
                                  <img src={imgSrc(i.foto_url)} alt="" className="w-10 h-8 object-cover rounded-lg" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold">{i.codice} · {i.tipologia}</div>
                                    <div className="text-slate-500 truncate flex items-center gap-1"><MapPin size={10} />{i.indirizzo} · {i.formato}</div>
                                  </div>
                                </div>
                              ))}
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

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Riepilogo campagna "{nome}"</h2>
              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {pacchettiSel.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex flex-wrap justify-between gap-2 text-sm">
                    <span><strong>{p.nome}</strong> · {comuneNome(p.comune_id)} / {p.zona_nome} · {p.n_impianti} impianti</span>
                    <span className="font-mono">{(p.prezzo_giornaliero * giorni).toFixed(2)} €</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex justify-between font-bold bg-[#F8F9FD]">
                  <span>Totale · {dal} → {al} ({giorni} giorni)</span>
                  <span className="font-heading text-lg" data-testid="ooh-riepilogo-totale">{totale.toFixed(2)} €</span>
                </div>
              </div>
              <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-800">
                Generando la campagna gli impianti dei circuiti selezionati verranno <strong>bloccati per 24 ore</strong>: entro la scadenza dovrai completare moduli, documenti, creatività e pagamento.
              </div>
            </div>
          )}

          {error && <div data-testid="ooh-error" className="mt-4 border border-red-200 bg-red-50 rounded-xl text-[#B91C1C] text-sm px-4 py-3">{error}</div>}

          <div className="mt-8 flex justify-between">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#1F3BB3] transition-colors disabled:opacity-40">
              Indietro
            </button>
            <button data-testid="ooh-next-button" onClick={next} disabled={busy}
              className="px-8 py-2.5 font-bold rounded-full bg-[#1F3BB3] text-white hover:bg-[#172E93] transition-colors disabled:opacity-50">
              {busy ? "Attendi..." : step === 3 ? "Genera Campagna" : "Avanti"}
            </button>
          </div>
        </div>
      </div>
    </UserShell>
  );
}
