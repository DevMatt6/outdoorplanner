import { Link, useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "../store/auth";
import { NotificationBell } from "./NotificationBell";

export const NavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-[1100] bg-white border-b border-slate-900">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-3">
          <span className="bg-[#0A3D91] text-white font-heading font-extrabold px-2 py-1 text-lg leading-none">OP</span>
          <span className="font-heading font-extrabold text-lg tracking-tight">Outdoor Planner</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/spazi" data-testid="nav-spazi"
            className="px-4 py-2 text-sm font-semibold hover:bg-slate-100 transition-colors">
            Cerca spazi
          </Link>
          {user ? (
            <>
              <Link to={homeFor(user)} data-testid="nav-dashboard"
                className="px-4 py-2 text-sm font-semibold border border-slate-900 hover:bg-slate-900 hover:text-white transition-colors">
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
              className="px-5 py-2 text-sm font-bold bg-[#0033FF] text-white hover:bg-[#0A3D91] transition-colors">
              Accedi
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
