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
        className="relative rounded-full border border-slate-200 p-2.5 hover:border-[#2F5B41] hover:text-[#2F5B41] transition-colors bg-white">
        <Bell size={17} />
        {unread > 0 && (
          <span data-testid="notification-count"
            className="absolute -top-1.5 -right-1.5 bg-[#EF4444] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div data-testid="notification-panel"
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto border border-slate-100 bg-white rounded-2xl overflow-hidden z-[1200]">
          <div className="px-4 py-2 border-b border-slate-100 text-xs font-bold uppercase tracking-widest bg-[#FAFAF8]">
            Notifiche
          </div>
          {items.length === 0 && <div className="p-4 text-sm text-slate-500">Nessuna notifica</div>}
          {items.map((n) => (
            <button key={n.id}
              onClick={() => { setOpen(false); if (n.pratica_id) navigate(user.ruolo === "comune" ? `/comune/pratiche/${n.pratica_id}` : `/pratiche/${n.pratica_id}`); }}
              className={`block w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-[#F1F5F0] transition-colors ${!n.letta ? "bg-[#EFF5EF]" : ""}`}>
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
