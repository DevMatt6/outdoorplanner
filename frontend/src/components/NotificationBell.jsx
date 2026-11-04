import { useEffect, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

export const NotificationBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get("/notifiche");
      setItems(data);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user]);

  if (!user) return null;
  const unread = items.filter((n) => !n.letta).length;

  const toggle = async (next) => {
    setOpen(next);
    if (next && unread > 0) {
      await api.post("/notifiche/leggi");
      setTimeout(load, 300);
    }
  };

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
      <button data-testid="notification-bell" aria-label={unread ? `Notifiche: ${unread} non lette` : "Notifiche"}
        className="relative rounded-full border border-slate-200 p-2.5 hover:border-primary hover:text-brand-foreground transition-colors bg-card">
        <Bell size={17} />
        {unread > 0 && (
          <span data-testid="notification-count"
            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
            {unread}
          </span>
        )}
      </button>
      </PopoverTrigger>
        <PopoverContent align="end" data-testid="notification-panel"
          className="w-[min(320px,calc(100vw-2rem))] max-h-96 overflow-y-auto rounded-xl p-0">
          <div className="px-4 py-2 border-b border-slate-100 text-xs font-semibold tracking-normal bg-muted">
            Notifiche
          </div>
          {items.length === 0 && <div className="p-4 text-sm text-slate-500">Nessuna notifica</div>}
          {items.map((n) => (
            <button key={n.id}
              onClick={() => { setOpen(false); if (n.pratica_id) navigate(user.ruolo === "comune" ? `/comune/pratiche/${n.pratica_id}` : `/pratiche/${n.pratica_id}`); }}
              className={`block w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-accent transition-colors ${!n.letta ? "bg-muted" : ""}`}>
              <div className="text-sm font-semibold">{n.titolo}</div>
              <div className="text-xs text-slate-600 mt-0.5">{n.messaggio}</div>
              <div className="text-[10px] text-slate-400 mt-1 tabular-nums">{new Date(n.created_at).toLocaleString("it-IT")}</div>
            </button>
          ))}
        </PopoverContent>
    </Popover>
  );
};
