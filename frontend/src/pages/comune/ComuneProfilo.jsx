import { useEffect, useState } from "react";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { api, apiError, imgSrc } from "../../lib/api";
import { toast } from "sonner";
import { Landmark, Check } from "lucide-react";

export default function ComuneProfilo() {
  const [profilo, setProfilo] = useState(null);
  const [spazi, setSpazi] = useState([]);

  useEffect(() => {
    api.get("/comune/profilo").then(({ data }) => setProfilo(data));
    api.get("/comune/spazi").then(({ data }) => setSpazi(data));
  }, []);

  if (!profilo) return <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}><div className="text-slate-500">Caricamento...</div></BackofficeLayout>;

  const save = async () => {
    try {
      await api.put("/comune/profilo", { tariffe: profilo.tariffe, regole: profilo.regole });
      toast.success("Profilo aggiornato");
    } catch (e) { toast.error(apiError(e)); }
  };

  const saveCanone = async (s) => {
    try {
      await api.patch(`/comune/spazi/${s.id}/canone`, { canone_giornaliero: parseFloat(s.canone_giornaliero) });
      toast.success(`Canone aggiornato: ${s.nome}`);
    } catch (e) { toast.error(apiError(e)); }
  };

  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#2F5B41] transition-colors w-full bg-white";

  return (
    <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {profilo.logo_url ? (
            <img data-testid="comune-logo" src={imgSrc(profilo.logo_url)} alt="logo" className="w-12 h-12 rounded-xl object-contain border border-slate-100 bg-white" />
          ) : (
            <span className="w-12 h-12 rounded-xl bg-[#EEF2EC] flex items-center justify-center text-[#2F5B41]"><Landmark size={20} /></span>
          )}
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">Profilo & tariffe</h1>
        </div>
        <button data-testid="salva-profilo-button" onClick={save}
          className="bg-[#2F5B41] text-white rounded-full px-6 py-2.5 font-bold hover:bg-[#26492F] transition-colors">Salva</button>
      </div>

      <div className="mt-6 grid md:grid-cols-3 border border-slate-100 rounded-2xl overflow-hidden divide-x divide-slate-100 bg-white">
        <div className="p-5"><div className="text-xs uppercase tracking-wider text-slate-500">Comune</div><div className="font-heading font-extrabold text-2xl">{profilo.nome}</div></div>
        <div className="p-5"><div className="text-xs uppercase tracking-wider text-slate-500">Regione</div><div className="font-heading font-extrabold text-2xl">{profilo.regione}</div></div>
        <div className="p-5"><div className="text-xs uppercase tracking-wider text-slate-500">Provincia</div><div className="font-heading font-extrabold text-2xl">{profilo.provincia}</div></div>
      </div>

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#FAFAF8]">Tariffario base (€/giorno)</div>
        <div className="p-5 space-y-3">
          {profilo.tariffe.map((t, i) => (
            <div key={i} className="flex gap-3 items-center">
              <input className={input} value={t.tipologia}
                onChange={(e) => { const tt = [...profilo.tariffe]; tt[i] = { ...tt[i], tipologia: e.target.value }; setProfilo({ ...profilo, tariffe: tt }); }} />
              <input data-testid={`tariffa-${i}`} className={`${input} max-w-[140px]`} type="number" step="0.5" value={t.canone_giornaliero}
                onChange={(e) => { const tt = [...profilo.tariffe]; tt[i] = { ...tt[i], canone_giornaliero: parseFloat(e.target.value) || 0 }; setProfilo({ ...profilo, tariffe: tt }); }} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden" data-testid="tariffario-spazi">
        <div className="px-5 py-2.5 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#FAFAF8]">Canone per singolo spazio (€/giorno)</div>
        <div className="divide-y divide-slate-100">
          {spazi.map((s, i) => (
            <div key={s.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <div className="font-bold text-sm">{s.nome}</div>
                <div className="text-xs text-slate-400">{s.tipologia}{s.formato ? ` · ${s.formato}` : ""}{s.zona ? ` · ${s.zona}` : ""}</div>
              </div>
              <input data-testid={`canone-spazio-${s.id}`} className={`${input} max-w-[120px]`} type="number" step="0.5" value={s.canone_giornaliero}
                onChange={(e) => { const ss = [...spazi]; ss[i] = { ...ss[i], canone_giornaliero: e.target.value }; setSpazi(ss); }} />
              <button data-testid={`salva-canone-${s.id}`} onClick={() => saveCanone(s)}
                className="inline-flex items-center gap-1.5 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-bold hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors">
                <Check size={13} /> Salva
              </button>
            </div>
          ))}
          {spazi.length === 0 && <div className="px-5 py-6 text-sm text-slate-500">Nessuno spazio a catalogo.</div>}
        </div>
      </div>

      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#FAFAF8]">Regole e note per i richiedenti</div>
        <div className="p-5">
          <textarea data-testid="regole-textarea" className={input} rows={4} value={profilo.regole}
            onChange={(e) => setProfilo({ ...profilo, regole: e.target.value })} />
        </div>
      </div>
    </BackofficeLayout>
  );
}
