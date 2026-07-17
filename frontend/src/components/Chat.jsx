import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { Send } from "lucide-react";

export const Chat = ({ praticaId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  const load = async () => {
    const { data } = await api.get(`/pratiche/${praticaId}/chat`);
    setMessages(data);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [praticaId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await api.post(`/pratiche/${praticaId}/chat`, { testo: text.trim() });
    setText("");
    load();
  };

  return (
    <div className="border border-slate-300 bg-white flex flex-col" data-testid="chat-box">
      <div className="px-4 py-2 border-b border-slate-300 text-xs font-bold uppercase tracking-widest bg-slate-50">
        Chat pratica
      </div>
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {messages.length === 0 && <div className="text-sm text-slate-500">Nessun messaggio. Scrivi al {user?.ruolo === "user" ? "Comune" : "richiedente"}.</div>}
        {messages.map((m) => {
          const mine = m.autore_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 border ${mine ? "bg-[#0A3D91] text-white border-[#0A3D91]" : "bg-slate-50 border-slate-300"}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${mine ? "text-blue-200" : "text-slate-500"}`}>
                  {m.autore_nome} · {m.autore_ruolo === "comune" ? "Comune" : "Richiedente"}
                </div>
                <div className="text-sm mt-0.5">{m.testo}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex border-t border-slate-300">
        <input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi un messaggio..."
          className="flex-1 px-4 py-3 text-sm outline-none focus:bg-blue-50 transition-colors" />
        <button data-testid="chat-send-button" type="submit"
          className="px-5 bg-[#0033FF] text-white hover:bg-[#0A3D91] transition-colors">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
