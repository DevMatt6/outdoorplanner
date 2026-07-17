import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "../lib/api";
import { useAuth, homeFor } from "../store/auth";
import { NavBar } from "../components/NavBar";
import { Fingerprint } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", nome: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = mode === "login"
        ? await api.post("/auth/login", { email: form.email, password: form.password })
        : await api.post("/auth/register", form);
      setSession(data.user, data.access_token);
      navigate(homeFor(data.user));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const spid = async () => {
    setError("");
    try {
      const { data } = await api.post("/auth/spid");
      setSession(data.user, data.access_token);
      navigate(homeFor(data.user));
    } catch (err) {
      setError(apiError(err));
    }
  };

  const input = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#2F5B41] transition-colors";

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="border border-slate-100 bg-white rounded-2xl overflow-hidden">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <button data-testid="tab-login" onClick={() => setMode("login")}
              className={`py-3 text-sm font-bold uppercase tracking-widest transition-colors ${mode === "login" ? "bg-[#2F5B41] text-white" : "hover:bg-slate-100"}`}>
              Accedi
            </button>
            <button data-testid="tab-register" onClick={() => setMode("register")}
              className={`py-3 text-sm font-bold uppercase tracking-widest transition-colors border-l border-slate-100 ${mode === "register" ? "bg-[#2F5B41] text-white" : "hover:bg-slate-100"}`}>
              Registrati
            </button>
          </div>
          <form onSubmit={submit} className="p-8 space-y-4">
            <h1 className="font-heading font-extrabold text-2xl tracking-tight">
              {mode === "login" ? "Bentornato" : "Crea il tuo account"}
            </h1>
            {mode === "register" && (
              <input data-testid="input-nome" className={input} placeholder="Nome e cognome / Ragione sociale"
                value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            )}
            <input data-testid="input-email" className={input} type="email" placeholder="Email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input data-testid="input-password" className={input} type="password" placeholder="Password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            {error && <div data-testid="auth-error" className="border border-red-200 bg-red-50 rounded-xl text-[#B91C1C] text-sm px-4 py-3">{error}</div>}
            <button data-testid="auth-submit-button" disabled={loading}
              className="w-full bg-[#2F5B41] text-white rounded-full py-3.5 font-bold hover:bg-[#26492F] transition-colors disabled:opacity-50">
              {loading ? "Attendi..." : mode === "login" ? "Accedi" : "Registrati"}
            </button>
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 border-t border-slate-100" />
              <span className="text-xs text-slate-500 uppercase tracking-widest">oppure</span>
              <div className="flex-1 border-t border-slate-100" />
            </div>
            <button data-testid="spid-login-button" type="button" onClick={spid}
              className="w-full border border-[#2F5B41] text-[#2F5B41] rounded-full py-3 font-bold flex items-center justify-center gap-2 hover:bg-[#2F5B41] hover:text-white transition-colors">
              <Fingerprint size={18} /> Entra con SPID / CIE (demo)
            </button>
          </form>
          <div className="border-t border-slate-100 px-8 py-4 bg-[#FAFAF8] text-xs text-slate-600 leading-relaxed">
            <strong>Account demo</strong> (password <span className="font-mono">demo123</span>): user@demo.it · comune@demo.it (L1) · comune.l2@demo.it · comune.l3@demo.it · mattia.fabrizi92@gmail.com
          </div>
        </div>
      </div>
    </div>
  );
}
