import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import { NavBar } from "../../components/NavBar";
import { DateRangePicker, fmtDay } from "../../components/DateRangePicker";
import { DynamicField, isVisible } from "../../components/DynamicField";
import { EsploraMappa } from "../../components/EsploraMappa";
import { SpazioCard } from "../../components/SpazioCard";
import { api, apiError, imgSrc } from "../../lib/api";
import { TIPOLOGIE, FORMATI } from "../../lib/catalogo";
import { toast } from "sonner";
import { CreditCard, Send, Upload, Landmark, ArrowLeft } from "lucide-react";

const STEPS = ["Periodo", "Spazi", "Moduli", "Riepilogo"];

export default function CampagnaPlanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [range, setRange] = useState();
  const [filtri, setFiltri] = useState({ tipologia: "", formato: "" });
  const [regioneSel, setRegioneSel] = useState("");
  const [comuneSel, setComuneSel] = useState("");
  const [zonaSel, setZonaSel] = useState("");
  const [comuniList, setComuniList] = useState([]);
  const [disponibili, setDisponibili] = useState([]);
  const [selected, setSelected] = useState([]);
  const [campagna, setCampagna] = useState(null);
  const [templates, setTemplates] = useState({});
  const [formValues, setFormValues] = useState({});
  const [docsUp, setDocsUp] = useState({});
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
    if (step !== 1 || !dal || !al) return;
    api.get("/spazi/disponibili", { params: { data_inizio: dal, data_fine: al } }).then(({ data }) => setDisponibili(data));
  }, [step, dal, al]);

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const filtrati = useMemo(() => disponibili.filter((s) =>
    (!filtri.tipologia || s.tipologia === filtri.tipologia) && (!filtri.formato || s.formato === filtri.formato)
  ), [disponibili, filtri]);

  const countPerComune = useMemo(() => {
    const m = {};
    filtrati.forEach((s) => { m[s.citta] = (m[s.citta] || 0) + 1; });
    return m;
  }, [filtrati]);

  const comuniGrid = (regioneSel ? comuniList.filter((c) => c.regione === regioneSel) : comuniList)
    .slice()
    .sort((a, b) => (countPerComune[b.nome] || 0) - (countPerComune[a.nome] || 0));

  const spaziComune = comuneSel ? filtrati.filter((s) => s.citta === comuneSel) : filtrati;
  const gridSpazi = zonaSel ? spaziComune.filter((s) => (s.zona || "Altro") === zonaSel) : spaziComune;

  const spaziSelezionati = disponibili.filter((s) => selected.includes(s.id));
  const totale = spaziSelezionati.reduce((a, s) => a + s.canone_giornaliero * giorni, 0);

  const onRegione = (r) => { setRegioneSel(r || ""); setComuneSel(""); setZonaSel(""); };
  const onComune = (nomeC) => {
    if (!nomeC) { setComuneSel(""); setZonaSel(""); return; }
    const c = comuniList.find((x) => x.nome === nomeC);
    setComuneSel(nomeC); setZonaSel(""); if (c) setRegioneSel(c.regione);
  };

  const comuneNomeById = (cid) => comuniList.find((c) => c.id === cid)?.nome || "—";

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
        const docMancanti = (tpl?.documenti_richiesti || []).filter((d) => d.required && !docsUp[`${p.id}:${d.id}`]);
        if (docMancanti.length) return setError(`${p.spazio_nome}: carica ${docMancanti.map((d) => d.label).join(", ")}`);
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

  const uploadDoc = async (e, p, d) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/pratiche/${p.id}/documenti?tipo=${d.id}`, fd);
      setDocsUp((x) => ({ ...x, [`${p.id}:${d.id}`]: file.name }));
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
      <div className="max-w-7xl mx-auto px-6 py-10" data-testid="campagna-planner">
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
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-heading font-extrabold text-xl flex-1">Spazi disponibili {dal} → {al}</h2>
                <select data-testid="planner-filter-tipologia" className={input} value={filtri.tipologia} onChange={(e) => setFiltri({ ...filtri, tipologia: e.target.value })}>
                  <option value="">Tipologia impianto</option>
                  {TIPOLOGIE.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select data-testid="planner-filter-formato" className={input} value={filtri.formato} onChange={(e) => setFiltri({ ...filtri, formato: e.target.value })}>
                  <option value="">Formato</option>
                  {FORMATI.map((f) => <option key={f}>{f}</option>)}
                </select>
                <span className="text-sm text-slate-500 font-mono">{filtrati.length} disponibili</span>
              </div>

              <EsploraMappa comuni={comuniList} spazi={spaziComune}
                regione={regioneSel} comune={comuneSel} zona={zonaSel}
                onRegione={onRegione} onComune={onComune} onZona={(z) => setZonaSel(z || "")}
                selectable selectedIds={selected} onToggle={toggle} height={420} />

              {!comuneSel && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">
                    Comuni {regioneSel ? `in ${regioneSel}` : "con spazi disponibili"}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="planner-comuni-grid">
                    {comuniGrid.map((c) => (
                      <button key={c.id} type="button" data-testid={`planner-comune-card-${c.id}`} onClick={() => onComune(c.nome)}
                        className="bg-white border border-slate-100 rounded-2xl p-5 text-left hover:border-[#2F5B41] transition-colors group">
                        {c.logo_url ? (
                          <img src={imgSrc(c.logo_url)} alt="" className="w-10 h-10 rounded-xl object-contain border border-slate-100 bg-white" />
                        ) : (
                          <span className="w-10 h-10 rounded-xl bg-[#EEF2EC] flex items-center justify-center text-[#2F5B41]"><Landmark size={18} /></span>
                        )}
                        <div className="font-heading font-extrabold mt-3 group-hover:text-[#1F3D2B] transition-colors">{c.nome}</div>
                        <div className="text-xs text-slate-500">{c.regione}</div>
                        <div className="text-xs font-bold text-[#2F5B41] mt-2">{countPerComune[c.nome] || 0} disponibili</div>
                      </button>
                    ))}
                    {comuniGrid.length === 0 && <div className="col-span-full text-sm text-slate-500 p-6 text-center">Nessun Comune attivo in questa regione.</div>}
                  </div>
                </div>
              )}

              {comuneSel && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Spazi a {comuneSel}{zonaSel ? ` — ${zonaSel}` : ""} · clicca per selezionare
                    </div>
                    <button type="button" data-testid="planner-torna-comuni" onClick={() => onComune(null)}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-[#2F5B41] transition-colors">
                      <ArrowLeft size={15} /> Tutti i Comuni
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="planner-spazi-grid">
                    {gridSpazi.map((s) => (
                      <SpazioCard key={s.id} spazio={s} selectable selected={selected.includes(s.id)} onClick={() => toggle(s.id)} />
                    ))}
                  </div>
                  {gridSpazi.length === 0 && <div className="text-sm text-slate-500 p-6 text-center border border-slate-100 rounded-2xl">Nessuno spazio disponibile qui per il periodo/filtri.</div>}
                </div>
              )}

              <div className="bg-[#F5F6F3] rounded-xl px-5 py-3 flex flex-wrap gap-2 justify-between items-center text-sm font-bold" data-testid="planner-totale">
                <span>{selected.length} spazi selezionati{spaziSelezionati.length > 0 && <span className="font-normal text-slate-500"> — {spaziSelezionati.map((s) => s.nome).join(" · ")}</span>}</span>
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
                      <div className="text-xs text-slate-500">Comune di {comuneNomeById(p.comune_id)} · modulo "{tpl?.nome || "standard"}"</div>
                    </div>
                    <div className="p-5 grid sm:grid-cols-2 gap-4">
                      {visibili.map((c) => (
                        <DynamicField key={c.id} campo={c} value={values[c.id]}
                          onChange={(v) => setFormValues({ ...formValues, [p.id]: { ...values, [c.id]: v } })} />
                      ))}
                      {visibili.length === 0 && <div className="text-sm text-slate-500">Nessun campo aggiuntivo richiesto.</div>}
                    </div>
                    <div className="px-5 pb-5 space-y-2">
                      {(tpl?.documenti_richiesti || []).map((d) => (
                        <div key={d.id} className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-xl px-4 py-2" data-testid={`doc-pratica-${p.id}-${d.id}`}>
                          <span className="text-sm font-semibold flex-1 min-w-[160px]">{d.label}{d.required && <span className="text-[#B91C1C]"> *</span>}</span>
                          <span className="text-xs text-slate-500">{docsUp[`${p.id}:${d.id}`] || "Nessun file"}</span>
                          <label className="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">
                            <Upload size={13} /> Carica
                            <input data-testid={`upload-pratica-${p.id}-${d.id}`} type="file" className="hidden" onChange={(e) => uploadDoc(e, p, d)} />
                          </label>
                        </div>
                      ))}
                      {(tpl?.documenti_richiesti || []).length === 0 && (
                        <span className="text-xs text-slate-500">Nessun documento richiesto per questo spazio.</span>
                      )}
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
