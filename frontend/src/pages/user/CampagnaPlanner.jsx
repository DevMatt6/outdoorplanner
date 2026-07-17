import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../components/NavBar";
import { DateRangePicker, fmtDay } from "../../components/DateRangePicker";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { MapPin, Check, CreditCard, Send } from "lucide-react";

const STEPS = ["Periodo", "Spazi", "Riepilogo"];

export default function CampagnaPlanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [range, setRange] = useState();
  const [regione, setRegione] = useState("");
  const [tipologia, setTipologia] = useState("");
  const [disponibili, setDisponibili] = useState([]);
  const [selected, setSelected] = useState([]);
  const [campagna, setCampagna] = useState(null);
  const [pagata, setPagata] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dal = fmtDay(range?.from);
  const al = fmtDay(range?.to);
  const giorni = range?.from && range?.to ? Math.floor((range.to - range.from) / 86400000) + 1 : 0;

  useEffect(() => {
    if (step !== 1 || !dal || !al) return;
    const params = { data_inizio: dal, data_fine: al };
    if (regione) params.regione = regione;
    if (tipologia) params.tipologia = tipologia;
    api.get("/spazi/disponibili", { params }).then(({ data }) => setDisponibili(data));
  }, [step, dal, al, regione, tipologia]);

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const spaziSelezionati = disponibili.filter((s) => selected.includes(s.id));
  const totale = spaziSelezionati.reduce((a, s) => a + s.canone_giornaliero * giorni, 0);

  const next = () => {
    setError("");
    if (step === 0) {
      if (!nome.trim()) return setError("Dai un nome alla campagna");
      if (!dal || !al) return setError("Seleziona il periodo sul calendario");
    }
    if (step === 1 && selected.length === 0) return setError("Seleziona almeno uno spazio");
    setStep(step + 1);
  };

  const crea = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/campagne", { nome, data_inizio: dal, data_fine: al, spazi_ids: selected });
      setCampagna(data);
      toast.success(`Campagna creata: ${data.pratiche.length} pratiche generate`);
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
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

  const input = "border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2F5B41] transition-colors bg-white";

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-6 py-10" data-testid="campagna-planner">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Campaign Planner</div>
        <h1 className="text-3xl font-heading font-extrabold tracking-tight mt-1">Nuova campagna multi-spazio</h1>

        <div className="mt-8 grid grid-cols-3 bg-white border border-slate-100 rounded-2xl overflow-hidden" data-testid="planner-steps">
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
              <input data-testid="campagna-nome-input" className={`${input} w-full max-w-md`} placeholder="Nome campagna (es. Lancio primavera 2027)"
                value={nome} onChange={(e) => setNome(e.target.value)} />
              <DateRangePicker value={range} onChange={setRange} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-heading font-extrabold text-xl flex-1">Spazi disponibili {dal} → {al}</h2>
                <select data-testid="planner-filter-regione" className={input} value={regione} onChange={(e) => setRegione(e.target.value)}>
                  <option value="">Tutte le regioni</option>
                  {["Lazio", "Lombardia", "Toscana", "Campania", "Emilia-Romagna"].map((r) => <option key={r}>{r}</option>)}
                </select>
                <select className={input} value={tipologia} onChange={(e) => setTipologia(e.target.value)}>
                  <option value="">Tutte le tipologie</option>
                  {["Billboard", "Poster", "Totem", "Suolo pubblico"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {disponibili.map((s) => {
                  const on = selected.includes(s.id);
                  return (
                    <button key={s.id} data-testid={`planner-spazio-${s.id}`} onClick={() => toggle(s.id)}
                      className={`text-left rounded-2xl border p-4 transition-colors ${on ? "border-[#2F5B41] bg-[#EFF5EF]" : "border-slate-200 bg-white hover:border-[#2F5B41]"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#2F5B41]">{s.tipologia}</div>
                          <div className="font-bold text-sm mt-0.5">{s.nome}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin size={11} /> {s.citta} ({s.regione})</div>
                        </div>
                        <span className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${on ? "bg-[#2F5B41] border-[#2F5B41] text-white" : "border-slate-300 text-transparent"}`}>
                          <Check size={14} />
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-heading font-extrabold">{(s.canone_giornaliero * giorni).toFixed(2)} € <span className="text-xs font-normal text-slate-500">({s.canone_giornaliero} €/g × {giorni} gg)</span></div>
                    </button>
                  );
                })}
                {disponibili.length === 0 && <div className="text-sm text-slate-500 col-span-2 p-4">Nessuno spazio disponibile per questo periodo/filtri.</div>}
              </div>
              <div className="bg-[#F5F6F3] rounded-xl px-5 py-3 flex justify-between text-sm font-bold" data-testid="planner-totale">
                <span>{selected.length} spazi selezionati</span>
                <span className="font-heading">{totale.toFixed(2)} €</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Riepilogo campagna "{nome}"</h2>
              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {spaziSelezionati.map((s) => (
                  <div key={s.id} className="px-5 py-3 flex justify-between text-sm">
                    <span><strong>{s.nome}</strong> · {s.citta}</span>
                    <span className="font-mono">{(s.canone_giornaliero * giorni).toFixed(2)} €</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex justify-between font-bold bg-[#F5F6F3]">
                  <span>Totale · {dal} → {al}</span>
                  <span className="font-heading text-lg" data-testid="riepilogo-totale">{totale.toFixed(2)} €</span>
                </div>
              </div>
              {!campagna ? (
                <button data-testid="crea-campagna-button" onClick={crea} disabled={busy}
                  className="w-full bg-[#2F5B41] text-white rounded-full py-3.5 font-bold hover:bg-[#26492F] transition-colors disabled:opacity-50">
                  {busy ? "Creazione..." : `Crea campagna (${selected.length} pratiche)`}
                </button>
              ) : !pagata ? (
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

          {step < 2 && (
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                className="px-6 py-2.5 font-bold border border-slate-200 rounded-full hover:border-[#2F5B41] transition-colors disabled:opacity-40">
                Indietro
              </button>
              <button data-testid="planner-next-button" onClick={next}
                className="px-8 py-2.5 font-bold rounded-full bg-[#2F5B41] text-white hover:bg-[#26492F] transition-colors">
                Avanti
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
