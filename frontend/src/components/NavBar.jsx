import { Link, useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "../store/auth";
import { NotificationBell } from "./NotificationBell";

export const NavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[1100] px-4 pt-4">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-100 px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-3">
          <span className="bg-[#1F3BB3] text-white font-heading font-extrabold w-9 h-9 rounded-full flex items-center justify-center text-sm">OP</span>
          <span className="font-heading font-extrabold text-lg tracking-tight">Outdoor Planner</span>
        </Link>
        <nav className="flex items-center gap-2">
          {(!user || user.ruolo === "user") && (
            <>
              <Link to="/campagne/ooh/nuova" data-testid="nav-ooh"
                className="px-4 py-2 text-sm font-semibold rounded-full hover:bg-[#F0F4FF] transition-colors">
                Campagne OOH
              </Link>
              <Link to="/spazi" data-testid="nav-spazi"
                className="px-4 py-2 text-sm font-semibold rounded-full hover:bg-[#F0F4FF] transition-colors">
                OSP / Eventi
              </Link>
            </>
          )}
          {user ? (
            <>
              <Link to={user.ruolo === "user" ? "/dashboard" : homeFor(user)} data-testid="nav-dashboard"
                className="px-4 py-2 text-sm font-semibold rounded-full border border-slate-200 hover:border-[#1F3BB3] hover:text-[#1F3BB3] transition-colors">
                {user.ruolo === "superadmin" ? "Superadmin" : user.ruolo === "comune" ? "Backoffice" : "Le mie pratiche"}
              </Link>
              <NotificationBell />
              <button data-testid="nav-logout" onClick={() => { logout(); navigate("/"); }}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                Esci
              </button>
            </>
          ) : (
            <Link to="/login" data-testid="nav-login"
              className="px-5 py-2.5 text-sm font-bold rounded-full bg-[#1F3BB3] text-white hover:bg-[#172E93] transition-colors">
              Accedi
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
