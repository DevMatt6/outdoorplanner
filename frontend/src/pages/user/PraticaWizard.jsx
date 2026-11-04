import { Stepper } from "../../components/Stepper";
import { LoadingState } from "../../components/LoadingState";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { OSPFields, OSPDocuments } from "../../components/OSPForms";
import { fieldErrors, visibleDocuments } from "../../lib/ospForms";
import { DateRangePicker, fmtDay } from "../../components/DateRangePicker";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { CreditCard, Check, FileText } from "lucide-react";

const STEPS = ["Periodo", "Modulo Comune", "Documenti", "Pagamento", "Invio"];

export default function PraticaWizard() {
  const { spazioId } = useParams();
  const navigate = useNavigate();
  const [spazio, setSpazio] = useState(null);
  const [template, setTemplate] = useState(null);
  const [step, setStep] = useState(0);
  const [pratica, setPratica] = useState(null);
  const [date, setDate] = useState({ inizio: "", fine: "" });
  const [range, setRange] = useState();
  const [values, setValues] = useState({});
  const [docs, setDocs] = useState([]);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [occupazioni, setOccupazioni] = useState([]);

  useEffect(() => {
    api.get(`/spazi/${spazioId}`).then(async ({ data }) => {
      setSpazio(data);
      const [tpl, occ] = await Promise.all([
        api.get(`/form-templates/spazio/${spazioId}`),
        api.get(`/spazi/${spazioId}/occupazioni`),
      ]);
      setTemplate(tpl.data);
      setOccupazioni(occ.data);
    });
  }, [spazioId]);

  if (!spazio || !template) return <UserShell><LoadingState /></UserShell>;

  const giorni = date.inizio && date.fine
    ? Math.max(Math.floor((new Date(date.fine) - new Date(date.inizio)) / 86400000) + 1, 1) : 0;
  const importo = giorni * spazio.canone_giornaliero;
  const campiVisibili = template.campi;
  const docsRichiesti = visibleDocuments(template, values);

  const next = async () => {
    setError("");
    try {
      if (step === 0) {
        if (!date.inizio || !date.fine || giorni < 1) return setError("Seleziona un periodo valido");
        if (!pratica) {
          const { data } = await api.post("/pratiche", { spazio_id: spazio.id, data_inizio: date.inizio, data_fine: date.fine, dati_form: {} });
          setPratica(data);
          if (data.form_template_snapshot) setTemplate(data.form_template_snapshot);
          setValues((v) => ({ ...(data.dati_form || {}), ...v }));
        } else {
          const { data } = await api.put(`/pratiche/${pratica.id}`, { data_inizio: date.inizio, data_fine: date.fine });
          setPratica(data);
          setValues(data.dati_form || {});
        }
      }
      if (step === 1) {
        const mancanti = fieldErrors(template, values);
        if (mancanti.length) return setError(`Compila i campi obbligatori: ${mancanti.join(", ")}`);
        const { data } = await api.put(`/pratiche/${pratica.id}`, { dati_form: values });
        setPratica(data);
      }
      if (step === 2) {
        const mancanti = docsRichiesti.filter((d) => d.required && !docs.some((x) => x.tipo === d.id));
        if (mancanti.length) return setError(`Carica i documenti obbligatori: ${mancanti.map((d) => d.label).join(", ")}`);
      }
      setStep(step + 1);
    } catch (e) {
      setError(apiError(e));
    }
  };

  const pay = async () => {
    setPaying(true);
    try {
      const { data } = await api.post(`/pratiche/${pratica.id}/checkout`);
      setPratica({ ...pratica, pagata: true });
      toast.success(`Pagamento simulato completato · ${data.transazione_id}`);
      setStep(4);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setPaying(false);
    }
  };

  const invia = async () => {
    try {
      await api.post(`/pratiche/${pratica.id}/invia`);
      toast.success("Pratica inviata al Comune!");
      navigate(`/pratiche/${pratica.id}`);
    } catch (e) {
      setError(apiError(e));
    }
  };


  return (
    <UserShell>
      <div className="max-w-3xl mx-auto" data-testid="pratica-wizard">
        <div className="text-xs font-semibold tracking-normal text-slate-500">Nuova candidatura</div>
        <h1 className="text-3xl font-heading font-semibold tracking-tight mt-1">{spazio.nome}</h1>
        <div className="text-sm text-slate-600">{spazio.citta} · {spazio.tipologia} · {spazio.canone_giornaliero} €/giorno</div>

        <Stepper steps={STEPS} current={step} data-testid="wizard-steps" />

        <div className="mt-6 border border-slate-100 bg-card rounded-xl overflow-hidden p-4 sm:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-heading font-semibold text-xl">Periodo di occupazione</h2>
              <p className="text-sm text-slate-500">Seleziona inizio e fine sul calendario. Le date in rosso sono già occupate e non selezionabili.</p>
              <DateRangePicker
                occupazioni={occupazioni}
                value={range}
                onChange={(r) => {
                  setRange(r);
                  setDate({ inizio: fmtDay(r?.from), fine: fmtDay(r?.to) });
                }}
              />
              {giorni > 0 && (
                <div className="border border-slate-200 rounded-xl bg-slate-50 px-4 py-3 flex justify-between text-sm">
                  <span>{giorni} giorni × {spazio.canone_giornaliero} €</span>
                  <span className="font-heading font-semibold" data-testid="importo-calcolato">{importo.toFixed(2)} €</span>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-heading font-semibold text-xl">{template.nome}</h2>
              <p className="text-sm text-slate-500">Modulo dinamico configurato dal Comune di {spazio.comune?.nome}. I campi cambiano in base alle risposte.</p>
              <OSPFields fields={campiVisibili} values={values} profile={pratica?.richiedente} prefix={`${pratica?.id}-`} onChange={(id, value) => setValues(prev => ({ ...prev, [id]: value }))} />
              {template.campi.length === 0 && <div className="text-sm text-slate-500">Nessun campo aggiuntivo richiesto.</div>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-heading font-semibold text-xl">Documenti allegati</h2>
              <p className="text-sm text-slate-500">Documenti richiesti dal Comune di {spazio.comune?.nome} per il modulo "{template.nome}".</p>
              <OSPDocuments pratica={pratica} template={template} values={values} documents={docs} onUploaded={doc => setDocs(prev => [...prev.filter(d => d.tipo !== doc.tipo), doc])} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-heading font-semibold text-xl">Checkout</h2>
              <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-300">
                <div className="px-4 py-3 flex justify-between text-sm"><span>Spazio</span><span className="font-semibold">{spazio.nome}</span></div>
                <div className="px-4 py-3 flex justify-between text-sm"><span>Periodo</span><span className="tabular-nums">{pratica?.data_inizio} → {pratica?.data_fine}</span></div>
                <div className="px-4 py-3 flex justify-between text-sm"><span>Canone totale</span><span className="font-heading font-semibold text-lg">{pratica?.importo?.toFixed(2)} €</span></div>
              </div>
              <div className="border border-dashed border-slate-300 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                Pagamento simulato (demo) — nessun addebito reale. In produzione: Stripe / PagoPA.
              </div>
              <button data-testid="checkout-button" onClick={pay} disabled={paying}
                className="w-full bg-primary text-primary-foreground rounded-md py-3.5 font-semibold flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-colors disabled:opacity-60">
                <CreditCard size={18} /> {paying ? "Elaborazione..." : `Paga ${pratica?.importo?.toFixed(2)} € (mock)`}
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto w-14 h-14 border-2 border-success flex items-center justify-center"><Check size={28} className="text-success" /></div>
              <h2 className="font-heading font-semibold text-2xl">Tutto pronto</h2>
              <p className="text-sm text-slate-600">Pagamento registrato. Invia la pratica al Comune di {spazio.comune?.nome} per avviare l'istruttoria.</p>
              <button data-testid="invia-pratica-button" onClick={invia}
                className="w-full bg-primary text-primary-foreground rounded-md py-3.5 font-semibold flex items-center justify-center gap-2 hover:bg-primary transition-colors">
                <FileText size={18} /> Invia pratica
              </button>
            </div>
          )}

          {error && <div data-testid="wizard-error" className="mt-4 border border-destructive/20 bg-destructive-muted rounded-xl text-destructive text-sm px-4 py-3">{error}</div>}

          {step < 3 && (
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                className="px-6 py-2.5 font-semibold border border-slate-200 rounded-md hover:border-primary transition-colors disabled:opacity-40">
                Indietro
              </button>
              <button data-testid="wizard-next-button" onClick={next}
                className="px-8 py-2.5 font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary transition-colors">
                Avanti
              </button>
            </div>
          )}
        </div>
      </div>
    </UserShell>
  );
}
