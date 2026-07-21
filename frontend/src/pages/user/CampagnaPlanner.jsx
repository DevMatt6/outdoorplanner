import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { NavBar } from "../../components/NavBar";
import { DateRangePicker, fmtDay } from "../../components/DateRangePicker";
import { DynamicField, isVisible } from "../../components/DynamicField";
import { api, apiError } from "../../lib/api";
import { TIPOLOGIE, FORMATI } from "../../lib/catalogo";
import { toast } from "sonner";
import { MapPin, Check, CreditCard, Send, Upload } from "lucide-react";

const STEPS = ["Periodo", "Spazi", "Moduli", "Riepilogo"];

export default function CampagnaPlanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [range, setRange] = useState();
  const [filtri, setFiltri] = useState({ citta: "", tipologia: "", formato: "", zona: "" });
  const [zone, setZone] = useState([]);
  const [comuniList, setComuniList] = useState([]);
  const [disponibili, setDisponibili] = useState([]);
  const [selected, setSelected] = useState([]);
  const [campagna, setCampagna] = useState(null);
  const [templates, setTemplates] = useState({});
  const [formValues, setFormValues] = useState({});
  const [docsCount, setDocsCount] = useState({});
  const [pagata, setPagata] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dal = fmtDay(range?.from);
  const al = fmtDay(range?.to);
  const giorni = range?.from && range?.to ? Math.floor((range.to - range.from) / 86400000) + 1 : 0;

  useEffect(() => {
    api.get("/comuni").then(({ data }) => setComuniList(data));
  }, []);

  useEffect(() => {
    api.get("/spazi/zone", { params: filtri.citta ? { citta: filtri.citta } : {} }).then(({ data }) => setZone(data));
  }, [filtri.citta]);

  useEffect(() => {
    if (step !== 1 || !dal || !al) return;
    const params = { data_inizio: dal, data_fine: al };
    Object.entries(filtri).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get("/spazi/disponibili", { params }).then(({ data }) => setDisponibili(data));
  }, [step, dal, al, filtri]);

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const spaziSelezionati = disponibili.filter((s) => selected.includes(s.id));
  const totale = spaziSelezionati.reduce((a, s) => a + s.canone_giornaliero * giorni, 0);

  const center = useMemo(() => {
    if (disponibili.length === 0) return [42.0, 12.5];
    return [disponibili.reduce((a, s) => a + s.lat, 0) / disponibili.length,
            disponibili.reduce((a, s) => a + s.lng, 0) / disponibili.length];
  }, [disponibili]);

  const next = async () => {
    setError("");
    if (step === 0) {
      if (!nome.trim()) return setError("Dai un nome alla campagna");
      if (!dal || !al) return setError("Seleziona il periodo sul calendario");
      setStep(1);
    } else if (step === 1) {
      if (selected.length === 0) return setError("Seleziona almeno uno spazio");
      setBusy(true);
      try {
        const { data } = campagna
          ? { data: campagna }
          : await api.post("/campagne", { nome, data_inizio: dal, data_fine: al, spazi_ids: selected });
        setCampagna(data);
        const tpls = {};
        for (const p of data.pratiche) {
          const res = await api.get(`/form-templates/spazio/${p.spazio_id}`);
          tpls[p.id] = res.data;
        }
        setTemplates(tpls);
        if (!campagna) toast.success(`Campagna creata: ${data.pratiche.length} pratiche generate`);
        setStep(2);
      } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
    } else if (step === 2) {
      for (const p of campagna.pratiche) {
        const tpl = templates[p.id];
        const values = formValues[p.id] || {};
        const visibili = (tpl?.campi || []).filter((c) => isVisible(c, values));
        const mancanti = visibili.filter((c) => c.required && (values[c.id] === undefined || values[c.id] === "" || values[c.id] === null));
        if (mancanti.length) return setError(`${p.spazio_nome}: compila ${mancanti.map((c) => c.label).join(", ")}`);
      }
      setBusy(true);
      try {
        for (const p of campagna.pratiche) {
          await api.put(`/campagne/${campagna.id}/dati-form`, {
            pratica_ids: [p.id], dati_form: formValues[p.id] || {},
          });
        }
        setStep(3);
      } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
    }
  };

  const uploadDoc = async (e, p) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/pratiche/${p.id}/documenti?tipo=allegato`, fd);
      setDocsCount((d) => ({ ...d, [p.id]: (d[p.id] || 0) + 1 }));
      toast.success(`${file.name} allegato a ${p.spazio_nome}`);
    } catch (err) { toast.error(apiError(err)); }
    e.target.value = "";
  };

  const checkout = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/campagne/${campagna.id}/checkout`);
      setPagata(true);
      toast.success(`Pagamento simulato · ${data.transazione_id}`);
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  const invia = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/campagne/${campagna.id}/invia`);
      toast.success(`${data.inviate} pratiche inviate ai Comuni`);
      navigate(`/campagne/${campagna.id}`);
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  };

  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2F5B41] transition-colors bg-white";

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-10" data-testid="campagna-planner">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Campaign Planner</div>
        <h1 className="text-3xl font-heading font-extrabold tracking-tight mt-1">Nuova campagna multi-spazio</h1>

        <div className="mt-8 grid grid-cols-4 bg-white border border-slate-100 rounded-2xl overflow-hidden" data-testid="planner-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`py-3 px-2 text-center text-[11px] font-bold uppercase tracking-wider transition-colors
              ${i === step ? "bg-[#2F5B41] text-white" : i < step ? "bg-[#1F3D2B] text-white" : "text-slate-400"}`}>
              {i + 1}. {s}
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-8">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Nome e periodo</h2>
              <input data-testid="campagna-nome-input" className={`${input} w-full max-w-md px-4 py-3`} placeholder="Nome campagna (es. Lancio primavera 2027)"
                value={nome} onChange={(e) => setNome(e.target.value)} />
              <DateRangePicker value={range} onChange={setRange} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-heading font-extrabold text-xl flex-1">Spazi disponibili {dal} → {al}</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <select data-testid="planner-filter-comune" className={input} value={filtri.citta} onChange={(e) => setFiltri({ ...filtri, citta: e.target.value, zona: "" })}>
                  <option value="">Tutti i Comuni</option>
                  {comuniList.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
                <select data-testid="planner-filter-tipologia" className={input} value={filtri.tipologia} onChange={(e) => setFiltri({ ...filtri, tipologia: e.target.value })}>
                  <option value="">Tipologia impianto</option>
                  {TIPOLOGIE.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select data-testid="planner-filter-formato" className={input} value={filtri.formato} onChange={(e) => setFiltri({ ...filtri, formato: e.target.value })}>
                  <option value="">Formato</option>
                  {FORMATI.map((f) => <option key={f}>{f}</option>)}
                </select>
                <select data-testid="planner-filter-zona" className={input} value={filtri.zona} onChange={(e) => setFiltri({ ...filtri, zona: e.target.value })}>
                  <option value="">Zona / quartiere</option>
                  {zone.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
                <span className="ml-auto text-sm text-slate-500 font-mono self-center">{disponibili.length} disponibili</span>
              </div>
              <div className="grid lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {disponibili.map((s) => {
                    const on = selected.includes(s.id);
                    return (
                      <button key={s.id} data-testid={`planner-spazio-${s.id}`} onClick={() => toggle(s.id)}
                        className={`w-full text-left rounded-2xl border p-4 transition-colors ${on ? "border-[#2F5B41] bg-[#EFF5EF]" : "border-slate-200 bg-white hover:border-[#2F5B41]"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2F5B41]">{s.tipologia} · {s.formato}</div>
                            <div className="font-bold text-sm mt-0.5">{s.nome}</div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin size={11} /> {s.indirizzo} — {s.citta} ({s.regione})</div>
                          </div>
                          <span className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${on ? "bg-[#2F5B41] border-[#2F5B41] text-white" : "border-slate-300 text-transparent"}`}>
                            <Check size={14} />
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-heading font-extrabold">{(s.canone_giornaliero * giorni).toFixed(2)} € <span className="text-xs font-normal text-slate-500">({s.canone_giornaliero} €/g × {giorni} gg)</span></div>
                      </button>
                    );
                  })}
                  {disponibili.length === 0 && <div className="text-sm text-slate-500 p-4">Nessuno spazio disponibile per questo periodo/filtri.</div>}
                </div>
                <div className="lg:col-span-2">
                  <div className="sticky top-24 border border-slate-100 rounded-2xl overflow-hidden">
                    <MapContainer key={center.join(",") + disponibili.length} center={center} zoom={filtri.citta ? 11 : 5.5} style={{ height: 440 }} scrollWheelZoom={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {disponibili.map((s) => (
                        <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={9}
                          eventHandlers={{ click: () => toggle(s.id) }}
                          pathOptions={{ color: "#1F3D2B", weight: 1.5, fillColor: selected.includes(s.id) ? "#F59E0B" : "#2F5B41", fillOpacity: 1 }}>
                          <Popup>
                            <div className="font-bold">{s.nome}</div>
                            <div className="text-xs">{s.canone_giornaliero} €/g · {s.formato}</div>
                            <button className="text-[#2F5B41] text-xs font-bold" onClick={() => toggle(s.id)}>
                              {selected.includes(s.id) ? "Rimuovi dalla campagna" : "Aggiungi alla campagna"}
                            </button>
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MapContainer>
                  </div>
                </div>
              </div>
              <div className="bg-[#F5F6F3] rounded-xl px-5 py-3 flex justify-between text-sm font-bold" data-testid="planner-totale">
                <span>{selected.length} spazi selezionati</span>
                <span className="font-heading">{totale.toFixed(2)} €</span>
              </div>
            </div>
          )}

          {step === 2 && campagna && (
            <div className="space-y-6">
              <div>
                <h2 className="font-heading font-extrabold text-xl">Moduli per spazio</h2>
                <p className="text-sm text-slate-500 mt-1">Ogni spazio richiede il modulo previsto dal proprio Comune. Compila i dati e allega i documenti per ciascuno spazio.</p>
              </div>
              {campagna.pratiche.map((p) => {
                const tpl = templates[p.id];
                const values = formValues[p.id] || {};
                const visibili = (tpl?.campi || []).filter((c) => isVisible(c, values));
                return (
                  <div key={p.id} className="border border-slate-100 rounded-2xl overflow-hidden" data-testid={`modulo-pratica-${p.id}`}>
                    <div className="px-5 py-3 bg-[#FAFAF8] border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-heading font-extrabold">{p.spazio_nome}</div>
                      <div className="text-xs text-slate-500">Comune di {(comuniList.find((c) => c.id === p.comune_id)?.nome) || "—"} · modulo "{tpl?.nome || "standard"}"</div>
                    </div>
                    <div className="p-5 grid sm:grid-cols-2 gap-4">
                      {visibili.map((c) => (
                        <DynamicField key={c.id} campo={c} value={values[c.id]}
                          onChange={(v) => setFormValues({ ...formValues, [p.id]: { ...values, [c.id]: v } })} />
                      ))}
                      {visibili.length === 0 && <div className="text-sm text-slate-500">Nessun campo aggiuntivo richiesto.</div>}
                    </div>
                    <div className="px-5 pb-5 flex flex-wrap items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-full px-5 py-2 text-sm font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">
                        <Upload size={15} /> Allega documento
                        <input data-testid={`upload-pratica-${p.id}`} type="file" className="hidden" onChange={(e) => uploadDoc(e, p)} />
                      </label>
                      <span className="text-xs text-slate-500">{docsCount[p.id] || 0} documenti allegati (bozzetto, planimetria, doc identità)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && campagna && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Riepilogo campagna "{nome}"</h2>
              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {campagna.pratiche.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex justify-between text-sm">
                    <span><strong>{p.spazio_nome}</strong></span>
                    <span className="font-mono">{p.importo.toFixed(2)} €</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex justify-between font-bold bg-[#F5F6F3]">
                  <span>Totale · {dal} → {al}</span>
                  <span className="font-heading text-lg" data-testid="riepilogo-totale">{campagna.importo_totale.toFixed(2)} €</span>
                </div>
              </div>
              {!pagata ? (
                <button data-testid="checkout-campagna-button" onClick={checkout} disabled={busy}
                  className="w-full bg-[#2F5B41] text-white rounded-full py-3.5 font-bold flex items-center justify-center gap-2 hover:bg-[#26492F] transition-colors disabled:opacity-50">
                  <CreditCard size={18} /> {busy ? "Elaborazione..." : `Paga ${campagna.importo_totale.toFixed(2)} € (mock)`}
                </button>
              ) : (
                <button data-testid="invia-campagna-button" onClick={invia} disabled={busy}
                  className="w-full bg-[#2F5B41] text-white rounded-full py-3.5 font-bold flex items-center justify-center gap-2 hover:bg-[#26492F] transition-colors disabled:opacity-50">
                  <Send size={18} /> Invia tutte le pratiche ai Comuni
                </button>
              )}
            </div>
          )}

          {error && <div data-testid="planner-error" className="mt-4 border border-red-200 bg-red-50 rounded-xl text-[#B91C1C] text-sm px-4 py-3">{error}</div>}

          {step < 3 && (
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || (step === 2 && !!campagna)}
                className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#2F5B41] transition-colors disabled:opacity-40">
                Indietro
              </button>
              <button data-testid="planner-next-button" onClick={next} disabled={busy}
                className="px-8 py-2.5 font-bold rounded-full bg-[#2F5B41] text-white hover:bg-[#26492F] transition-colors disabled:opacity-50">
                {busy ? "Attendi..." : step === 1 && !campagna ? "Crea pratiche e compila moduli" : "Avanti"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
