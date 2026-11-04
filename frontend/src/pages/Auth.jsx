import { Brand, ThemeToggle } from "../components/BackofficeLayout";
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
  const input = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-5 top-5"><ThemeToggle /></div><div className="mb-5" data-testid="auth-logo"><Brand /></div>
      <p className="text-sm text-muted-foreground mb-7">Pubblicità e occupazione suolo pubblico, online.</p>
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl overflow-hidden border shadow-sm">
          <div className="grid grid-cols-2 border-b border-slate-100">
            <button data-testid="tab-login" onClick={() => setMode("login")}
              className={`py-3 text-sm font-semibold tracking-normal transition-colors ${mode === "login" ? "bg-card text-brand-foreground border-b-2 border-primary" : "bg-slate-100 text-slate-400 hover:text-slate-600"}`}>
              Accedi
            </button>
            <button data-testid="tab-register" onClick={() => setMode("register")}
              className={`py-3 text-sm font-semibold tracking-normal transition-colors ${mode === "register" ? "bg-card text-brand-foreground border-b-2 border-primary" : "bg-slate-100 text-slate-400 hover:text-slate-600"}`}>
              Registrati
            </button>
          </div>
          <form onSubmit={submit} className="p-6 sm:p-8 space-y-3.5">
            <div className="pb-3"><h1 className="text-2xl font-semibold">{mode === "login" ? "Bentornato" : "Crea il tuo account"}</h1><p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Accedi al tuo spazio di lavoro." : "Inizia a pianificare con Outdoor Planner."}</p></div>
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-semibold tracking-normal text-slate-500 mb-1.5">Tipo soggetto</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Privato", "Azienda", "Associazione"].map((t) => (
                      <button key={t} type="button" data-testid={`tipo-${t.toLowerCase()}`}
                        onClick={() => setForm({ ...form, tipo_soggetto: t })}
                        className={`py-2 text-xs font-semibold rounded-md border transition-colors ${form.tipo_soggetto === t ? "bg-primary text-primary-foreground border-primary" : "border-slate-200 hover:border-primary"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {(isAzienda || isAssociazione) && (
                  <input aria-label="Ragione sociale" data-testid="input-ragione-sociale" className={input} required
                    placeholder={isAzienda ? "Ragione sociale" : "Denominazione associazione"}
                    value={form.ragione_sociale} onChange={set("ragione_sociale")} />
                )}
                {isAzienda && (
                  <input aria-label="Partita iva" data-testid="input-partita-iva" className={input} required placeholder="Partita IVA"
                    value={form.partita_iva} onChange={set("partita_iva")} />
                )}
                <input aria-label="Nome" data-testid="input-nome" className={input} required
                  placeholder={form.tipo_soggetto === "Privato" ? "Nome e cognome" : "Nome e cognome referente"}
                  value={form.nome} onChange={set("nome")} />
                <input aria-label="Codice fiscale" data-testid="input-codice-fiscale" className={input} required placeholder="Codice fiscale"
                  value={form.codice_fiscale} onChange={set("codice_fiscale")} />
                {(isAzienda || isAssociazione) && (
                  <input aria-label="Pec" data-testid="input-pec" className={input} type="email" placeholder="PEC (opzionale)"
                    value={form.pec} onChange={set("pec")} />
                )}
                <input aria-label="Telefono" data-testid="input-telefono" className={input} placeholder="Telefono"
                  value={form.telefono} onChange={set("telefono")} />
              </>
            )}
            <label htmlFor="auth-email" className="block text-sm font-medium">Email</label>
            <input id="auth-email" autoComplete="email" data-testid="input-email" className={input} type="email" placeholder="Email"
              value={form.email} onChange={set("email")} required />
            <label htmlFor="auth-password" className="block text-sm font-medium">Password</label>
            <input id="auth-password" autoComplete={mode === "login" ? "current-password" : "new-password"} data-testid="input-password" className={input} type="password" placeholder="Password"
              value={form.password} onChange={set("password")} required />
            {error && <div data-testid="auth-error" className="border border-destructive/20 bg-destructive-muted rounded-xl text-destructive text-sm px-4 py-3">{error}</div>}
            <button data-testid="auth-submit-button" disabled={loading}
              className="w-full bg-primary text-primary-foreground rounded-md py-3.5 font-semibold hover:bg-primary transition-colors disabled:opacity-50">
              {loading ? "Attendi..." : mode === "login" ? "Accedi" : "Crea account"}
            </button>
          </form>
          <div className="border-t border-slate-100 px-8 py-4 bg-muted text-xs text-slate-500 leading-relaxed">
            <strong>Account demo</strong> (password <span className="tabular-nums">demo123</span>): user@demo.it (inserzionista). Per Superadmin e Comune utilizza le credenziali assegnate.
          </div>
        </div>
      </div>
    </div>
  );
}
