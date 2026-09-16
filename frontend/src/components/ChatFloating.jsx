import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Chat } from "./Chat";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

export const ChatFloating = ({ praticaId }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const key = `chat_read_${praticaId}`;

  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await api.get(`/pratiche/${praticaId}/chat`);
        if (data.length === 0) return setUnread(0);
        if (open) {
          localStorage.setItem(key, data[data.length - 1].created_at);
          setUnread(0);
          return;
        }
        const last = localStorage.getItem(key) || "";
        setUnread(data.filter((m) => m.autore_id !== user?.id && m.created_at > last).length);
      } catch { /* silente */ }
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [praticaId, open, user?.id]);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-[1300] w-[380px] max-w-[calc(100vw-3rem)] rounded-2xl shadow-2xl shadow-black/25 bg-white" data-testid="chat-popup">
          <Chat praticaId={praticaId} />
        </div>
      )}
      <button data-testid="chat-fab" onClick={() => setOpen((v) => !v)} title="Chat pratica"
        className="fixed bottom-6 right-6 z-[1300] w-14 h-14 rounded-full bg-[#1F3BB3] text-white flex items-center justify-center shadow-xl shadow-[#1F3BB3]/40 hover:bg-[#172E93] transition-colors">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span data-testid="chat-unread-badge"
            className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-[#EF4444] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </>
  );
};
