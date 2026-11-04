import { Brand, ThemeToggle } from "./BackofficeLayout";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "../store/auth";
import { NotificationBell } from "./NotificationBell";

export const NavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[1100] border-b bg-card px-4">
      <div className="max-w-7xl mx-auto min-h-16 py-3 flex flex-wrap gap-3 items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-3">
          <Brand />
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-xs sm:gap-2" aria-label="Menu principale">
          <ThemeToggle />
          {(!user || user.ruolo === "user") && (
            <>
              <Link to="/campagne/ooh/nuova" data-testid="nav-ooh"
                className="px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-md hover:bg-accent transition-colors">
                Campagne OOH
              </Link>
              <Link to="/spazi" data-testid="nav-spazi"
                className="px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-md hover:bg-accent transition-colors">
                OSP / Eventi
              </Link>
            </>
          )}
          {user ? (
            <>
              <Link to={user.ruolo === "user" ? "/dashboard" : homeFor(user)} data-testid="nav-dashboard"
                className="px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-md border border-slate-200 hover:border-primary hover:text-brand-foreground transition-colors">
                {user.ruolo === "superadmin" ? "Superadmin" : user.ruolo === "comune" ? "Backoffice" : "Le mie pratiche"}
              </Link>
              <NotificationBell />
              <button data-testid="nav-logout" onClick={() => { logout(); navigate("/"); }}
                className="px-2.5 py-2 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                Esci
              </button>
            </>
          ) : (
            <Link to="/login" data-testid="nav-login"
              className="px-5 py-2.5 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary transition-colors">
              Accedi
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
