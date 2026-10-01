import { SavedCampaignBrief } from "../../components/CampaignBrief";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { StatusBadge } from "../../components/StatusBadge";
import { api, apiError } from "../../lib/api";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CreditCard, Send } from "lucide-react";

export default function CampagnaDetail() {
  const { id } = useParams();
  const [campagna, setCampagna] = useState(null);

  const load = () => api.get(`/campagne/${id}`).then(({ data }) => setCampagna(data));
  useEffect(() => { load(); }, [id]);

  if (!campagna) return <UserShell><div className="text-slate-500">Caricamento...</div></UserShell>;

  const bozze = campagna.pratiche.filter((p) => p.stato === "BOZZA");
  const daPagare = bozze.some((p) => !p.pagata);

  const checkout = async () => {
    try {
      const { data } = await api.post(`/campagne/${campagna.id}/checkout`);
      toast.success(`Pagamento simulato · ${data.transazione_id}`);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const invia = async () => {
    try {
      const { data } = await api.post(`/campagne/${campagna.id}/invia`);
      toast.success(`${data.inviate} pratiche inviate`);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <UserShell>
      <div className="max-w-5xl mx-auto" data-testid="campagna-detail">
        <SavedCampaignBrief brief={campagna.brief} total={campagna.importo_totale} />
        <Link to="/campagne" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} /> Le mie campagne
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-4 justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Campagna</div>
            <h1 className="text-3xl font-heading font-extrabold tracking-tight">{campagna.nome}</h1>
            <div className="text-sm text-slate-600 font-mono mt-1">
              {campagna.data_inizio} → {campagna.data_fine} · {campagna.pratiche.length} spazi · {campagna.importo_totale.toFixed(2)} €
            </div>
          </div>
          <div className="flex gap-3">
            {bozze.length > 0 && daPagare && (
              <button data-testid="campagna-checkout-button" onClick={checkout}
                className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-5 py-2.5 font-bold hover:bg-[#172E93] transition-colors">
                <CreditCard size={16} /> Paga (mock)
              </button>
            )}
            {bozze.length > 0 && !daPagare && (
              <button data-testid="campagna-invia-button" onClick={invia}
                className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-5 py-2.5 font-bold hover:bg-[#172E93] transition-colors">
                <Send size={16} /> Invia pratiche
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-6 py-3 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#F8F9FD]">Pratiche della campagna</div>
          {campagna.pratiche.map((p) => (
            <Link key={p.id} to={`/pratiche/${p.id}`} data-testid={`campagna-pratica-${p.id}`}
              className="flex flex-wrap items-center gap-4 px-6 py-4 border-b border-slate-100 hover:bg-[#F0F4FF] transition-colors">
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold">{p.spazio_nome}</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{p.importo.toFixed(2)} € {p.pagata && "· pagata ✓"}</div>
              </div>
              <StatusBadge stato={p.stato} />
              <ArrowRight size={16} className="text-slate-400" />
            </Link>
          ))}
        </div>
      </div>
    </UserShell>
  );
}
