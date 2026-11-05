import { practiceLabel, installationGroups } from "../../lib/practicePresentation";
import { AttachmentLink } from "../../components/TemplateAttachment";
import { useConfirm } from "../../components/ConfirmDialog";
import { LoadingState } from "../../components/LoadingState";
import { SavedCampaignBrief } from "../../components/CampaignBrief";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
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
  if (ms <= 0) return <span className="font-semibold text-destructive">Prenotazione scaduta</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return <span data-testid="ooh-countdown" className="tabular-nums font-semibold">{h}h {m}m {s}s</span>;
};

const CheckChip = ({ ok, label }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2.5 py-1 ${ok ? "bg-accent text-brand-foreground" : "bg-destructive-muted text-destructive"}`}>
    {ok ? <Check size={11} /> : <X size={11} />} {label}
  </span>
);

const isDooh = (tipologia) => /led|digital|mupi|schermo|scia/i.test(tipologia || "");

export default function CampagnaOOHDetail() {
  const confirm = useConfirm();
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [templates, setTemplates] = useState({});
  const [formValues, setFormValues] = useState({});
  const [formati, setFormati] = useState([]);
  const [soggetti, setSoggetti] = useState([]);
  const [numSoggetti, setNumSoggetti] = useState({});
  const [busy, setBusy] = useState(false);
  const [sharedValues, setSharedValues] = useState({});

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
  const loadCreativita = async () => {
    const [f, s] = await Promise.all([
      api.get(`/ooh/campagne/${id}/formati`),
      api.get(`/ooh/campagne/${id}/soggetti`),
    ]);
    setFormati(f.data);
    setSoggetti(s.data);
    setNumSoggetti((prev) => {
      const next = { ...prev };
      f.data.forEach((x) => {
        const caricati = s.data.filter((sg) => sg.formato === x.formato).length;
        if (!next[x.formato] || next[x.formato] < caricati) next[x.formato] = Math.max(caricati, 1);
      });
      return next;
    });
  };

  useEffect(() => { load(); loadCreativita(); }, [id]);

  useEffect(() => {
    if (!c?.submission_due_at || !["HOLD", "IN_COMPLETAMENTO"].includes(c?.stato)) return;
    const timer = setTimeout(() => {
      api.get(`/ooh/campagne/${id}`).then(({ data }) => setC(data)).catch(() => {});
    }, Math.max(0, new Date(c.submission_due_at).getTime() - Date.now()) + 500);
    return () => clearTimeout(timer);
  }, [c?.submission_due_at, c?.stato, id]);

  const formatiUtili = useMemo(() => formati, [formati]);

  const editablePratiche = useMemo(() => (c?.pratiche || []).filter((p) => p.stato === "DA_COMPLETARE"), [c]);
  const campiComuni = useMemo(() => {
    if (editablePratiche.length < 2) return [];
    const tpls = editablePratiche.map((p) => templates[p.id]).filter(Boolean);
    if (tpls.length < editablePratiche.length) return [];
    return (tpls[0].campi || []).filter((campo) => tpls.every((t) => (t.campi || []).some((x) => x.id === campo.id)));
  }, [editablePratiche, templates]);
  const sharedIds = useMemo(() => new Set(campiComuni.map((x) => x.id)), [campiComuni]);

  useEffect(() => {
    if (campiComuni.length === 0 || Object.keys(sharedValues).length > 0) return;
    const base = formValues[editablePratiche[0]?.id] || {};
    const init = {};
    campiComuni.forEach((campo) => { if (base[campo.id] !== undefined) init[campo.id] = base[campo.id]; });
    setSharedValues(init);
  }, [campiComuni]);

  const salvaCampiComuni = async () => {
    try {
      for (const p of editablePratiche) {
        await api.put(`/ooh/pratiche/${p.id}/dati-form`, { dati_form: { ...(formValues[p.id] || {}), ...sharedValues } });
      }
      toast.success("Dati comuni applicati a tutte le pratiche");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!c) return <UserShell><LoadingState /></UserShell>;

  const attiva = c.stato === "HOLD" || c.stato === "IN_COMPLETAMENTO";
  const editable = (p) => p.stato === "DA_COMPLETARE";

  const salvaModulo = async (p) => {
    try {
      await api.put(`/ooh/pratiche/${p.id}/dati-form`, { dati_form: { ...(formValues[p.id] || {}), ...sharedValues } });
      toast.success(`Modulo salvato: ${practiceLabel(p)}`);
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

  const uploadSoggetto = async (e, formato, ordine) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/ooh/campagne/${id}/soggetti?formato=${encodeURIComponent(formato)}&ordine=${ordine}&nome=${encodeURIComponent(`Soggetto ${ordine} — ${formato}`)}`, fd);
      toast.success(`Soggetto ${ordine} (${formato}) caricato`);
      loadCreativita();
    } catch (err) { toast.error(apiError(err)); }
    e.target.value = "";
  };

  const eliminaSoggetto = async (sog) => {
    if (!(await confirm(`Eliminare "${sog.nome}"? Le assegnazioni verranno rimosse.`))) return;
    try {
      await api.delete(`/ooh/soggetti/${sog.id}`);
      toast.success("Soggetto eliminato");
      loadCreativita();
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const assegna = async (p, impianto, soggetto_id) => {
    if (!soggetto_id) return;
    try {
      await api.post(`/ooh/pratiche/${p.id}/creativita`, { impianto_id: impianto.id, soggetto_id });
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
    if (!(await confirm("Annullare la campagna e liberare gli impianti?"))) return;
    try {
      await api.post(`/ooh/campagne/${id}/annulla`);
      toast.success("Campagna annullata");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const daPagare = c.pratiche.filter((p) => p.stato === "APPROVATA" && !p.pagata);
  const tuttoCompleto = c.pratiche.filter(editable).every((p) => Object.values(p.checklist).every(Boolean));

  return (
    <UserShell>
      <div className="max-w-6xl mx-auto" data-testid="campagna-ooh-detail">
        <SavedCampaignBrief brief={c.brief} total={c.importo_totale} />
        <Link to="/campagne" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} /> Le mie campagne
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h1 className="text-3xl font-heading font-semibold tracking-tight">{c.nome}</h1>
            <div className="text-sm text-slate-600 tabular-nums mt-1">{c.data_inizio} → {c.data_fine} · {c.importo_totale.toFixed(2)} € · Campagna OOH</div>
          </div>
          <span className={`text-xs font-semibold rounded-md px-4 py-1.5 ${["CONFERMATA", "INVIATA"].includes(c.stato) ? "bg-accent text-brand-foreground" : attiva ? "bg-warning-muted text-warning-foreground" : "bg-destructive-muted text-destructive"}`}>
            {attiva ? "Impianti opzionati" : c.stato === "INVIATA" ? "Inviata ai Comuni" : c.stato === "CONFERMATA" ? "Confermata" : c.stato}
          </span>
        </div>

        {attiva && (
          <div className="mt-6 border border-warning/20 bg-warning-muted rounded-xl px-6 py-4 flex flex-wrap items-center gap-3" data-testid="hold-banner">
            <Clock size={20} className="text-warning-foreground" />
            <span className="text-sm font-semibold text-warning-foreground">Invia la campagna entro 24 ore dalla generazione.</span>
            {c.submission_due_at && <Countdown scadenza={c.submission_due_at} />}
            <span className="text-xs text-warning-foreground">Completa moduli, documenti e creatività e invia ai Comuni entro la scadenza, altrimenti le pratiche decadono e gli impianti tornano disponibili. Il pagamento sarà richiesto solo dopo l'approvazione (24 ore di tempo).</span>
          </div>
        )}
        {daPagare.length > 0 && (
          <div className="mt-6 border border-success/20 bg-success-muted rounded-xl px-6 py-4 flex flex-wrap items-center gap-3" data-testid="payment-banner">
            <CreditCard size={20} className="text-success-foreground" />
            <span className="text-sm font-semibold">{daPagare.length} pratiche approvate in attesa di pagamento — tempo rimanente:</span>
            <Countdown scadenza={daPagare[0].payment_due_at} />
            <button data-testid="ooh-checkout-button" onClick={checkout} disabled={busy}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-6 py-2.5 font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-50">
              <CreditCard size={15} /> Paga ora {daPagare.reduce((a, p) => a + p.importo, 0).toFixed(2)} € (mock)
            </button>
          </div>
        )}

        {attiva && (
          <div className="mt-6 border border-slate-100 bg-card rounded-xl overflow-hidden" data-testid="soggetti-panel">
            <div className="px-6 py-4 bg-muted border-b border-slate-100">
              <div className="font-heading font-semibold text-lg">Creatività della campagna</div>
              <div className="text-xs text-slate-500 mt-0.5">1. Verifica i formati richiesti · 2. Indica quanti soggetti per formato e caricali · 3. Assegna ogni soggetto agli impianti nelle pratiche qui sotto.</div>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-5">
              {formatiUtili.map((f) => {
                const slots = numSoggetti[f.formato] || 1;
                const caricati = soggetti.filter((s) => s.formato === f.formato);
                const assegnati = c.pratiche.reduce((n, p) => n + p.impianti.filter((i) => i.formato === f.formato && (p.creativita || []).some((a) => a.impianto_id === i.id)).length, 0);
                return (
                  <div key={f.formato} className="border border-slate-100 rounded-xl p-5" data-testid={`formato-blocco-${f.formato}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-heading font-semibold">{f.formato}</div>
                        <div className="text-xs text-slate-500">{f.n_impianti} impianti · {f.tipologie.join(", ")}</div>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        Soggetti
                        <input type="number" min={1} max={20} data-testid={`num-soggetti-${f.formato}`}
                          className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm bg-card"
                          value={slots} onChange={(e) => setNumSoggetti({ ...numSoggetti, [f.formato]: Math.max(1, parseInt(e.target.value) || 1) })} />
                      </label>
                    </div>
                    <div className="mt-3 space-y-2">
                      {Array.from({ length: slots }, (_, idx) => {
                        const sog = caricati[idx];
                        return (
                          <div key={idx} className="flex items-center gap-3 border border-slate-100 rounded-xl px-3 py-2 text-sm">
                            <span className="text-xs font-semibold text-slate-500 w-20">Soggetto {idx + 1}</span>
                            {sog ? (
                              <>
                                <img src={imgSrc(sog.file_url)} alt="" className="w-10 h-8 object-cover rounded-lg bg-slate-100" />
                                <span className="flex-1 text-xs font-semibold truncate">{sog.file_nome || sog.nome}</span>
                                <button data-testid={`elimina-soggetto-${sog.id}`} onClick={() => eliminaSoggetto(sog)}
                                  className="border border-slate-200 rounded-lg p-1 hover:border-destructive hover:text-destructive transition-colors"><X size={12} /></button>
                              </>
                            ) : (
                              <label className="flex-1 cursor-pointer inline-flex items-center gap-2 justify-center border border-dashed border-slate-300 rounded-md px-4 py-1.5 text-xs font-semibold text-slate-500 hover:border-primary hover:text-brand-foreground transition-colors">
                                <ImagePlus size={13} /> Carica file — formato {f.formato}
                                <input data-testid={`upload-soggetto-${f.formato}-${idx + 1}`} type="file" className="hidden" onChange={(e) => uploadSoggetto(e, f.formato, idx + 1)} />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 text-xs font-semibold" data-testid={`riepilogo-formato-${f.formato}`}>
                      <span className="text-slate-500">{caricati.length} soggetti caricati · </span>
                      <span className={assegnati === f.n_impianti ? "text-brand-foreground" : "text-warning-foreground"}>{assegnati}/{f.n_impianti} impianti assegnati</span>
                      {assegnati < f.n_impianti && <span className="text-destructive"> · {f.n_impianti - assegnati} senza creatività</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {attiva && campiComuni.length > 0 && (
            <div className="border border-primary/30 bg-card rounded-xl overflow-hidden" data-testid="campi-comuni-card">
              <div className="px-6 py-4 bg-accent border-b border-primary/20">
                <div className="font-heading font-semibold text-lg text-brand-foreground">Dati comuni a tutti i Comuni</div>
                <div className="text-xs text-slate-600 mt-0.5">Questi campi sono richiesti da tutti i moduli: compilali una sola volta e verranno applicati a tutte le {editablePratiche.length} pratiche.</div>
              </div>
              <div className="p-6">
                <div className="grid sm:grid-cols-2 gap-3">
                  {campiComuni.filter((f) => isVisible(f, sharedValues)).map((f) => (
                    <DynamicField key={f.id} campo={f} value={sharedValues[f.id]}
                      onChange={(v) => setSharedValues({ ...sharedValues, [f.id]: v })} />
                  ))}
                </div>
                <button data-testid="salva-campi-comuni" onClick={salvaCampiComuni}
                  className="mt-4 bg-primary text-primary-foreground rounded-md px-6 py-2.5 text-sm font-semibold hover:bg-primary transition-colors">
                  Applica a tutte le pratiche
                </button>
              </div>
            </div>
          )}
          {c.pratiche.map((p) => {
            const tpl = templates[p.id] || { campi: [], documenti_richiesti: [] };
            const values = formValues[p.id] || {};
            const merged = { ...sharedValues, ...values };
            const visibili = (tpl.campi || []).filter((f) => !sharedIds.has(f.id)).filter((f) => isVisible(f, merged));
            return (
              <div key={p.id} className="border border-slate-100 bg-card rounded-xl overflow-hidden" data-testid={`ooh-pratica-${p.id}`}>
                <div className="px-6 py-4 bg-muted border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-heading font-semibold text-lg">{practiceLabel(p)}</div>
                    <div className="text-xs text-slate-500">{p.impianti.length} impianti · {p.importo.toFixed(2)} €</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckChip ok={p.checklist.moduli_ok} label="Moduli" />
                    <CheckChip ok={p.checklist.documenti_ok} label="Documenti" />
                    <CheckChip ok={p.checklist.creativita_ok} label="Creatività" />
                    <StatusBadge stato={p.stato} />
                  </div>
                </div>

                {editable(p) && (
                  <div className="p-6 grid lg:grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs font-semibold tracking-normal text-slate-500 mb-3">Modulo "{tpl.nome}"</div>
                      <div className="grid gap-3">
                        {visibili.map((f) => (
                          <DynamicField key={f.id} campo={f} value={values[f.id]}
                            onChange={(v) => setFormValues({ ...formValues, [p.id]: { ...values, [f.id]: v } })} />
                        ))}
                        {visibili.length === 0 && campiComuni.length > 0 && (
                          <div className="text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl px-3 py-2">Tutti i campi di questo modulo sono coperti dai "Dati comuni" qui sopra.</div>
                        )}
                      </div>
                      <button data-testid={`salva-modulo-${p.id}`} onClick={() => salvaModulo(p)}
                        className="mt-3 border border-slate-200 rounded-md px-5 py-2 text-sm font-semibold hover:border-primary hover:text-brand-foreground transition-colors">
                        Salva modulo
                      </button>
                      <div className="text-xs font-semibold tracking-normal text-slate-500 mt-6 mb-2">Documentazione</div>
                      {(tpl.documenti_richiesti || []).map((d) => {
                        const caricati = (p.documenti || []).filter((x) => x.tipo === d.id);
                        return (
                          <div key={d.id} className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-xl px-4 py-2 mb-2">
                            <span className="text-sm font-semibold flex-1 min-w-[140px]">{d.label}{d.required && <span className="text-destructive"> *</span>}</span>
                            <AttachmentLink field={d} />
                            <span className="text-xs text-slate-500">{caricati.map((x) => x.nome).join(", ") || "Nessun file"}</span>
                            <label className="cursor-pointer inline-flex items-center gap-2 border border-slate-200 rounded-md px-4 py-1.5 text-xs font-semibold hover:border-primary hover:text-brand-foreground transition-colors">
                              <Upload size={13} /> Carica
                              <input data-testid={`ooh-upload-${p.id}-${d.id}`} type="file" className="hidden" onChange={(e) => uploadDoc(e, p, d)} />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <div className="text-xs font-semibold tracking-normal text-slate-500 mb-3">Assegnazione creatività per impianto</div>
                      <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                        {installationGroups(p).map(group => <section key={group.zona} className="space-y-2"><h4 className="text-sm font-semibold">{group.zona} · {group.impianti.length} impianti</h4>{group.impianti.map((imp) => {
                          const assegnata = (p.creativita || []).find((a) => a.impianto_id === imp.id);
                          const compatibili = soggetti.filter((sg) => sg.formato === imp.formato);
                          return (
                            <div key={imp.id} className="flex items-center gap-3 border border-slate-100 rounded-xl px-3 py-2" data-testid={`ooh-impianto-cr-${imp.id}`}>
                              <img src={imgSrc(imp.foto_url)} alt="" className="w-11 h-9 object-cover rounded-lg" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold">{imp.codice} · {imp.tipologia}</div>
                                {imp.circuito_nome && <div className="text-xs text-muted-foreground">Circuito: {imp.circuito_nome}</div>}
                                <div className="text-[10px] text-slate-500">{imp.via} · {imp.formato}{isDooh(imp.tipologia) ? " · DOOH" : ""}</div>
                              </div>
                              {assegnata ? (
                                <span className="text-[11px] font-semibold text-brand-foreground bg-accent rounded-md px-2.5 py-1 max-w-[140px] truncate">{assegnata.creativita_nome}</span>
                              ) : null}
                              <select data-testid={`ooh-assegna-${imp.id}`} className="border border-slate-200 rounded-lg text-xs px-2 py-1.5 max-w-[150px] bg-card"
                                value="" onChange={(e) => assegna(p, imp, e.target.value)}>
                                <option value="">{assegnata ? "Cambia..." : compatibili.length ? "Assegna..." : "Carica prima un soggetto"}</option>
                                {compatibili.map((sg) => <option key={sg.id} value={sg.id}>{sg.nome}</option>)}
                              </select>
                            </div>
                          );
                        })}</section>)}
                      </div>
                    </div>
                  </div>
                )}
                {!editable(p) && (
                  <div className="px-6 py-4 text-sm text-slate-500">
                    {p.stato === "PRENOTAZIONE_SCADUTA" ? "Il blocco di 24 ore è scaduto: gli impianti sono stati liberati." :
                      p.stato === "ANNULLATA" ? "Pratica annullata." :
                        <Link to={`/pratiche/${p.id}`} className="font-semibold text-brand-foreground hover:underline">Apri la pratica per seguire l'iter del Comune →</Link>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {attiva && (
          <div className="mt-8 flex flex-wrap gap-3 justify-end">
            <button data-testid="ooh-annulla-button" onClick={annulla}
              className="border border-slate-200 rounded-md px-6 py-3 font-semibold hover:border-destructive hover:text-destructive transition-colors">
              Annulla campagna
            </button>
            {!tuttoCompleto && <span className="text-xs text-slate-500 self-center">Completa moduli, documenti e creatività per inviare</span>}
            <button data-testid="ooh-invia-button" onClick={invia} disabled={busy || !tuttoCompleto}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-7 py-3 font-semibold hover:bg-primary transition-colors disabled:opacity-50"
              title={tuttoCompleto ? "" : "Completa moduli, documenti e creatività"}>
              <Send size={17} /> Invia ai Comuni
            </button>
          </div>
        )}
      </div>
    </UserShell>
  );
}
