import { LoadingState } from "../../components/LoadingState";
import { DataTable } from "../../components/DataTable";
import { PraticheTable } from "../../components/PraticheTable";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { STATO_COLORS, StatusBadge, TipoBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { Plus, ArrowRight, Megaphone } from "lucide-react";

const resourceCount = (c) => (c.pacchetti_ids || c.spazi_ids || []).length;
const columns = [
  { label: "Campagna", key: "nome" },
  { label: "Tipo", key: "tipo", value: (c) => c.tipo === "OOH" ? "Campagna OOH" : "OSP / Evento" },
  { label: "Dal", key: "data_inizio" },
  { label: "Al", key: "data_fine" },
  { label: "Circuiti / Spazi", key: "risorse", value: resourceCount },
  { label: "Pratiche", key: "numero_pratiche", value: (c) => c.pratiche?.length || Object.values(c.per_stato || {}).reduce((sum, n) => sum + n, 0) },
  { label: "Importo", key: "importo_totale" },
  { label: "Stato pratiche", key: "stati", value: (c) => Object.keys(c.per_stato || {}).map((s) => STATO_COLORS[s]?.label || s).join(" ") },
  { label: "Azioni" },
];
const campaignUrl = (c) => c.tipo === "OOH" ? `/campagne/ooh/${c.id}` : `/campagne/${c.id}`;

export default function Campagne() {
  const [campagne, setCampagne] = useState(null);
  const [singole, setSingole] = useState([]);

  useEffect(() => {
    api.get("/campagne").then(({ data }) => setCampagne(data));
    api.get("/pratiche").then(({ data }) => setSingole(data.filter((p) => !p.campagna_id)));
  }, []);

  return <UserShell><div className="mx-auto max-w-7xl" data-testid="campagne-page">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="text-xs font-medium text-muted-foreground">Area inserzionista</div><h1 className="mt-1 text-3xl font-semibold tracking-tight">Le mie campagne</h1><p className="mt-2 text-sm text-muted-foreground">Periodi, spazi e stato delle pratiche in un’unica vista.</p></div>
      <Link to="/campagne/ooh/nuova" data-testid="nuova-campagna-button" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90"><Plus size={17} />Pianifica campagna OOH</Link>
    </div>
    <div className="mt-6 overflow-hidden rounded-xl border bg-card" data-testid="campagne-table">
      <div className="border-b bg-muted/50 px-5 py-3 text-sm font-medium">Campagne OOH e OSP</div>
      {campagne === null ? <LoadingState /> : campagne.length === 0 ? <div className="p-12 text-center"><Megaphone size={28} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Non hai ancora campagne. Pianifica la tua prima campagna.</p><Link to="/campagne/ooh/nuova" className="mt-5 inline-flex rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent">Inizia ora</Link></div> : <DataTable data={campagne} columns={columns} label="Cerca per campagna, tipo o stato…" renderRow={(c) => <tr key={c.id} data-testid={`campagna-row-${c.id}`} className="border-b transition-colors hover:bg-accent/50">
        <td className="px-4 py-3"><Link to={campaignUrl(c)} data-testid={`campagna-card-${c.id}`} className="font-medium hover:text-brand-foreground hover:underline">{c.nome}</Link></td>
        <td className="px-4 py-3"><TipoBadge tipo={c.tipo} /></td>
        <td className="whitespace-nowrap px-4 py-3 tabular-nums">{c.data_inizio}</td><td className="whitespace-nowrap px-4 py-3 tabular-nums">{c.data_fine}</td>
        <td className="whitespace-nowrap px-4 py-3 tabular-nums">{resourceCount(c)} {c.tipo === "OOH" ? "circuiti" : "spazi"}</td>
        <td className="px-4 py-3 tabular-nums">{c.pratiche?.length || Object.values(c.per_stato || {}).reduce((sum, n) => sum + n, 0)}</td>
        <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{Number(c.importo_totale || 0).toFixed(2)} €</td>
        <td className="px-4 py-3"><div className="flex min-w-[150px] flex-wrap gap-2">{Object.entries(c.per_stato || {}).map(([stato, n]) => <span key={stato} className="inline-flex items-center gap-1"><span className="text-xs tabular-nums text-muted-foreground">{n} ×</span><StatusBadge stato={stato} /></span>)}{Object.keys(c.per_stato || {}).length === 0 && <span className="text-xs text-muted-foreground">Nessuna pratica</span>}</div></td>
        <td className="px-4 py-3"><Link to={campaignUrl(c)} aria-label={`Apri campagna ${c.nome}`} title="Apri campagna" className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"><ArrowRight size={14} /></Link></td>
      </tr>} />}
    </div>
    {singole.length > 0 && <section className="mt-8 overflow-hidden rounded-xl border bg-card" data-testid="pratiche-singole"><h2 className="border-b bg-muted/50 px-5 py-3 !text-sm font-medium">Richieste singole OSP</h2><PraticheTable pratiche={singole} rowTestPrefix="pratica-singola" /></section>}
  </div></UserShell>;
}
