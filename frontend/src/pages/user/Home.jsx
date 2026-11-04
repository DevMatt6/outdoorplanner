import { Link } from "react-router-dom";
import { UserShell } from "../../components/BackofficeLayout";
import { useAuth } from "../../store/auth";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Megaphone, Tent, ArrowRight, FolderOpen, LayoutDashboard, CalendarDays, MapPin, Check } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  return <UserShell><div className="mx-auto max-w-6xl" data-testid="home-hub">
    <div className="page-eyebrow">Il tuo spazio di lavoro</div>
    <h1 className="mt-2">Benvenuto, {user?.nome?.split(" ")[0]}</h1>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Dai spazio alle tue idee. Pianifica una campagna pubblicitaria o trova il luogo per il tuo prossimo evento.</p>
    <div className="mt-8 flex items-center justify-between border-b pb-3"><h2 className="font-semibold">Da dove vuoi iniziare?</h2><span className="hidden text-xs text-muted-foreground sm:block">Due servizi, un unico posto</span></div>
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      {[
        { to: "/campagne/ooh/nuova", id: "hub-card-ooh", icon: Megaphone, tag: "Pubblicità outdoor", title: "La tua prossima campagna,\nparte da qui.", text: "Raggiungi le persone nei luoghi che contano. Esplora i circuiti dei Comuni e scegli gli impianti per il tuo messaggio.", features: ["Circuiti e impianti sul territorio", "Prenotazione con blocco di 24 ore"], action: "Pianifica campagna" },
        { to: "/spazi", id: "hub-card-osp", icon: Tent, tag: "Spazi ed eventi", title: "Uno spazio per ogni\nnuova idea.", text: "Eventi, installazioni e progetti speciali. Trova uno spazio pubblico e segui la tua richiesta in un unico flusso.", features: ["Spazi per occupazioni temporanee", "Iter amministrativo online"], action: "Avvia richiesta OSP" },
      ].map(({ to, id, icon: Icon, tag, title, text, features, action }) => <Card key={id} className="group flex flex-col shadow-none transition-colors hover:border-primary/40"><CardContent className="flex flex-1 flex-col p-6 sm:p-8"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted/50"><Icon size={21} strokeWidth={1.5} /></span><span className="text-xs text-muted-foreground">{tag}</span></div><h2 className="mt-7 whitespace-pre-line !text-2xl font-semibold leading-snug tracking-tight">{title}</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p><ul className="mb-8 mt-5 space-y-2">{features.map((f) => <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground"><Check size={14} />{f}</li>)}</ul><Button asChild variant={id === "hub-card-ooh" ? "default" : "outline"} className="mt-auto w-fit"><Link to={to} data-testid={id}>{action}<ArrowRight /></Link></Button></CardContent></Card>)}
    </div>
    <div className="mt-8 flex items-center justify-between border-b pb-3"><h2 className="font-semibold">Tutto sotto controllo</h2></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {[["/campagne", "hub-link-campagne", LayoutDashboard, "Le mie campagne", "Riepiloghi, creatività e stato di avanzamento."], ["/dashboard", "hub-link-pratiche", FolderOpen, "Le mie pratiche", "Documenti, richieste e aggiornamenti dai Comuni."]].map(([to, id, Icon, title, description]) => <Link key={id} to={to} data-testid={id} className="flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-accent"><Icon size={20} className="shrink-0 text-muted-foreground" strokeWidth={1.5} /><div className="flex-1"><div className="text-sm font-medium">{title}</div><div className="mt-1 text-xs text-muted-foreground">{description}</div></div><ArrowRight size={16} className="text-muted-foreground" /></Link>)}
    </div>
    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><MapPin size={14} />Un unico accesso ai territori</span><span className="flex items-center gap-2"><CalendarDays size={14} />Pianificazione e richieste online</span></div>
  </div></UserShell>;
}
