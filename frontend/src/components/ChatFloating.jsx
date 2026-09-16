import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Chat } from "./Chat";

export const ChatFloating = ({ praticaId }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="fixed bottom-24 left-6 z-[1300] w-[380px] max-w-[calc(100vw-3rem)] rounded-2xl shadow-2xl shadow-black/25 bg-white" data-testid="chat-popup">
          <Chat praticaId={praticaId} />
        </div>
      )}
      <button data-testid="chat-fab" onClick={() => setOpen((v) => !v)} title="Chat pratica"
        className="fixed bottom-6 left-6 z-[1300] w-14 h-14 rounded-full bg-[#1F3BB3] text-white flex items-center justify-center shadow-xl shadow-[#1F3BB3]/40 hover:bg-[#172E93] transition-colors">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
};
