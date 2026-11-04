import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../components/ui/dialog";
import { StatCard } from "../../components/DashboardUI";
import { DataTable } from "../../components/DataTable";
import { LoadingState } from "../../components/LoadingState";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BackofficeLayout, ADMIN_LINKS } from "../../components/BackofficeLayout";
import { STATO_COLORS, StatusBadge } from "../../components/StatusBadge";
import { api, imgSrc, apiError } from "../../lib/api";
import { Landmark, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [kpi, setKpi] = useState(null);
  const [comuni, setComuni] = useState([]);
  const [dettaglio, setDettaglio] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [confermaReset, setConfermaReset] = useState("");
  const [resetting, setResetting] = useState(false);

  const eseguiReset = async () => {
    setResetting(true);
    try {
      await api.post("/admin/reset-piattaforma", { conferma: confermaReset });
      toast.success("Piattaforma azzerata: puoi ricominciare da capo");
      setShowReset(false);
      setConfermaReset("");
      setDettaglio(null);
      const [{ data: k }, { data: c }] = await Promise.all([api.get("/admin/kpi"), api.get("/admin/comuni")]);
      setKpi(k);
      setComuni(c);
    } catch (e) { toast.error(apiError(e)); }
    finally { setResetting(false); }
  };

  useEffect(() => {
    api.get("/admin/kpi").then(({ data }) => setKpi(data));
    api.get("/admin/comuni").then(({ data }) => setComuni(data));
  }, []);

  const openDettaglio = async (id) => {
    const { data } = await api.get(`/admin/comuni/${id}/report`);
    setDettaglio(data);
  };

  if (!kpi) return <BackofficeLayout title="Superadmin" links={ADMIN_LINKS}><LoadingState /></BackofficeLayout>;

  const statoData = Object.entries(kpi.per_stato).map(([stato, count]) => ({ stato: STATO_COLORS[stato]?.label || stato, count }));

  return (
    <BackofficeLayout title="Superadmin" links={ADMIN_LINKS}>
      <h1 className="text-2xl sm:text-3xl font-heading font-semibold tracking-tight" data-testid="admin-kpi-title">Dashboard KPI di piattaforma</h1>
      <p className="mt-2 text-sm text-muted-foreground">Attività, territori e risultati della piattaforma in un’unica vista.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[[kpi.comuni, "Comuni attivi"], [kpi.utenti, "Inserzionisti"], [kpi.spazi, "Spazi a catalogo"], [kpi.pratiche_totali, "Pratiche"], [`${kpi.revenue_totale.toFixed(0)} €`, "Revenue aggregata"]].map(([value, label]) => <StatCard key={label} label={label} value={value} />)}
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-7 border border-slate-100 rounded-xl overflow-hidden divide-x divide-y md:divide-y-0 divide-slate-100 bg-card" data-testid="kpi-ooh">
        {[
          [kpi.zone, "Zone"],
          [kpi.pacchetti, "Circuiti"],
          [kpi.impianti, "Impianti"],
          [kpi.held, "HELD attivi"],
          [kpi.confirmed, "Confermati"],
          [`${kpi.conversione_hold}%`, "Conv. HELD→CONF"],
          [`${kpi.campagne_ooh} (${kpi.campagne_multicomune} multi)`, "Campagne OOH"],
        ].map(([v, l]) => (
          <div key={l} className="p-4">
            <div className="font-heading font-semibold text-xl">{v}</div>
            <div className="text-[10px] tracking-normal text-slate-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div className="border border-slate-100 bg-card rounded-xl overflow-hidden p-6">
          <div className="text-xs font-semibold tracking-normal text-slate-500 mb-4">Pratiche per stato (sistema)</div>
          {statoData.every((d) => !d.count) ? (
            <div data-testid="empty-stato-chart" className="h-[280px] flex items-center justify-center text-sm text-slate-400">Nessun dato disponibile</div>
          ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statoData}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="stato" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
              <Bar dataKey="count" name="Pratiche" fill="hsl(var(--chart-1))" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="border border-slate-100 bg-card rounded-xl overflow-hidden p-6">
          <div className="text-xs font-semibold tracking-normal text-slate-500 mb-4">Volumi per comune</div>
          {(!kpi.pratiche_per_comune || kpi.pratiche_per_comune.length === 0) ? (
            <div data-testid="empty-volumi-chart" className="h-[280px] flex items-center justify-center text-sm text-slate-400">Nessun dato disponibile</div>
          ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={kpi.pratiche_per_comune} layout="vertical">
              <CartesianGrid stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="comune" tick={{ fontSize: 12 }} width={80} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
              <Bar dataKey="count" name="Pratiche" fill="hsl(var(--chart-2))" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mt-6 border border-slate-100 bg-card rounded-xl overflow-hidden overflow-x-auto" data-testid="kpi-per-comune">
        <div className="px-5 py-3 border-b border-slate-100 text-xs font-semibold tracking-normal bg-muted">KPI per comune — clicca per il dettaglio</div>
        <DataTable data={comuni} label="Cerca un Comune…" columns={[{ label: "Comune", key: "nome" }, { label: "Zone", key: "zone_count" }, { label: "Impianti", key: "impianti_count" }, { label: "Circuiti", key: "pacchetti_count" }, { label: "Campagne", key: "campagne_count" }, { label: "Pratiche", key: "pratiche_count" }, { label: "Valore", key: "incasso_totale" }, { label: "Fee", key: "incasso_piattaforma" }]} renderRow={(c) => (
<tr key={c.id} data-testid={`kpi-comune-row-${c.id}`} onClick={() => openDettaglio(c.id)}
                className="border-b border-slate-100 hover:bg-accent transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {c.logo_url ? (
                      <img src={imgSrc(c.logo_url)} alt="" className="w-8 h-8 rounded-lg object-contain border border-slate-100 bg-card" />
                    ) : (
                      <span className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-brand-foreground"><Landmark size={14} /></span>
                    )}
                    <button className="text-left font-semibold hover:underline" aria-label={`Apri dettaglio di ${c.nome}`} onClick={(e) => { e.stopPropagation(); openDettaglio(c.id); }}>{c.nome}</button>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums" data-testid={`kpi-zone-${c.id}`}>{c.zone_count}</td>
                <td className="px-4 py-3 tabular-nums" data-testid={`kpi-impianti-${c.id}`}>{c.impianti_count}</td>
                <td className="px-4 py-3 tabular-nums" data-testid={`kpi-circuiti-${c.id}`}>{c.pacchetti_count}</td>
                <td className="px-4 py-3 tabular-nums">{c.campagne_count}</td>
                <td className="px-4 py-3 tabular-nums">{c.pratiche_count}</td>
                <td className="px-4 py-3 font-heading font-semibold">{c.incasso_totale.toFixed(2)} €</td>
                <td className="px-4 py-3 tabular-nums text-slate-500">{c.incasso_piattaforma.toFixed(2)} €</td>
              </tr>
)} />
      </div>

      {dettaglio && (
        <div className="mt-6 border border-slate-100 bg-card rounded-xl overflow-hidden" data-testid="dettaglio-comune">
          <div className="px-5 py-3 border-b border-slate-100 bg-muted flex items-center justify-between">
            <div className="flex items-center gap-3">
              {dettaglio.comune.logo_url && <img src={imgSrc(dettaglio.comune.logo_url)} alt="" className="w-8 h-8 rounded-lg object-contain border border-slate-100 bg-card" />}
              <span className="font-heading font-semibold">Comune di {dettaglio.comune.nome}</span>
            </div>
            <button data-testid="chiudi-dettaglio" onClick={() => setDettaglio(null)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            {[
              [dettaglio.pratiche_totali, "Pratiche"],
              [dettaglio.per_stato.APPROVATA || 0, "Approvate"],
              [`${dettaglio.incasso_totale.toFixed(2)} €`, "Incasso"],
              [`${dettaglio.incasso_piattaforma.toFixed(2)} €`, "Fee piattaforma"],
            ].map(([v, l]) => (
              <div key={l} className="p-4">
                <div className="font-heading font-semibold text-xl">{v}</div>
                <div className="text-[10px] tracking-normal text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6 p-5">
            <div>
              <div className="text-xs font-semibold tracking-normal text-slate-500 mb-3">Incassi per mese (€)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dettaglio.incassi_mese}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mese" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
                  <Bar dataKey="importo" name="Incassi" fill="hsl(var(--chart-1))" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-normal text-slate-500 mb-3">Ultime pratiche</div>
              <div className="space-y-1.5">
                {dettaglio.ultime_pratiche.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-xs bg-muted border border-slate-100 rounded-xl px-3 py-2">
                    <span className="tabular-nums text-slate-500">{p.data}</span>
                    <span className="font-semibold flex-1 min-w-[120px]">{p.spazio_nome}</span>
                    <span className="text-slate-500">{p.user_nome}</span>
                    <StatusBadge stato={p.stato} />
                    <span className="font-semibold">{p.importo.toFixed(2)} €</span>
                  </div>
                ))}
                {dettaglio.ultime_pratiche.length === 0 && <div className="text-xs text-slate-500">Nessuna pratica.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 border border-destructive/20 bg-destructive-muted/60 rounded-xl p-5" data-testid="danger-zone">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-heading font-semibold text-destructive"><AlertTriangle size={17} /> Zona pericolosa</div>
            <p className="text-sm text-slate-600 mt-1">Elimina TUTTI i dati (comuni, utenze, inserzionisti, pratiche, campagne, impianti, file). Resta solo il tuo account superadmin.</p>
          </div>
          <button data-testid="btn-reset-piattaforma" onClick={() => setShowReset(true)}
            className="px-5 py-2.5 rounded-md font-semibold text-sm bg-destructive text-destructive-foreground hover:bg-destructive transition-colors">
            Reset piattaforma
          </button>
        </div>
        {showReset && (
          <Dialog open onOpenChange={(open) => { if (!resetting && !open) { setShowReset(false); setConfermaReset(""); } }}><DialogContent data-testid="reset-dialog"><DialogTitle>Reset della piattaforma</DialogTitle><DialogDescription>Tutti i dati verranno eliminati definitivamente. Il tuo account superadmin sarà conservato.</DialogDescription>
            <p className="text-sm font-semibold text-slate-800">Operazione irreversibile. Digita <span className="tabular-nums font-semibold text-destructive">RESET</span> per confermare:</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <input data-testid="input-conferma-reset" value={confermaReset} onChange={(e) => setConfermaReset(e.target.value)}
                aria-label="Digita RESET per confermare" placeholder="RESET" className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm tabular-nums outline-none focus:border-destructive transition-colors" />
              <button data-testid="btn-conferma-reset" onClick={eseguiReset} disabled={confermaReset !== "RESET" || resetting}
                className="px-5 py-2.5 rounded-md font-semibold text-sm bg-destructive text-destructive-foreground hover:bg-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {resetting ? "Cancellazione..." : "Cancella tutto definitivamente"}
              </button>
              <button data-testid="btn-annulla-reset" onClick={() => { setShowReset(false); setConfermaReset(""); }}
                className="px-5 py-2.5 rounded-md font-semibold text-sm border border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900 transition-colors">
                Annulla
              </button>
            </div>
          </DialogContent></Dialog>
        )}
      </div>
    </BackofficeLayout>
  );
}
