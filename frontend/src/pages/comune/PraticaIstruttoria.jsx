import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { StatusBadge, STATO_COLORS } from "../../components/StatusBadge";
import { Chat } from "../../components/Chat";
import { api, apiError, API } from "../../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Download } from "lucide-react";

export default function PraticaIstruttoria() {
  const { id } = useParams();
  const [pratica, setPratica] = useState(null);
  const [nota, setNota] = useState("");

  const load = () => api.get(`/pratiche/${id}`).then(({ data }) => setPratica(data));
  useEffect(() => { load(); }, [id]);

  if (!pratica) return <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}><div className="text-slate-500">Caricamento...</div></BackofficeLayout>;

  const azione = async (az, label) => {
    try {
      await api.post(`/comune/pratiche/${pratica.id}/transizione`, { azione: az, nota });
      toast.success(label);
      setNota("");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const scaricaPdf = async () => {
    const res = await fetch(`${API}/pratiche/${pratica.id}/autorizzazione`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("op_token")}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autorizzazione_${pratica.numero_autorizzazione}.pdf`;
    a.click();
  };

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <Link to="/comune" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
        <ArrowLeft size={16} /> Scrivania
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight" data-testid="istruttoria-title">{pratica.spazio_nome}</h1>
          <div className="text-sm text-slate-600 mt-1">Richiedente: <strong>{pratica.user_nome}</strong> · {pratica.data_inizio} → {pratica.data_fine} · {pratica.importo.toFixed(2)} € {pratica.pagata ? "(pagata ✓)" : "(non pagata)"}</div>
        </div>
        <StatusBadge stato={pratica.stato} />
      </div>

      <div className="mt-6 border-2 border-slate-900 bg-white p-6" data-testid="istruttoria-actions">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Azioni istruttoria</div>
        <textarea data-testid="nota-istruttoria" value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
          placeholder="Nota / motivazione (visibile al richiedente)..."
          className="w-full border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0033FF] focus:border-2 transition-colors" />
        <div className="mt-3 flex flex-wrap gap-3">
          {pratica.stato === "INVIATA" && (
            <button data-testid="btn-presa-in-carico" onClick={() => azione("presa_in_carico", "Pratica presa in carico")}
              className="px-5 py-2.5 font-bold text-sm bg-[#F59E0B] text-slate-950 hover:bg-slate-900 hover:text-white transition-colors">
              Prendi in carico
            </button>
          )}
          {pratica.stato === "IN_ISTRUTTORIA" && (
            <>
              <button data-testid="btn-approva" onClick={() => azione("approva", "Pratica approvata")}
                className="px-5 py-2.5 font-bold text-sm bg-[#10B981] text-slate-950 hover:bg-slate-900 hover:text-white transition-colors">
                Approva
              </button>
              <button data-testid="btn-integrazione" onClick={() => azione("richiedi_integrazione", "Integrazione richiesta")}
                className="px-5 py-2.5 font-bold text-sm bg-[#EF4444] text-white hover:bg-slate-900 transition-colors">
                Richiedi integrazione
              </button>
              <button data-testid="btn-rifiuta" onClick={() => azione("rifiuta", "Pratica rifiutata")}
                className="px-5 py-2.5 font-bold text-sm bg-[#0F172A] text-white hover:bg-[#EF4444] transition-colors">
                Rifiuta
              </button>
            </>
          )}
          {pratica.stato === "INTEGRAZIONE_RICHIESTA" && <span className="text-sm text-slate-500 py-2.5">In attesa di integrazione dal richiedente.</span>}
          {pratica.stato === "APPROVATA" && (
            <button data-testid="btn-pdf-comune" onClick={scaricaPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 font-bold text-sm border-2 border-[#10B981] text-[#059669] hover:bg-[#10B981] hover:text-slate-950 transition-colors">
              <Download size={15} /> PDF autorizzazione {pratica.numero_autorizzazione}
            </button>
          )}
          {pratica.stato === "RIFIUTATA" && <span className="text-sm text-slate-500 py-2.5">Pratica chiusa con rifiuto.</span>}
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="border border-slate-300 bg-white">
            <div className="px-5 py-2.5 border-b border-slate-300 text-xs font-bold uppercase tracking-widest bg-slate-50">Dati dichiarati</div>
            <div className="p-5 grid grid-cols-2 gap-3 text-sm">
              {Object.entries(pratica.dati_form || {}).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k.replaceAll("_", " ")}</div>
                  <div className="font-semibold">{String(v === true ? "Sì" : v === false ? "No" : v)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-slate-300 bg-white">
            <div className="px-5 py-2.5 border-b border-slate-300 text-xs font-bold uppercase tracking-widest bg-slate-50">Documenti ({pratica.documenti.length})</div>
            {pratica.documenti.length === 0 && <div className="p-5 text-sm text-slate-500">Nessun documento.</div>}
            {pratica.documenti.map((d) => (
              <a key={d.id} href={`${process.env.REACT_APP_BACKEND_URL}${d.url}`} target="_blank" rel="noreferrer"
                className="flex justify-between px-5 py-3 border-b border-slate-200 text-sm hover:bg-blue-50 transition-colors">
                <span className="font-semibold">{d.nome}</span>
                <span className="text-xs text-slate-500 uppercase">{d.tipo}</span>
              </a>
            ))}
          </div>
          <div className="border border-slate-300 bg-white">
            <div className="px-5 py-2.5 border-b border-slate-300 text-xs font-bold uppercase tracking-widest bg-slate-50">Log stati</div>
            <div className="p-5 space-y-2">
              {pratica.log_stato.map((l) => (
                <div key={l.id} className="flex items-center gap-3 text-xs">
                  <span className="w-2.5 h-2.5 border border-slate-900" style={{ backgroundColor: STATO_COLORS[l.a]?.bg }} />
                  <span className="font-bold w-40">{l.da ? `${l.da} → ${l.a}` : l.a}</span>
                  <span className="text-slate-500">{l.autore_nome} · {new Date(l.timestamp).toLocaleString("it-IT")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Chat praticaId={pratica.id} />
      </div>
    </BackofficeLayout>
  );
}
