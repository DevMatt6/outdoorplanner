import { practiceLabel } from "../../lib/practicePresentation";
import { groupMunicipalityCampaigns, paymentLabel } from "../../lib/campaignTables";
import { LoadingState } from "../../components/LoadingState";
import { DataTable } from "../../components/DataTable";
import { CampaignStateBadges, campaignStateText } from "../../components/CampaignStateBadges";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BackofficeLayout, COMUNE_LINKS } from "../../components/BackofficeLayout";
import { StatusBadge, TipoBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { ArrowLeft, ArrowRight } from "lucide-react";

const CODE = [['','Tutte'],['INVIATA','Da assegnare'],['IN_VERIFICA','In verifica OOH'],['IN_ISTRUTTORIA','In istruttoria'],['INTEGRAZIONE_RICHIESTA','Attesa integrazione'],['APPROVATA','Approvate'],['RIFIUTATA','Rifiutate']];
const columns = [
  {label:'Campagna / Richiesta',key:'nome'}, {label:'Tipo',key:'tipo'},
  {label:'Pratiche',key:'numero',value:g=>g.pratiche.length},
  {label:'Dal',key:'data_inizio'}, {label:'Al',key:'data_fine'}, {label:'Richiedente',key:'user_nome'},
  {label:'Stato',key:'stati',value:g=>campaignStateText(g.per_stato)},
  {label:'Pagamento',key:'pagamento',value:g=>paymentLabel(g.pratiche)}, {label:'Azioni'},
];
const detailColumns = [{label:'Spazio / Zona',key:'spazio_nome',value:practiceLabel},{label:'Dal',key:'data_inizio'},{label:'Al',key:'data_fine'},{label:'Importo',key:'importo'},{label:'Stato',key:'stato'},{label:'Pagamento',key:'pagata',value:p=>p.pagata?'Pagata':'Non pagata'},{label:'Azioni'}];
export default function Scrivania() {
  const [pratiche,setPratiche]=useState([]), [stato,setStato]=useState(''), [loading,setLoading]=useState(true), [selected,setSelected]=useState(null), [error,setError]=useState('');
  useEffect(()=>{ api.get('/comune/pratiche').then(({data})=>setPratiche(data)).catch(()=>setError('Impossibile caricare le pratiche. Ricarica la pagina per riprovare.')).finally(()=>setLoading(false)); },[]);
  const groups=useMemo(()=>groupMunicipalityCampaigns(pratiche),[pratiche]);
  const active=groups.find(g=>g.id===selected);
  const filtered=groups.filter(g=>!stato||g.per_stato[stato]);
  return <BackofficeLayout title="Backoffice Comune" links={COMUNE_LINKS}>
    <h1 className="text-2xl sm:text-3xl font-heading font-semibold tracking-tight" data-testid="scrivania-title">Scrivania campagne e pratiche</h1>
    <p className="mt-2 text-sm text-muted-foreground">Una riga per campagna, con le sole pratiche del tuo Comune. Apri il dettaglio per gestirle.</p>
    {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
    {loading ? <LoadingState /> : active ? <section className="mt-6 overflow-hidden rounded-xl border bg-card" data-testid="campagna-comune-detail">
      <div className="border-b p-5"><button onClick={()=>setSelected(null)} className="mb-3 inline-flex items-center gap-2 text-sm text-brand-foreground"><ArrowLeft size={15}/>Tutte le campagne</button><h2 className="font-semibold text-lg">{active.nome}</h2><p className="mt-1 text-sm text-muted-foreground">{active.pratiche.length} pratiche per il tuo Comune · richiedente {active.user_nome}</p></div>
      <DataTable key={active.id} data={active.pratiche} columns={detailColumns} label="Cerca nelle pratiche della campagna…" renderRow={p=><tr key={p.id} className="border-b hover:bg-accent/50">
        <td className="px-4 py-3 font-medium">{practiceLabel(p)}</td><td className="px-4 py-3 whitespace-nowrap">{p.data_inizio}</td><td className="px-4 py-3 whitespace-nowrap">{p.data_fine}</td><td className="px-4 py-3 tabular-nums">{p.importo.toFixed(2)} €</td><td className="px-4 py-3"><StatusBadge stato={p.stato}/></td><td className="px-4 py-3">{p.pagata?'Pagata':'Non pagata'}</td><td className="px-4 py-3"><Link to={`/comune/pratiche/${p.id}`} data-testid={`istruttoria-link-${p.id}`} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">Apri pratica<ArrowRight size={14}/></Link></td>
      </tr>}/>
    </section> : <>
      <div className="mt-6 flex flex-wrap gap-2" data-testid="code-tabs">{CODE.map(([key,label])=><button key={key} data-testid={`coda-${key||'tutte'}`} onClick={()=>setStato(key)} className={`rounded-md border px-4 py-2 text-sm ${stato===key?'bg-primary text-primary-foreground':'bg-card hover:bg-accent'}`}>{label}</button>)}</div>
      <section className="mt-4 overflow-hidden rounded-xl border bg-card" data-testid="comune-campagne-table"><DataTable data={filtered} columns={columns} label="Cerca campagna, richiedente o stato…" renderRow={g=><tr key={g.id} data-testid={`gruppo-campagna-${g.id}`} className="border-b hover:bg-accent/50">
        <td className="px-4 py-3 font-medium">{g.nome}</td><td className="px-4 py-3"><TipoBadge tipo={g.tipo}/></td><td className="px-4 py-3 tabular-nums">{g.pratiche.length}</td><td className="px-4 py-3 whitespace-nowrap">{g.data_inizio}</td><td className="px-4 py-3 whitespace-nowrap">{g.data_fine}</td><td className="px-4 py-3">{g.user_nome}</td><td className="px-4 py-3"><CampaignStateBadges counts={g.per_stato}/></td><td className="px-4 py-3 whitespace-nowrap">{paymentLabel(g.pratiche)}</td><td className="px-4 py-3"><button data-testid={`dettaglio-campagna-${g.id}`} onClick={()=>setSelected(g.id)} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">Dettaglio<ArrowRight size={14}/></button></td>
      </tr>}/></section>
    </>}
  </BackofficeLayout>;
}
