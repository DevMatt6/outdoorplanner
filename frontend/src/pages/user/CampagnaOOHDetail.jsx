import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { NavBar } from "../../components/NavBar";
import { StatusBadge } from "../../components/StatusBadge";
import { DynamicField, isVisible } from "../../components/DynamicField";
import { api, apiError, imgSrc } from "../../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Clock, Upload, CreditCard, Send, Check, X, ImagePlus } from "lucide-react";

const Countdown = ({ scadenza }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(scadenza).getTime() - now;
  if (ms <= 0) return <span className="font-bold text-[#B91C1C]">Prenotazione scaduta</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return <span data-testid="ooh-countdown" className="font-mono font-bold">{h}h {m}m {s}s</span>;
};

const CheckChip = ({ ok, label }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 ${ok ? "bg-[#D8EADB] text-[#1F5B33]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>
    {ok ? <Check size={11} /> : <X size={11} />} {label}
  </span>
);

const isDooh = (tipologia) => /led|digital|mupi|schermo|scia/i.test(tipologia || "");

export default function CampagnaOOHDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [templates, setTemplates] = useState({});
  const [formValues, setFormValues] = useState({});
  const [creativita, setCreativita] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/ooh/campagne/${id}`);
    setC(data);
    const fv = {};
    for (const p of data.pratiche) {
      fv[p.id] = p.dati_form || {};
      if (!templates[p.id]) {
        const t = await api.get(`/ooh/pratiche/${p.id}/template`);
        setTemplates((x) => ({ ...x, [p.id]: t.data }));
      }
    }
    setFormValues(fv);
  };
  const loadCreativita = () => api.get("/creativita").then(({ data }) => setCreativita(data));

  useEffect(() => { load(); loadCreativita(); }, [id]);

  const formati = useMemo(() => {
    const set = new Set();
    c?.pratiche.forEach((p) => p.impianti.forEach((i) => set.add(i.formato)));
    return [...set];
  }, [c]);

  if (!c) return <div><NavBar /><div className="p-12 text-slate-500">Caricamento...</div></div>;

  const attiva = c.stato === "HOLD";
  const editable = (p) => p.stato === "DA_COMPLETARE";

  const salvaModulo = async (p) => {
    try {
      await api.put(`/ooh/pratiche/${p.id}/dati-form`, { dati_form: formValues[p.id] || {} });
      toast.success(`Modulo salvato: ${p.pacchetto_nome}`);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const uploadDoc = async (e, p, d) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/pratiche/${p.id}/documenti?tipo=${d.id}`, fd);
      toast.success(`${file.name} caricato`);
      load();
    } catch (err) { toast.error(apiError(err)); }
    e.target.value = "";
  };

  const uploadCreativita = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formato = window.prompt(`Formato della creatività? (${formati.join(" · ")})`, formati[0] || "");
    if (formato === null) return;
    const digitale = window.confirm("È una creatività digitale (per impianti DOOH)? OK = digitale, Annulla = cartacea");
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/creativita?nome=${encodeURIComponent(file.name)}&formato=${encodeURIComponent(formato)}&digitale=${digitale}`, fd);
      toast.success("Creatività caricata");
      loadCreativita();
    } catch (err) { toast.error(apiError(err)); }
    e.target.value = "";
  };

  const assegna = async (p, impianto, creativita_id) => {
    if (!creativita_id) return;
    try {
      await api.post(`/ooh/pratiche/${p.id}/creativita`, { impianto_id: impianto.id, creativita_id });
      toast.success(`Creatività assegnata a ${impianto.codice}`);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const checkout = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/ooh/campagne/${id}/checkout`);
      toast.success(`Pagamento simulato · ${data.transazione_id}`);
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const invia = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/ooh/campagne/${id}/invia`);
      toast.success(`${data.inviate} pratiche inviate ai Comuni: prenotazione confermata`);
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  const annulla = async () => {
    if (!window.confirm("Annullare la campagna e liberare gli impianti?")) return;
    try {
      await api.post(`/ooh/campagne/${id}/annulla`);
      toast.success("Campagna annullata");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const tuttePagate = c.pratiche.every((p) => p.checklist.pagamento_ok);
  const tuttoCompleto = c.pratiche.every((p) => Object.values(p.checklist).every(Boolean));

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-10" data-testid="campagna-ooh-detail">
        <Link to="/campagne" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} /> Le mie campagne
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h1 className="text-3xl font-heading font-extrabold tracking-tight">{c.nome}</h1>
            <div className="text-sm text-slate-600 font-mono mt-1">{c.data_inizio} → {c.data_fine} · {c.importo_totale.toFixed(2)} € · Campagna OOH</div>
          </div>
          <span className={`text-xs font-bold rounded-full px-4 py-1.5 ${c.stato === "CONFERMATA" ? "bg-[#D8EADB] text-[#1F5B33]" : c.stato === "HOLD" ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>
            {c.stato === "HOLD" ? "Prenotazione attiva" : c.stato === "CONFERMATA" ? "Confermata" : c.stato}
          </span>
        </div>

        {attiva && (
          <div className="mt-6 border border-amber-200 bg-amber-50 rounded-2xl px-6 py-4 flex flex-wrap items-center gap-3" data-testid="hold-banner">
            <Clock size={20} className="text-[#B45309]" />
            <span className="text-sm font-semibold text-amber-900">Spazi riservati ancora per</span>
            <Countdown scadenza={c.hold_expires_at} />
            <span className="text-xs text-amber-700">Completa moduli, documenti, creatività e pagamento entro la scadenza, poi invia ai Comuni.</span>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {c.pratiche.map((p) => {
            const tpl = templates[p.id] || { campi: [], documenti_richiesti: [] };
            const values = formValues[p.id] || {};
            const visibili = (tpl.campi || []).filter((f) => isVisible(f, values));
            return (
              <div key={p.id} className="border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid={`ooh-pratica-${p.id}`}>
                <div className="px-6 py-4 bg-[#FAFAF8] border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-heading font-extrabold text-lg">{p.pacchetto_nome} <span className="text-sm font-normal text-slate-500">· {p.zona_nome}</span></div>
                    <div className="text-xs text-slate-500">{p.impianti.length} impianti · {p.importo.toFixed(2)} €</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckChip ok={p.checklist.moduli_ok} label="Moduli" />
                    <CheckChip ok={p.checklist.documenti_ok} label="Documenti" />
                    <CheckChip ok={p.checklist.creativita_ok} label="Creatività" />
                    <CheckChip ok={p.checklist.pagamento_ok} label="Pagamento" />
                    <StatusBadge stato={p.stato} />
                  </div>
                </div>

                {editable(p) && (
                  <div className="p-6 grid lg:grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Modulo "{tpl.nome}"</div>
                      <div className="grid gap-3">
                        {visibili.map((f) => (
                          <DynamicField key={f.id} campo={f} value={values[f.id]}
                            onChange={(v) => setFormValues({ ...formValues, [p.id]: { ...values, [f.id]: v } })} />
                        ))}
                      </div>
                      <button data-testid={`salva-modulo-${p.id}`} onClick={() => salvaModulo(p)}
                        className="mt-3 border border-slate-200 rounded-full px-5 py-2 text-sm font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">
                        Salva modulo
                      </button>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-6 mb-2">Documentazione</div>
                      {(tpl.documenti_richiesti || []).map((d) => {
                        const caricati = (p.documenti || []).filter((x) => x.tipo === d.id);
                        return (
                          <div key={d.id} className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-xl px-4 py-2 mb-2">
                            <span className="text-sm font-semibold flex-1 min-w-[140px]">{d.label}{d.required && <span className="text-[#B91C1C]"> *</span>}</span>
                            <span className="text-xs text-slate-500">{caricati.map((x) => x.nome).join(", ") || "Nessun file"}</span>
                            <label className="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">
                              <Upload size={13} /> Carica
                              <input data-testid={`ooh-upload-${p.id}-${d.id}`} type="file" className="hidden" onChange={(e) => uploadDoc(e, p, d)} />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Creatività per impianto</div>
                        <label className="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">
                          <ImagePlus size={13} /> Carica creatività
                          <input data-testid={`ooh-upload-creativita-${p.id}`} type="file" className="hidden" onChange={uploadCreativita} />
                        </label>
                      </div>
                      <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                        {p.impianti.map((imp) => {
                          const assegnata = (p.creativita || []).find((a) => a.impianto_id === imp.id);
                          const compatibili = creativita.filter((cr) =>
                            (!cr.formato || !imp.formato || cr.formato === imp.formato) && (cr.digitale === isDooh(imp.tipologia)));
                          return (
                            <div key={imp.id} className="flex items-center gap-3 border border-slate-100 rounded-xl px-3 py-2" data-testid={`ooh-impianto-cr-${imp.id}`}>
                              <img src={imgSrc(imp.foto_url)} alt="" className="w-11 h-9 object-cover rounded-lg" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold">{imp.codice} · {imp.tipologia}</div>
                                <div className="text-[10px] text-slate-500">{imp.formato}{isDooh(imp.tipologia) ? " · DOOH (digitale)" : " · cartaceo"}</div>
                              </div>
                              {assegnata ? (
                                <span className="text-[11px] font-bold text-[#1F5B33] bg-[#D8EADB] rounded-full px-2.5 py-1 max-w-[140px] truncate">{assegnata.creativita_nome}</span>
                              ) : null}
                              <select data-testid={`ooh-assegna-${imp.id}`} className="border border-slate-200 rounded-lg text-xs px-2 py-1.5 max-w-[150px] bg-white"
                                value="" onChange={(e) => assegna(p, imp, e.target.value)}>
                                <option value="">{assegnata ? "Cambia..." : "Assegna..."}</option>
                                {compatibili.map((cr) => <option key={cr.id} value={cr.id}>{cr.nome}</option>)}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {!editable(p) && (
                  <div className="px-6 py-4 text-sm text-slate-500">
                    {p.stato === "PRENOTAZIONE_SCADUTA" ? "Il blocco di 24 ore è scaduto: gli impianti sono stati liberati." :
                      p.stato === "ANNULLATA" ? "Pratica annullata." :
                        <Link to={`/pratiche/${p.id}`} className="font-bold text-[#2F5B41] hover:underline">Apri la pratica per seguire l'iter del Comune →</Link>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {attiva && (
          <div className="mt-8 flex flex-wrap gap-3 justify-end">
            <button data-testid="ooh-annulla-button" onClick={annulla}
              className="border border-slate-200 rounded-full px-6 py-3 font-bold hover:border-[#EF4444] hover:text-[#EF4444] transition-colors">
              Annulla campagna
            </button>
            {!tuttePagate && (
              <button data-testid="ooh-checkout-button" onClick={checkout} disabled={busy}
                className="inline-flex items-center gap-2 bg-[#2F5B41] text-white rounded-full px-7 py-3 font-bold hover:bg-[#26492F] transition-colors disabled:opacity-50">
                <CreditCard size={17} /> Paga {c.importo_totale.toFixed(2)} € (mock)
              </button>
            )}
            {tuttePagate && (
              <button data-testid="ooh-invia-button" onClick={invia} disabled={busy || !tuttoCompleto}
                className="inline-flex items-center gap-2 bg-[#2F5B41] text-white rounded-full px-7 py-3 font-bold hover:bg-[#26492F] transition-colors disabled:opacity-50"
                title={tuttoCompleto ? "" : "Completa moduli, documenti e creatività"}>
                <Send size={17} /> Invia ai Comuni e conferma
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
