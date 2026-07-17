import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth, homeFor } from "../store/auth";

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

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api.post("/notifiche/leggi");
      setTimeout(load, 300);
    }
  };

  return (
    <div className="relative">
      <button data-testid="notification-bell" onClick={toggle}
        className="relative border border-slate-300 p-2 hover:border-slate-900 transition-colors bg-white">
        <Bell size={18} />
        {unread > 0 && (
          <span data-testid="notification-count"
            className="absolute -top-2 -right-2 bg-[#EF4444] text-white text-[10px] font-bold px-1.5 py-0.5">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div data-testid="notification-panel"
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto border border-slate-900 bg-white z-[1200]">
          <div className="px-4 py-2 border-b border-slate-900 text-xs font-bold uppercase tracking-widest bg-slate-50">
            Notifiche
          </div>
          {items.length === 0 && <div className="p-4 text-sm text-slate-500">Nessuna notifica</div>}
          {items.map((n) => (
            <button key={n.id}
              onClick={() => { setOpen(false); if (n.pratica_id) navigate(user.ruolo === "comune" ? `/comune/pratiche/${n.pratica_id}` : `/pratiche/${n.pratica_id}`); }}
              className={`block w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-blue-50 transition-colors ${!n.letta ? "bg-blue-50/60" : ""}`}>
              <div className="text-sm font-semibold">{n.titolo}</div>
              <div className="text-xs text-slate-600 mt-0.5">{n.messaggio}</div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">{new Date(n.created_at).toLocaleString("it-IT")}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
