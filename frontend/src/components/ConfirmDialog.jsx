import { createContext, useContext, useRef, useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "./ui/alert-dialog";
const ConfirmContext = createContext(null);
export const useConfirm = () => useContext(ConfirmContext);
export function ConfirmProvider({ children }) {
  const [message, setMessage] = useState(null);
  const pending = useRef(null);
  const confirm = (text) => new Promise((resolve) => { pending.current?.(false); pending.current = resolve; setMessage(text); });
  const finish = (value) => { pending.current?.(value); pending.current = null; setMessage(null); };
  return <ConfirmContext.Provider value={confirm}>{children}<AlertDialog open={message !== null} onOpenChange={(open) => { if (!open) finish(false); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Conferma operazione</AlertDialogTitle><AlertDialogDescription className="whitespace-pre-line">{message}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => finish(false)}>Annulla</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => finish(true)}>Conferma</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></ConfirmContext.Provider>;
}
