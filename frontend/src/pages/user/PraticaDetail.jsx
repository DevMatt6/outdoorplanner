import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { StatusBadge, STATO_COLORS } from "../../components/StatusBadge";
import { ChatFloating } from "../../components/ChatFloating";
import { SezioneRichiedente, SezionePrenotazione, SezioneImpiantiCreativita, SezioneDatiForm, SezioneDocumenti } from "../../components/PraticaDettagli";
import { IntegrazioneEditor } from "../../components/IntegrazioneEditor";
import { api, apiError, API } from "../../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Download, Upload, Send, CreditCard } from "lucide-react";

export default function PraticaDetail() {
  const { id } = useParams();
  const [pratica, setPratica] = useState(null);

  const load = () => api.get(`/pratiche/${id}`).then(({ data }) => setPratica(data));
  useEffect(() => { load(); }, [id]);

  if (!pratica) return <UserShell><div className="text-slate-500">Caricamento...</div></UserShell>;

  const uploadIntegrazione = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/pratiche/${pratica.id}/documenti?tipo=integrazione`, fd);
      toast.success("Documento caricato");
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const inviaIntegrazione = async () => {
    try {
      await api.post(`/pratiche/${pratica.id}/invia`);
      toast.success(pratica.tipo === "OOH" ? "Integrazione inviata, pratica di nuovo in verifica" : "Integrazione inviata, pratica di nuovo in istruttoria");
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const pagaOra = async () => {
    try {
      await api.post(`/ooh/pratiche/${pratica.id}/paga`);
      toast.success("Pagamento registrato: impianti confermati");
      load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const scaricaPdf = async () => {
    const res = await fetch(`${API}/pratiche/${pratica.id}/autorizzazione`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("op_token")}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autorizzazione_${pratica.numero_autorizzazione || pratica.id.slice(0, 8)}.pdf`;
    a.click();
  };

  const motivoIntegrazione = [...(pratica.log_stato || [])].reverse().find((l) => l.a === "INTEGRAZIONE_RICHIESTA")?.nota;

  return (
    <UserShell>
      <div className="max-w-6xl mx-auto" data-testid="pratica-detail">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} /> Le mie pratiche
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h1 className="text-3xl font-heading font-extrabold tracking-tight">{pratica.spazio_nome}</h1>
            <div className="text-sm text-slate-600 font-mono mt-1">{pratica.data_inizio} → {pratica.data_fine} · {pratica.importo.toFixed(2)} € {pratica.pagata && "· pagata ✓"}</div>
          </div>
          <StatusBadge stato={pratica.stato} />
        </div>

        {pratica.stato === "APPROVATA" && (
          <div className="mt-6 border border-emerald-200 bg-emerald-50 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-heading font-extrabold text-lg">Autorizzazione {pratica.numero_autorizzazione}</div>
              <div className="text-sm text-slate-600">Rilasciata dal Comune di {pratica.comune?.nome}</div>
              {!pratica.pagata && pratica.payment_due_at && (
                <div className="text-sm font-bold text-[#B45309] mt-1" data-testid="payment-deadline">
                  Paga entro il {new Date(pratica.payment_due_at).toLocaleString("it-IT")} o la prenotazione decade e gli impianti tornano disponibili.
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {!pratica.pagata && pratica.tipo === "OOH" && (
                <button data-testid="paga-ora-button" onClick={pagaOra}
                  className="inline-flex items-center gap-2 bg-[#B45309] text-white rounded-full px-6 py-3 font-bold hover:bg-slate-900 transition-colors">
                  <CreditCard size={17} /> Paga ora {pratica.importo.toFixed(2)} € (mock)
                </button>
              )}
              <button data-testid="download-pdf-button" onClick={scaricaPdf}
                className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-6 py-3 font-bold hover:bg-[#172E93] transition-colors">
                <Download size={17} /> Scarica PDF
              </button>
            </div>
          </div>
        )}

        {pratica.stato === "INTEGRAZIONE_RICHIESTA" && (
          <div className="mt-6 border border-red-200 bg-red-50 rounded-2xl p-5" data-testid="integrazione-box">
            <div className="font-heading font-extrabold text-lg text-[#B91C1C]">Il Comune richiede modifiche / integrazioni</div>
            {motivoIntegrazione && <p className="text-sm text-slate-800 mt-1 font-semibold" data-testid="motivo-integrazione">Motivazione: "{motivoIntegrazione}"</p>}
            {(pratica.integrazione_richieste || []).length > 0 && (
              <div className="mt-3 space-y-1.5" data-testid="lista-richieste">
                {pratica.integrazione_richieste.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 bg-white border border-red-200 rounded-xl px-3 py-2 text-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#FEE2E2] text-[#B91C1C] px-2 py-0.5">
                      {r.tipo === "campo" ? "Campo" : r.tipo === "documento" ? "Documento" : "Creatività"}
                    </span>
                    <span className="font-bold">{r.label}</span>
                    {r.nota && <span className="text-slate-600 italic">— "{r.nota}"</span>}
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-700 mt-1">Correggi i dati del modulo o le creatività qui sotto, carica eventuali documenti richiesti e reinvia la pratica.</p>
            <IntegrazioneEditor pratica={pratica} reload={load} />
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 border-2 border-slate-900 bg-white px-5 py-2.5 text-sm font-bold hover:bg-[#1F3BB3] hover:text-white transition-colors">
                <Upload size={15} /> Carica documento
                <input data-testid="upload-integrazione" type="file" className="hidden" onChange={uploadIntegrazione} />
              </label>
              <button data-testid="invia-integrazione-button" onClick={inviaIntegrazione}
                className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-5 py-2.5 text-sm font-bold hover:bg-[#172E93] transition-colors">
                <Send size={15} /> Reinvia al Comune
              </button>
            </div>
          </div>
        )}

        {pratica.stato === "ANNULLATA" && pratica.annullata_da === "comune" && (
          <div className="mt-6 border border-slate-200 bg-[#F8F9FD] rounded-2xl p-5" data-testid="annullata-box">
            <div className="font-heading font-extrabold text-lg text-slate-700">Pratica annullata dal Comune</div>
            <p className="text-sm text-slate-600 mt-1">Gli impianti prenotati sono stati liberati. Consulta la cronologia per la motivazione.</p>
          </div>
        )}

        <div className="mt-8 grid lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <SezionePrenotazione pratica={pratica} />
            <SezioneRichiedente richiedente={pratica.richiedente} />
            <SezioneDatiForm dati={pratica.dati_form} />
          </div>
          <div className="space-y-6">
            <SezioneImpiantiCreativita pratica={pratica} />
            <SezioneDocumenti documenti={pratica.documenti} />
            <div className="border border-slate-100 bg-white rounded-2xl overflow-hidden">
              <div className="px-5 py-2.5 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#F8F9FD]">Cronologia stati</div>
              <div className="p-5 space-y-0">
                {pratica.log_stato.map((l, i) => (
                  <div key={l.id} className="flex gap-4 pb-5 last:pb-0 relative">
                    <div className="flex flex-col items-center">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: STATO_COLORS[l.a]?.dot }} />
                      {i < pratica.log_stato.length - 1 && <span className="w-px flex-1 bg-slate-300 mt-1" />}
                    </div>
                    <div className="pb-1 -mt-0.5">
                      <div className="text-sm font-bold">{STATO_COLORS[l.a]?.label || l.a}</div>
                      <div className="text-xs text-slate-500">{l.autore_nome} · {new Date(l.timestamp).toLocaleString("it-IT")}</div>
                      {l.nota && <div className="text-xs text-slate-600 mt-0.5 italic">"{l.nota}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <ChatFloating praticaId={pratica.id} />
      </div>
    </UserShell>
  );
}
