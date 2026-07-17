import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NavBar } from "../../components/NavBar";
import { DynamicField, isVisible } from "../../components/DynamicField";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { Upload, CreditCard, Check, FileText } from "lucide-react";

const STEPS = ["Periodo", "Modulo Comune", "Documenti", "Pagamento", "Invio"];

export default function PraticaWizard() {
  const { spazioId } = useParams();
  const navigate = useNavigate();
  const [spazio, setSpazio] = useState(null);
  const [template, setTemplate] = useState(null);
  const [step, setStep] = useState(0);
  const [pratica, setPratica] = useState(null);
  const [date, setDate] = useState({ inizio: "", fine: "" });
  const [values, setValues] = useState({});
  const [docs, setDocs] = useState([]);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/spazi/${spazioId}`).then(async ({ data }) => {
      setSpazio(data);
      const tpl = await api.get(`/form-templates/comune/${data.comune_id}`);
      setTemplate(tpl.data);
    });
  }, [spazioId]);

  if (!spazio || !template) return <div><NavBar /><div className="p-12 text-slate-500">Caricamento...</div></div>;

  const giorni = date.inizio && date.fine
    ? Math.max(Math.floor((new Date(date.fine) - new Date(date.inizio)) / 86400000) + 1, 1) : 0;
  const importo = giorni * spazio.canone_giornaliero;
  const campiVisibili = template.campi.filter((c) => isVisible(c, values));

  const next = async () => {
    setError("");
    try {
      if (step === 0) {
        if (!date.inizio || !date.fine || giorni < 1) return setError("Seleziona un periodo valido");
        if (!pratica) {
          const { data } = await api.post("/pratiche", { spazio_id: spazio.id, data_inizio: date.inizio, data_fine: date.fine, dati_form: {} });
          setPratica(data);
        } else {
          const { data } = await api.put(`/pratiche/${pratica.id}`, { data_inizio: date.inizio, data_fine: date.fine });
          setPratica(data);
        }
      }
      if (step === 1) {
        const mancanti = campiVisibili.filter((c) => c.required && (values[c.id] === undefined || values[c.id] === "" || values[c.id] === null));
        if (mancanti.length) return setError(`Compila i campi obbligatori: ${mancanti.map((c) => c.label).join(", ")}`);
        const { data } = await api.put(`/pratiche/${pratica.id}`, { dati_form: values });
        setPratica(data);
      }
      setStep(step + 1);
    } catch (e) {
      setError(apiError(e));
    }
  };

  const uploadFile = async (e, tipo) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/pratiche/${pratica.id}/documenti?tipo=${tipo}`, fd);
      setDocs([...docs, data]);
      toast.success(`${file.name} caricato`);
    } catch (err) {
      toast.error(apiError(err));
    }
    e.target.value = "";
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

  const input = "w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0033FF] focus:border-2 transition-colors";

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-10" data-testid="pratica-wizard">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Nuova candidatura</div>
        <h1 className="text-3xl font-heading font-extrabold tracking-tight mt-1">{spazio.nome}</h1>
        <div className="text-sm text-slate-600">{spazio.citta} · {spazio.tipologia} · {spazio.canone_giornaliero} €/giorno</div>

        <div className="mt-8 grid grid-cols-5 border border-slate-900 bg-white" data-testid="wizard-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`py-2.5 px-2 text-center text-[11px] font-bold uppercase tracking-wider border-r border-slate-900 last:border-r-0 transition-colors
              ${i === step ? "bg-[#0033FF] text-white" : i < step ? "bg-slate-900 text-white" : "text-slate-400"}`}>
              {i + 1}. {s}
            </div>
          ))}
        </div>

        <div className="mt-6 border border-slate-900 bg-white p-8">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-heading font-extrabold text-xl">Periodo di occupazione</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-1.5">Data inizio</label>
                  <input data-testid="input-data-inizio" type="date" className={input} value={date.inizio} onChange={(e) => setDate({ ...date, inizio: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-1.5">Data fine</label>
                  <input data-testid="input-data-fine" type="date" className={input} value={date.fine} onChange={(e) => setDate({ ...date, fine: e.target.value })} />
                </div>
              </div>
              {giorni > 0 && (
                <div className="border border-slate-300 bg-slate-50 px-4 py-3 flex justify-between text-sm">
                  <span>{giorni} giorni × {spazio.canone_giornaliero} €</span>
                  <span className="font-heading font-extrabold" data-testid="importo-calcolato">{importo.toFixed(2)} €</span>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-heading font-extrabold text-xl">{template.nome}</h2>
              <p className="text-sm text-slate-500">Modulo dinamico configurato dal Comune di {spazio.comune?.nome}. I campi cambiano in base alle risposte.</p>
              {campiVisibili.map((c) => (
                <DynamicField key={c.id} campo={c} value={values[c.id]} onChange={(v) => setValues({ ...values, [c.id]: v })} />
              ))}
              {template.campi.length === 0 && <div className="text-sm text-slate-500">Nessun campo aggiuntivo richiesto.</div>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Documenti allegati</h2>
              {[["bozzetto", "Bozzetto / grafica"], ["planimetria", "Planimetria"], ["doc_identita", "Documento d'identità"]].map(([tipo, label]) => (
                <div key={tipo} className="border border-slate-300 p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-sm">{label}</div>
                    <div className="text-xs text-slate-500">{docs.filter((d) => d.tipo === tipo).map((d) => d.nome).join(", ") || "Nessun file caricato"}</div>
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-2 border-2 border-slate-900 px-4 py-2 text-sm font-bold hover:bg-slate-900 hover:text-white transition-colors">
                    <Upload size={15} /> Carica
                    <input data-testid={`upload-${tipo}`} type="file" className="hidden" onChange={(e) => uploadFile(e, tipo)} />
                  </label>
                </div>
              ))}
              <p className="text-xs text-slate-500">I file sono archiviati in locale (demo). Formati consigliati: PDF, PNG, JPG.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-heading font-extrabold text-xl">Checkout</h2>
              <div className="border border-slate-900 divide-y divide-slate-300">
                <div className="px-4 py-3 flex justify-between text-sm"><span>Spazio</span><span className="font-bold">{spazio.nome}</span></div>
                <div className="px-4 py-3 flex justify-between text-sm"><span>Periodo</span><span className="font-mono">{pratica?.data_inizio} → {pratica?.data_fine}</span></div>
                <div className="px-4 py-3 flex justify-between text-sm"><span>Canone totale</span><span className="font-heading font-extrabold text-lg">{pratica?.importo?.toFixed(2)} €</span></div>
              </div>
              <div className="border border-dashed border-slate-400 bg-slate-50 p-4 text-xs text-slate-600">
                Pagamento simulato (demo) — nessun addebito reale. In produzione: Stripe / PagoPA.
              </div>
              <button data-testid="checkout-button" onClick={pay} disabled={paying}
                className="w-full bg-[#10B981] text-slate-950 py-3.5 font-bold flex items-center justify-center gap-2 hover:bg-[#0A3D91] hover:text-white transition-colors disabled:opacity-60">
                <CreditCard size={18} /> {paying ? "Elaborazione..." : `Paga ${pratica?.importo?.toFixed(2)} € (mock)`}
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto w-14 h-14 border-2 border-[#10B981] flex items-center justify-center"><Check size={28} className="text-[#10B981]" /></div>
              <h2 className="font-heading font-extrabold text-2xl">Tutto pronto</h2>
              <p className="text-sm text-slate-600">Pagamento registrato. Invia la pratica al Comune di {spazio.comune?.nome} per avviare l'istruttoria.</p>
              <button data-testid="invia-pratica-button" onClick={invia}
                className="w-full bg-[#0033FF] text-white py-3.5 font-bold flex items-center justify-center gap-2 hover:bg-[#0A3D91] transition-colors">
                <FileText size={18} /> Invia pratica
              </button>
            </div>
          )}

          {error && <div data-testid="wizard-error" className="mt-4 border border-[#EF4444] bg-red-50 text-[#B91C1C] text-sm px-4 py-3">{error}</div>}

          {step < 3 && (
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                className="px-6 py-2.5 font-bold border-2 border-slate-300 hover:border-slate-900 transition-colors disabled:opacity-40">
                Indietro
              </button>
              <button data-testid="wizard-next-button" onClick={next}
                className="px-8 py-2.5 font-bold bg-slate-900 text-white hover:bg-[#0033FF] transition-colors">
                Avanti
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
