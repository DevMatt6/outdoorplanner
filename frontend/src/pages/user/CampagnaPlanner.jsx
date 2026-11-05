import { ComuneLogo } from "../../components/ComuneLogo";
import { initialOSPBrief, ospBriefPayload, ospBudgetError, ospPeopleError, ospAvailable, ospCost, ospBudgetAdvice } from "../../lib/ospPlanning";
import { LoadingState } from "../../components/LoadingState";
import { Stepper } from "../../components/Stepper";
import { BudgetSummary } from "../../components/CampaignBrief";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { DateRangePicker, fmtDay } from "../../components/DateRangePicker";
import { OSPForms } from "../../components/OSPForms";
import { SpazioCard } from "../../components/SpazioCard";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { CreditCard, Send, Search } from "lucide-react";

const STEPS = [[0,"Budget e persone"],[1,"Periodo"],[2,"Comuni"],[3,"Spazi OSP"],[4,"Moduli"],[5,"Riepilogo"]];

export default function CampagnaPlanner() {
  const navigate = useNavigate();
  const plannerRef = useRef(null);
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState(initialOSPBrief);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [spacesError, setSpacesError] = useState("");
  const [reloadSpaces, setReloadSpaces] = useState(0);
  const [search, setSearch] = useState("");
  const [comuniSel, setComuniSel] = useState([]);
  const [nome, setNome] = useState("");
  const [range, setRange] = useState();
  const [comuneSel, setComuneSel] = useState("");
  const [zonaSel, setZonaSel] = useState("");
  const [comuniList, setComuniList] = useState([]);
  const [disponibili, setDisponibili] = useState([]);
  const [selected, setSelected] = useState([]);
  const [campagna, setCampagna] = useState(null);
  const formsRef = useRef(null);
  const [pagata, setPagata] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { plannerRef.current?.scrollIntoView?.({ block: "start" }); }, [step]);

  const dal = fmtDay(range?.from);
  const al = fmtDay(range?.to);
  const giorni = range?.from && range?.to ? Math.floor((range.to - range.from) / 86400000) + 1 : 0;

  useEffect(() => {
    api.get("/comuni").then(({ data }) => setComuniList(data));
  }, []);

  useEffect(() => {
    if (step !== 3 || !dal || !al) return;
    let active = true;
    setSpacesLoading(true); setSpacesError("");
    api.get("/spazi/disponibili", { params: { data_inizio: dal, data_fine: al } })
      .then(({ data }) => { if (active) setDisponibili(data); })
      .catch((e) => { if (active) { setDisponibili([]); setSpacesError(apiError(e)); } })
      .finally(() => { if (active) setSpacesLoading(false); });
    return () => { active = false; };
  }, [step, dal, al, reloadSpaces]);

  const filtrati = useMemo(() => ospAvailable(disponibili, comuniSel, giorni, Number(brief.persone_previste)), [disponibili, comuniSel, giorni, brief.persone_previste]);
  // Keep the initial catalog order while live advice follows the remaining budget.
  const initialRecommendations = useMemo(() => ospBudgetAdvice(filtrati, [], comuniSel, brief.budget, giorni).recommended, [filtrati, comuniSel, brief.budget, giorni]);
  const advice = useMemo(() => ospBudgetAdvice(filtrati, selected, comuniSel, brief.budget, giorni), [filtrati, selected, comuniSel, brief.budget, giorni]);
  const spaziSelezionati = filtrati.filter((s) => selected.includes(s.id));
  const totale = advice.total / 100;
  const perCity = Object.fromEntries(comuniSel.map((id) => [comuniList.find((c) => c.id === id)?.nome || id, 0]));
  spaziSelezionati.forEach((s) => { const name = comuniList.find((c) => c.id === s.comune_id)?.nome || s.citta; perCity[name] = (perCity[name] || 0) + ospCost(s, giorni) / 100; });
  const spaziComune = comuneSel ? filtrati.filter((s) => s.comune_id === comuneSel) : filtrati;
  const zone = [...new Set(spaziComune.map((s) => s.zona || "Altro"))].sort((a, b) => a.localeCompare(b, "it"));
  const gridSpazi = spaziComune.filter((s) => (!zonaSel || (s.zona || "Altro") === zonaSel) && `${s.nome} ${s.citta} ${s.indirizzo || ""}`.toLocaleLowerCase("it").includes(search.trim().toLocaleLowerCase("it")))
    .sort((a, b) => Number(initialRecommendations.has(b.id)) - Number(initialRecommendations.has(a.id)) || ospCost(a, giorni) - ospCost(b, giorni) || a.nome.localeCompare(b.nome, "it"));
  const toggle = (id) => { setError(""); setSelected((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]); };

  const comuneNomeById = (cid) => comuniList.find((c) => c.id === cid)?.nome || "—";

  const next = async () => {
    setError("");
    if (step === 0) {
      const invalid = ospBudgetError(brief.budget) || ospPeopleError(brief.persone_previste);
      if (invalid) return setError(invalid);
      setStep(1);
    } else if (step === 1) {
      if (!nome.trim()) return setError("Dai un nome alla campagna");
      if (!dal || !al) return setError("Seleziona il periodo sul calendario");
      if (al < dal) return setError("Periodo non valido");
      setSelected([]); setDisponibili([]);
      setStep(2);
    } else if (step === 2) {
      if (!comuniSel.length) return setError("Seleziona almeno un Comune");
      setSelected([]); setComuneSel(""); setZonaSel(""); setSearch(""); setStep(3);
    } else if (step === 3) {
      if (spacesLoading || spacesError) return setError("Attendi il caricamento degli spazi disponibili");
      if (selected.some((id) => !filtrati.some((s) => s.id === id))) return setError("Uno spazio selezionato non è più disponibile");
      if (totale > Number(brief.budget) + 0.001) return setError("La selezione supera il budget massimo");
      if (brief.distribuzione === "tutti" && comuniSel.some(id => !spaziSelezionati.some(s => s.comune_id === id))) return setError("Seleziona almeno uno spazio per ciascun comune");
      if (selected.length === 0) return setError("Seleziona almeno uno spazio");
      setBusy(true);
      try {
        const { data } = campagna
          ? { data: campagna }
          : await api.post("/campagne", { nome, data_inizio: dal, data_fine: al, spazi_ids: selected, brief: ospBriefPayload(brief, comuniSel) });
        setCampagna(data);
        if (!campagna) toast.success(`Campagna creata: ${data.pratiche.length} pratiche generate`);
        setStep(4);
      } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
    } else if (step === 4) {
      setBusy(true);
      try { if (await formsRef.current?.save(true)) setStep(5); }
      finally { setBusy(false); }
    }
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

  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors bg-card";

  return (
    <UserShell>
      <div ref={plannerRef} className="max-w-7xl mx-auto scroll-mt-24" data-testid="campagna-planner">
        <div className="text-xs font-semibold tracking-normal text-slate-400">OSP / Eventi</div>
        <h1 className="text-3xl font-heading font-semibold tracking-tight mt-1">Pianifica spazi OSP</h1>

        <Stepper steps={STEPS} current={step} data-testid="planner-steps" />

        <div className="mt-6 bg-card border border-slate-100 rounded-xl p-4 sm:p-8">
          {step >= 3 && <div className="mb-5"><BudgetSummary brief={brief} total={totale} perCity={perCity} /></div>}
          {step === 0 && <div className="space-y-5" data-testid="osp-budget-step"><div><h2 className="text-xl font-semibold">Budget e persone previste</h2><p className="mt-2 text-sm text-muted-foreground">Indica il budget per l’intero periodo e il numero di persone previste. Potrai scegliere manualmente quelli più adatti.</p></div><label className="block max-w-md text-sm font-medium">Budget massimo per l’intero periodo (€)<input data-testid="campaign-budget" type="number" min="0.01" step="0.01" className={`${input} mt-2 w-full`} value={brief.budget} onChange={(e) => setBrief({ ...brief, budget: e.target.value })} /></label><label className="block max-w-md text-sm font-medium">Numero di persone previste<input data-testid="osp-persone-previste" type="number" min="1" step="1" className={`${input} mt-2 w-full`} value={brief.persone_previste} onChange={(e) => setBrief({ ...brief, persone_previste: e.target.value })} /></label><p className="text-xs text-muted-foreground">Il budget copre i canoni degli spazi. Allestimento, produzione ed eventuali costi aggiuntivi non sono inclusi.</p></div>}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-heading font-semibold text-xl">Nome e periodo</h2>
              <input aria-label="Nome campagna (es. Lancio primavera 2027)" data-testid="campagna-nome-input" className={`${input} w-full max-w-md px-4 py-3`} placeholder="Nome campagna (es. Lancio primavera 2027)"
                value={nome} onChange={(e) => setNome(e.target.value)} />
              <DateRangePicker value={range} onChange={setRange} />
            </div>
          )}

          {step === 2 && <div className="space-y-4"><h2 className="font-semibold text-xl">Seleziona i comuni</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{comuniList.map(c => <label key={c.id} className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 ${comuniSel.includes(c.id) ? "border-primary bg-accent ring-1 ring-primary" : "border-slate-200"}`}><input type="checkbox" className="accent-primary" checked={comuniSel.includes(c.id)} onChange={() => setComuniSel(ids => ids.includes(c.id) ? ids.filter(x => x !== c.id) : [...ids, c.id])} /><ComuneLogo comune={c} /><span className="min-w-0"><strong className="block">{c.nome}</strong><span className="text-sm text-muted-foreground">{c.regione}</span></span></label>)}</div></div>}
          {step === 3 && <div className="space-y-5">
            <div><h2 className="text-xl font-semibold">Scegli i tuoi spazi OSP</h2><p className="mt-2 text-sm text-muted-foreground">Seleziona manualmente le card. Gli spazi mostrati hanno capienza sufficiente per {brief.persone_previste} persone. Quelli consigliati rientrano nel budget residuo e lasciano margine per almeno uno spazio in ogni Comune scelto.</p><p className="mt-1 text-xs text-muted-foreground">I prezzi totali si riferiscono al periodo {dal} → {al} ({giorni} giorni).</p></div>
            <div className="flex flex-wrap gap-3" data-testid="osp-space-filters">
              <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Cerca uno spazio OSP" className={`${input} w-full pl-9`} placeholder="Cerca uno spazio o un indirizzo…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <select aria-label="Filtra per Comune" className={input} value={comuneSel} onChange={(e) => { setComuneSel(e.target.value); setZonaSel(""); }}><option value="">Tutti i Comuni scelti</option>{comuniList.filter((c) => comuniSel.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <select aria-label="Filtra per zona" className={input} value={zonaSel} onChange={(e) => setZonaSel(e.target.value)}><option value="">Tutte le zone</option>{zone.map((z) => <option key={z} value={z}>{z}</option>)}</select>
            </div>
            {spacesLoading ? <LoadingState /> : spacesError ? <div role="alert" className="rounded-xl border border-destructive/20 p-5"><p className="text-destructive">{spacesError}</p><button className="mt-3 rounded-md border px-4 py-2" onClick={() => setReloadSpaces((v) => v + 1)}>Riprova</button></div> : <>
              {!advice.feasible && <p role="status" className="rounded-lg border border-warning/20 bg-warning-muted p-4 text-sm text-warning-foreground">{filtrati.length ? "Il budget residuo non basta a coprire almeno uno spazio in ogni Comune scelto. Modifica la selezione, il budget o i Comuni." : "Nessuno spazio con capienza sufficiente e confermata nei Comuni scelti per questo periodo. Modifica il periodo o i Comuni."}</p>}
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground" aria-live="polite"><span>{gridSpazi.length} spazi disponibili</span><span>{advice.recommended.size} consigliati nel budget residuo · nessuna selezione automatica</span></div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="planner-spazi-grid">{gridSpazi.map((s) => <SpazioCard key={s.id} spazio={s} selectable selected={selected.includes(s.id)} onClick={() => toggle(s.id)} imageAspect="landscape" showOSPDetails periodCost={ospCost(s, giorni) / 100} recommended={advice.recommended.has(s.id)} />)}</div>
              {gridSpazi.length === 0 && <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Nessuno spazio trovato con capienza confermata per il numero di persone indicato. Prova a modificare i filtri, i Comuni, il periodo o le persone previste.</div>}
            </>}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-5 py-3 text-sm font-medium" data-testid="planner-totale"><span>{spaziSelezionati.length} spazi selezionati</span><span>{totale.toFixed(2)} €</span></div>
          </div>}

          {step === 4 && campagna && <OSPForms ref={formsRef} pratiche={campagna.pratiche} campagnaId={campagna.id} comuneNome={comuneNomeById} />}

          {step === 5 && campagna && (
            <div className="space-y-5">
              <h2 className="font-heading font-semibold text-xl">Riepilogo campagna "{nome}"</h2><p className="text-sm text-muted-foreground">Persone previste: {brief.persone_previste}</p>
              <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                {campagna.pratiche.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex justify-between text-sm">
                    <span><strong>{p.spazio_nome}</strong></span>
                    <span className="tabular-nums">{p.importo.toFixed(2)} €</span>
                  </div>
                ))}
                <div className="px-5 py-3 flex justify-between font-semibold bg-muted">
                  <span>Totale · {dal} → {al}</span>
                  <span className="font-heading text-lg" data-testid="riepilogo-totale">{campagna.importo_totale.toFixed(2)} €</span>
                </div>
              </div>
              {!pagata ? (
                <button data-testid="checkout-campagna-button" onClick={checkout} disabled={busy}
                  className="w-full bg-primary text-primary-foreground rounded-md py-3.5 font-semibold flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-50">
                  <CreditCard size={18} /> {busy ? "Elaborazione..." : `Paga ${campagna.importo_totale.toFixed(2)} € (mock)`}
                </button>
              ) : (
                <button data-testid="invia-campagna-button" onClick={invia} disabled={busy}
                  className="w-full bg-primary text-primary-foreground rounded-md py-3.5 font-semibold flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-50">
                  <Send size={18} /> Invia tutte le pratiche ai Comuni
                </button>
              )}
            </div>
          )}

          {error && <div data-testid="planner-error" className="mt-4 border border-destructive/20 bg-destructive-muted rounded-xl text-destructive text-sm px-4 py-3">{error}</div>}

          {step < 5 && (
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || (step === 4 && !!campagna)}
                className="px-6 py-2.5 font-semibold border border-slate-200 rounded-md hover:border-primary transition-colors disabled:opacity-40">
                Indietro
              </button>
              <button data-testid="planner-next-button" onClick={next} disabled={busy || (step === 3 && (spacesLoading || !!spacesError))}
                className="px-8 py-2.5 font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary transition-colors disabled:opacity-50">
                {busy ? "Attendi..." : step === 3 && !campagna ? "Crea pratiche e compila moduli" : "Avanti"}
              </button>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}
