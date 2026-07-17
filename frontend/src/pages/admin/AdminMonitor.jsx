import { useEffect, useState } from "react";
import { BackofficeLayout, ADMIN_LINKS } from "../../components/BackofficeLayout";
import { api } from "../../lib/api";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function AdminMonitor() {
  const [anomalie, setAnomalie] = useState(null);

  useEffect(() => {
    api.get("/admin/anomalie").then(({ data }) => setAnomalie(data));
  }, []);

  return (
    <BackofficeLayout title="Superadmin" links={ADMIN_LINKS}>
      <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight" data-testid="monitor-title">Monitor anomalie e flussi</h1>
      <p className="text-sm text-slate-600 mt-1">Pratiche ferme oltre le soglie di servizio: presa in carico &gt; 3 giorni, istruttoria &gt; 7 giorni.</p>
      <div className="mt-6 border border-slate-100 bg-white rounded-2xl overflow-hidden">
        {anomalie === null && <div className="p-6 text-slate-500">Caricamento...</div>}
        {anomalie?.length === 0 && (
          <div className="p-10 text-center">
            <CheckCircle2 size={32} className="mx-auto text-[#10B981]" />
            <div className="font-heading font-extrabold text-lg mt-3">Nessuna anomalia rilevata</div>
            <div className="text-sm text-slate-500">Tutti i flussi rientrano nelle soglie di servizio.</div>
          </div>
        )}
        {anomalie?.map((a, i) => (
          <div key={i} className="flex items-start gap-4 px-5 py-4 border-b border-slate-200" data-testid={`anomalia-${i}`}>
            <AlertTriangle size={20} className="text-[#F59E0B] mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest bg-[#F59E0B] text-slate-950 px-2 py-0.5 inline-block">{a.tipo}</div>
              <div className="text-sm font-semibold mt-1">{a.descrizione}</div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">pratica {a.pratica_id}</div>
            </div>
          </div>
        ))}
      </div>
    </BackofficeLayout>
  );
}
