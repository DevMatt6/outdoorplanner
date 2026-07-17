import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { NavBar } from "../../components/NavBar";
import { StatusBadge, STATO_COLORS } from "../../components/StatusBadge";
import { Chat } from "../../components/Chat";
import { api, apiError, API } from "../../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Download, Upload, Send } from "lucide-react";

export default function PraticaDetail() {
  const { id } = useParams();
  const [pratica, setPratica] = useState(null);

  const load = () => api.get(`/pratiche/${id}`).then(({ data }) => setPratica(data));
  useEffect(() => { load(); }, [id]);

  if (!pratica) return <div><NavBar /><div className="p-12 text-slate-500">Caricamento...</div></div>;

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
      toast.success("Integrazione inviata, pratica di nuovo in istruttoria");
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

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-10" data-testid="pratica-detail">
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
          <div className="mt-6 border-2 border-[#10B981] bg-emerald-50 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-heading font-extrabold text-lg">Autorizzazione {pratica.numero_autorizzazione}</div>
              <div className="text-sm text-slate-600">Rilasciata dal Comune di {pratica.comune?.nome}</div>
            </div>
            <button data-testid="download-pdf-button" onClick={scaricaPdf}
              className="inline-flex items-center gap-2 bg-[#10B981] text-slate-950 px-6 py-3 font-bold hover:bg-slate-900 hover:text-white transition-colors">
              <Download size={17} /> Scarica PDF
            </button>
          </div>
        )}

        {pratica.stato === "INTEGRAZIONE_RICHIESTA" && (
          <div className="mt-6 border-2 border-[#EF4444] bg-red-50 p-5" data-testid="integrazione-box">
            <div className="font-heading font-extrabold text-lg text-[#B91C1C]">Il Comune richiede un'integrazione</div>
            <p className="text-sm text-slate-700 mt-1">Carica i documenti richiesti (vedi chat) e reinvia la pratica.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 border-2 border-slate-900 bg-white px-5 py-2.5 text-sm font-bold hover:bg-slate-900 hover:text-white transition-colors">
                <Upload size={15} /> Carica documento
                <input data-testid="upload-integrazione" type="file" className="hidden" onChange={uploadIntegrazione} />
              </label>
              <button data-testid="invia-integrazione-button" onClick={inviaIntegrazione}
                className="inline-flex items-center gap-2 bg-[#0033FF] text-white px-5 py-2.5 text-sm font-bold hover:bg-[#0A3D91] transition-colors">
                <Send size={15} /> Reinvia al Comune
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="border border-slate-900 bg-white">
              <div className="px-5 py-2.5 border-b border-slate-900 text-xs font-bold uppercase tracking-widest bg-slate-50">Cronologia stati</div>
              <div className="p-5 space-y-0">
                {pratica.log_stato.map((l, i) => (
                  <div key={l.id} className="flex gap-4 pb-5 last:pb-0 relative">
                    <div className="flex flex-col items-center">
                      <span className="w-3.5 h-3.5 border-2 border-slate-900" style={{ backgroundColor: STATO_COLORS[l.a]?.bg }} />
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
            <div className="border border-slate-300 bg-white">
              <div className="px-5 py-2.5 border-b border-slate-300 text-xs font-bold uppercase tracking-widest bg-slate-50">Documenti ({pratica.documenti.length})</div>
              {pratica.documenti.length === 0 && <div className="p-5 text-sm text-slate-500">Nessun documento caricato.</div>}
              {pratica.documenti.map((d) => (
                <a key={d.id} href={`${process.env.REACT_APP_BACKEND_URL}${d.url}`} target="_blank" rel="noreferrer"
                  className="flex justify-between px-5 py-3 border-b border-slate-200 text-sm hover:bg-blue-50 transition-colors">
                  <span className="font-semibold">{d.nome}</span>
                  <span className="text-xs text-slate-500 uppercase">{d.tipo}</span>
                </a>
              ))}
            </div>
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
          </div>
          <Chat praticaId={pratica.id} />
        </div>
      </div>
    </div>
  );
}
