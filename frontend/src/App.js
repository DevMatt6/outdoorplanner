import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth, homeFor } from "./store/auth";
import Auth from "./pages/Auth";
import Spazi from "./pages/Spazi";
import SpazioDetail from "./pages/SpazioDetail";
import UserDashboard from "./pages/user/UserDashboard";
import Home from "./pages/user/Home";
import OOHPlanner from "./pages/user/OOHPlanner";
import CampagnaOOHDetail from "./pages/user/CampagnaOOHDetail";
import PraticaWizard from "./pages/user/PraticaWizard";
import PraticaDetail from "./pages/user/PraticaDetail";
import Campagne from "./pages/user/Campagne";
import CampagnaPlanner from "./pages/user/CampagnaPlanner";
import CampagnaDetail from "./pages/user/CampagnaDetail";
import Scrivania from "./pages/comune/Scrivania";
import PraticaIstruttoria from "./pages/comune/PraticaIstruttoria";
import ComuneSpazi from "./pages/comune/ComuneSpazi";
import FormBuilder from "./pages/comune/FormBuilder";
import Report from "./pages/comune/Report";
import ComuneMonitor from "./pages/comune/ComuneMonitor";
import ComuneZone from "./pages/comune/ComuneZone";
import ComuneImpianti from "./pages/comune/ComuneImpianti";
import ComunePacchetti from "./pages/comune/ComunePacchetti";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminComuni from "./pages/admin/AdminComuni";
import AdminMonitor from "./pages/admin/AdminMonitor";

const Protected = ({ role, children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.ruolo !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
};

function App() {
  const refresh = useAuth((s) => s.refresh);
  useEffect(() => {
    if (localStorage.getItem("op_token")) refresh();
  }, [refresh]);
  return (
    <div className="App">
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { borderRadius: 14, border: "1px solid #E5E7E4" } }} />
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/spazi" element={<Spazi />} />
          <Route path="/spazi/:id" element={<SpazioDetail />} />
          <Route path="/home" element={<Protected role="user"><Home /></Protected>} />
          <Route path="/dashboard" element={<Protected role="user"><UserDashboard /></Protected>} />
          <Route path="/campagne/ooh/nuova" element={<Protected role="user"><OOHPlanner /></Protected>} />
          <Route path="/campagne/ooh/:id" element={<Protected role="user"><CampagnaOOHDetail /></Protected>} />
          <Route path="/pratiche/nuova/:spazioId" element={<Protected role="user"><PraticaWizard /></Protected>} />
          <Route path="/pratiche/:id" element={<Protected role="user"><PraticaDetail /></Protected>} />
          <Route path="/campagne" element={<Protected role="user"><Campagne /></Protected>} />
          <Route path="/campagne/nuova" element={<Protected role="user"><CampagnaPlanner /></Protected>} />
          <Route path="/campagne/:id" element={<Protected role="user"><CampagnaDetail /></Protected>} />
          <Route path="/comune" element={<Protected role="comune"><Scrivania /></Protected>} />
          <Route path="/comune/pratiche/:id" element={<Protected role="comune"><PraticaIstruttoria /></Protected>} />
          <Route path="/comune/spazi" element={<Protected role="comune"><ComuneSpazi /></Protected>} />
          <Route path="/comune/form" element={<Protected role="comune"><FormBuilder /></Protected>} />
          <Route path="/comune/report" element={<Protected role="comune"><Report /></Protected>} />
          <Route path="/comune/monitor" element={<Protected role="comune"><ComuneMonitor /></Protected>} />
          <Route path="/comune/zone" element={<Protected role="comune"><ComuneZone /></Protected>} />
          <Route path="/comune/impianti" element={<Protected role="comune"><ComuneImpianti /></Protected>} />
          <Route path="/comune/pacchetti" element={<Protected role="comune"><ComunePacchetti /></Protected>} />
          <Route path="/admin" element={<Protected role="superadmin"><AdminDashboard /></Protected>} />
          <Route path="/admin/comuni" element={<Protected role="superadmin"><AdminComuni /></Protected>} />
          <Route path="/admin/monitor" element={<Protected role="superadmin"><AdminMonitor /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
