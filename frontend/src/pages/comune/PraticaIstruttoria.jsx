import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { StatusBadge, STATO_COLORS } from "../../components/StatusBadge";
import { Chat } from "../../components/Chat";
import { SezioneRichiedente, SezionePrenotazione, SezioneImpiantiCreativita, SezioneDatiForm, SezioneDocumenti } from "../../components/PraticaDettagli";
import { api, apiError, API } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { toast } from "sonner";
import { ArrowLeft, Download, Lock } from "lucide-react";

export default function PraticaIstruttoria() {
  const { id } = useParams();
  const { user } = useAuth();
  const livello = user?.livello || 1;
  const [pratica, setPratica] = useState(null);
  const [nota, setNota] = useState("");
  const [showIntegra, setShowIntegra] = useState(false);
  const [richieste, setRichieste] = useState({});

  const load = () => api.get(`/pratiche/${id}`).then(({ data }) => setPratica(data));
  useEffect(() => { load(); }, [id]);

  if (!pratica) return <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}><div className="text-slate-500">Caricamento...</div></BackofficeLayout>;

  const maxLv = Math.max(...((pratica.comune?.livelli_attivi || [1, 2, 3])));
  const can = (min) => livello >= Math.min(min, maxLv);
  const inIstruttoria = ["IN_ISTRUTTORIA", "IN_VERIFICA"].includes(pratica.stato);

  const azione = async (az, label, notaObbligatoria = false) => {
    if (notaObbligatoria && !nota.trim()) return toast.error("Inserisci la motivazione: indica quali dati o file vanno corretti");
    try {
      await api.post(`/comune/pratiche/${pratica.id}/transizione`, { azione: az, nota });
      toast.success(label);
      setNota("");
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const toggleRichiesta = (tipo, id, label) => {
    const k = `${tipo}:${id}`;
    setRichieste((r) => { const n = { ...r }; if (n[k]) delete n[k]; else n[k] = { tipo, id, label, nota: "" }; return n; });
  };

  const inviaRichiestaIntegrazione = async () => {
    const lista = Object.values(richieste);
    if (lista.length === 0 && !nota.trim()) return toast.error("Seleziona almeno un elemento da correggere o scrivi una nota");
    try {
      await api.post(`/comune/pratiche/${pratica.id}/transizione`, {
        azione: "richiedi_integrazione",
        nota: nota.trim() || "Correggi gli elementi indicati nella richiesta",
        richieste: lista,
      });
      toast.success("Richiesta di modifiche/integrazione inviata");
      setNota(""); setRichieste({}); setShowIntegra(false);
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

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl p-6" data-testid="istruttoria-actions">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Azioni istruttoria</div>
        <textarea data-testid="nota-istruttoria" value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
          placeholder="Nota / motivazione (visibile al richiedente): indica quali dati o file vanno corretti..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1F3BB3] transition-colors" />
        <div className="mt-3 flex flex-wrap gap-3">
          {pratica.stato === "INVIATA" && (
            <button data-testid="btn-presa-in-carico" onClick={() => azione("presa_in_carico", "Pratica presa in carico")}
              className="px-5 py-2.5 rounded-full font-bold text-sm bg-[#F59E0B] text-white hover:bg-[#B45309] transition-colors">
              Prendi in carico
            </button>
          )}
          {inIstruttoria && (
            <>
              {can(2) ? (
                <>
                  <button data-testid="btn-approva" onClick={() => azione("approva", "Pratica approvata")}
                    className="px-5 py-2.5 rounded-full font-bold text-sm bg-[#1F3BB3] text-white hover:bg-[#172E93] transition-colors">
                    Approva
                  </button>
                  <button data-testid="btn-rifiuta" onClick={() => azione("rifiuta", "Pratica rifiutata")}
                    className="px-5 py-2.5 rounded-full font-bold text-sm bg-[#26292B] text-white hover:bg-[#EF4444] transition-colors">
                    Rifiuta
                  </button>
                  <button data-testid="btn-annulla" onClick={() => azione("annulla", "Pratica annullata", true)}
                    className="px-5 py-2.5 rounded-full font-bold text-sm border-2 border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900 transition-colors">
                    Annulla pratica
                  </button>
                </>
              ) : (
                <span data-testid="livello-lock-msg" className="inline-flex items-center gap-1.5 text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl px-4 py-2.5">
                  <Lock size={14} /> Approvazione, rifiuto e annullamento riservati al livello L{Math.min(2, maxLv)}+
                </span>
              )}
              <button data-testid="btn-integrazione" onClick={() => setShowIntegra((v) => !v)}
                className={`px-5 py-2.5 rounded-full font-bold text-sm transition-colors ${showIntegra ? "bg-slate-900 text-white" : "bg-[#EF4444] text-white hover:bg-slate-900"}`}>
                Richiedi modifiche / integrazione
              </button>
            </>
          )}
          {pratica.stato === "INTEGRAZIONE_RICHIESTA" && <span className="text-sm text-slate-500 py-2.5">In attesa di integrazione dal richiedente.</span>}          {pratica.stato === "APPROVATA" && (
            <button data-testid="btn-pdf-comune" onClick={scaricaPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 font-bold text-sm border border-emerald-200 text-[#1F3BB3] rounded-full bg-emerald-50 hover:bg-[#10B981] hover:text-slate-950 transition-colors">
              <Download size={15} /> PDF autorizzazione {pratica.numero_autorizzazione}
            </button>
          )}
          {pratica.stato === "RIFIUTATA" && <span className="text-sm text-slate-500 py-2.5">Pratica chiusa con rifiuto.</span>}
          {pratica.stato === "ANNULLATA" && <span className="text-sm text-slate-500 py-2.5">Pratica annullata: gli impianti sono stati liberati.</span>}
        </div>

        {showIntegra && inIstruttoria && (
          <div className="mt-4 border border-amber-200 bg-amber-50/60 rounded-xl p-4" data-testid="integrazione-panel">
            <div className="text-xs font-bold uppercase tracking-widest text-[#B45309] mb-3">Seleziona gli elementi da correggere o sostituire</div>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                ["campo", "Campi del modulo", (pratica.template?.campi || []).map((x) => ({ id: x.id, label: x.label || x.id }))],
                ["documento", "Documenti", (pratica.template?.documenti_richiesti || []).map((x) => ({ id: x.id, label: x.label || x.id }))],
                ["creativita", "Creatività / impianti", (pratica.impianti || []).map((x) => ({ id: x.id, label: `Creatività impianto ${x.codice}` }))],
              ].filter(([, , items]) => items.length > 0).map(([tipo, titolo, items]) => (
                <div key={tipo}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{titolo}</div>
                  <div className="space-y-1.5">
                    {items.map((it) => {
                      const k = `${tipo}:${it.id}`;
                      const attiva = !!richieste[k];
                      return (
                        <div key={k} className={`border rounded-xl px-3 py-2 bg-white transition-colors ${attiva ? "border-[#B45309]" : "border-slate-200"}`}>
                          <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`richiesta-${tipo}-${it.id}`}>
                            <input type="checkbox" checked={attiva} onChange={() => toggleRichiesta(tipo, it.id, it.label)} className="accent-[#B45309] w-4 h-4" />
                            <span className="font-semibold">{it.label}</span>
                          </label>
                          {attiva && (
                            <input data-testid={`nota-richiesta-${tipo}-${it.id}`} value={richieste[k].nota}
                              onChange={(e) => setRichieste((r) => ({ ...r, [k]: { ...r[k], nota: e.target.value } }))}
                              placeholder="Nota per il richiedente (es. file illeggibile, valore errato...)"
                              className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#B45309] transition-colors" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button data-testid="btn-invia-integrazione" onClick={inviaRichiestaIntegrazione}
                className="px-5 py-2.5 rounded-full font-bold text-sm bg-[#B45309] text-white hover:bg-slate-900 transition-colors">
                Invia richiesta ({Object.keys(richieste).length} elementi)
              </button>
              <span className="text-xs text-slate-500">La nota generale scritta sopra verrà inclusa nella richiesta.</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <SezionePrenotazione pratica={pratica} />
          <SezioneRichiedente richiedente={pratica.richiedente} />
          <SezioneImpiantiCreativita pratica={pratica} />
          <SezioneDatiForm dati={pratica.dati_form} />
          <SezioneDocumenti documenti={pratica.documenti} />
          <div className="border border-slate-100 bg-white rounded-2xl">
            <div className="px-5 py-2.5 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#F8F9FD]">Log stati</div>
            <div className="p-5 space-y-2">
              {pratica.log_stato.map((l) => (
                <div key={l.id} className="text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATO_COLORS[l.a]?.dot }} />
                    <span className="font-bold w-40">{l.da ? `${l.da} → ${l.a}` : l.a}</span>
                    <span className="text-slate-500">{l.autore_nome} · {new Date(l.timestamp).toLocaleString("it-IT")}</span>
                  </div>
                  {l.nota && <div className="ml-5 text-slate-600 italic mt-0.5">"{l.nota}"</div>}
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
