import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "../lib/api";
import { useAuth, homeFor } from "../store/auth";

const EMPTY = { email: "", password: "", nome: "", tipo_soggetto: "Privato", ragione_sociale: "", partita_iva: "", codice_fiscale: "", pec: "", telefono: "" };

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, setSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate(homeFor(user), { replace: true });
  }, [user, navigate]);

  const isAzienda = form.tipo_soggetto === "Azienda";
  const isAssociazione = form.tipo_soggetto === "Associazione";

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

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const input = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1F3BB3] transition-colors";

  return (
    <div className="min-h-screen bg-[#1F3BB3] flex flex-col items-center justify-center px-6 py-10">
      <img src="/logo-white.png" alt="Outdoor Planner" className="h-14 sm:h-16 mb-3" data-testid="auth-logo" />
      <p className="text-sm text-blue-100 mb-7">Pubblicità e occupazione suolo pubblico, online.</p>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <button data-testid="tab-login" onClick={() => setMode("login")}
              className={`py-3 text-sm font-bold uppercase tracking-widest transition-colors ${mode === "login" ? "bg-white text-[#1F3BB3] border-b-2 border-[#1F3BB3]" : "bg-slate-100 text-slate-400 hover:text-slate-600"}`}>
              Accedi
            </button>
            <button data-testid="tab-register" onClick={() => setMode("register")}
              className={`py-3 text-sm font-bold uppercase tracking-widest transition-colors ${mode === "register" ? "bg-white text-[#1F3BB3] border-b-2 border-[#1F3BB3]" : "bg-slate-100 text-slate-400 hover:text-slate-600"}`}>
              Registrati
            </button>
          </div>
          <form onSubmit={submit} className="p-8 space-y-3.5">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Tipo soggetto</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Privato", "Azienda", "Associazione"].map((t) => (
                      <button key={t} type="button" data-testid={`tipo-${t.toLowerCase()}`}
                        onClick={() => setForm({ ...form, tipo_soggetto: t })}
                        className={`py-2 text-xs font-bold rounded-full border transition-colors ${form.tipo_soggetto === t ? "bg-[#1F3BB3] text-white border-[#1F3BB3]" : "border-slate-200 hover:border-[#1F3BB3]"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {(isAzienda || isAssociazione) && (
                  <input data-testid="input-ragione-sociale" className={input} required
                    placeholder={isAzienda ? "Ragione sociale" : "Denominazione associazione"}
                    value={form.ragione_sociale} onChange={set("ragione_sociale")} />
                )}
                {isAzienda && (
                  <input data-testid="input-partita-iva" className={input} required placeholder="Partita IVA"
                    value={form.partita_iva} onChange={set("partita_iva")} />
                )}
                <input data-testid="input-nome" className={input} required
                  placeholder={form.tipo_soggetto === "Privato" ? "Nome e cognome" : "Nome e cognome referente"}
                  value={form.nome} onChange={set("nome")} />
                <input data-testid="input-codice-fiscale" className={input} required placeholder="Codice fiscale"
                  value={form.codice_fiscale} onChange={set("codice_fiscale")} />
                {(isAzienda || isAssociazione) && (
                  <input data-testid="input-pec" className={input} type="email" placeholder="PEC (opzionale)"
                    value={form.pec} onChange={set("pec")} />
                )}
                <input data-testid="input-telefono" className={input} placeholder="Telefono"
                  value={form.telefono} onChange={set("telefono")} />
              </>
            )}
            <input data-testid="input-email" className={input} type="email" placeholder="Email"
              value={form.email} onChange={set("email")} required />
            <input data-testid="input-password" className={input} type="password" placeholder="Password"
              value={form.password} onChange={set("password")} required />
            {error && <div data-testid="auth-error" className="border border-red-200 bg-red-50 rounded-xl text-[#B91C1C] text-sm px-4 py-3">{error}</div>}
            <button data-testid="auth-submit-button" disabled={loading}
              className="w-full bg-[#1F3BB3] text-white rounded-full py-3.5 font-bold hover:bg-[#172E93] transition-colors disabled:opacity-50">
              {loading ? "Attendi..." : mode === "login" ? "Accedi" : "Crea account"}
            </button>
          </form>
          <div className="border-t border-slate-100 px-8 py-4 bg-[#F8F9FD] text-xs text-slate-500 leading-relaxed">
            <strong>Account demo</strong> (password <span className="font-mono">demo123</span>): user@demo.it (inserzionista) · mattia.fabrizi92@gmail.com (superadmin). Le utenze comunali vengono create dal superadmin in fase di onboarding.
          </div>
        </div>
      </div>
    </div>
  );
}
