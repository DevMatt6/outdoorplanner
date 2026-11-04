import { PhotoCredit } from "../components/PhotoCredit";
import { LoadingState } from "../components/LoadingState";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { NavBar } from "../components/NavBar";
import { UserShell } from "../components/BackofficeLayout";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { MapPin, ArrowLeft, Ruler, Landmark } from "lucide-react";

const PublicShell = ({ children }) => (<div className="min-h-screen"><NavBar />{children}</div>);

export default function SpazioDetail() {
  const { id } = useParams();
  const [spazio, setSpazio] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const Shell = user?.ruolo === "user" ? UserShell : PublicShell;

  useEffect(() => {
    api.get(`/spazi/${id}`).then(({ data }) => setSpazio(data));
  }, [id]);

  if (!spazio) return <PublicShell><LoadingState /></PublicShell>;

  const avvia = () => {
    if (!user) return navigate("/login");
    navigate(`/pratiche/nuova/${spazio.id}`);
  };

  return (
    <Shell>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link to="/spazi" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} /> Torna alla ricerca
        </Link>
        <div className="mt-4 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-slate-100 bg-card rounded-xl overflow-hidden">
              <img src={spazio.foto_url} alt={spazio.nome} className="w-full h-72 object-cover border-b border-slate-100" />
              <PhotoCredit spazio={spazio} />
              <div className="p-8">
                <div className="text-xs font-semibold tracking-normal text-brand-foreground">{spazio.tipologia}</div>
                <h1 className="text-3xl sm:text-3xl font-heading font-semibold tracking-tight mt-1" data-testid="spazio-nome">{spazio.nome}</h1>
                <div className="text-slate-600 mt-2 flex items-center gap-1.5">
                  <MapPin size={15} /> {spazio.indirizzo} — {spazio.citta} ({spazio.regione})
                </div>
                <p className="mt-4 text-slate-700 leading-relaxed">{spazio.descrizione}</p>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 border border-slate-200 rounded-xl divide-x divide-slate-300">
                  <div className="p-4"><Ruler size={16} className="text-slate-400" /><div className="text-xs text-slate-500 mt-1">Formato</div><div className="font-semibold">{spazio.formato || spazio.dimensioni || "—"}</div></div>
                  <div className="p-4"><Landmark size={16} className="text-slate-400" /><div className="text-xs text-slate-500 mt-1">Comune</div><div className="font-semibold">{spazio.comune?.nome}</div></div>
                  <div className="p-4"><div className="text-xs text-slate-500 mt-1">Stato</div><div className={`font-semibold ${spazio.disponibile ? "text-success" : "text-slate-900"}`}>{spazio.disponibile ? "Disponibile" : "Occupato"}</div></div>
                </div>
              </div>
            </div>
            {spazio.comune?.regole && (
              <div className="border border-slate-100 bg-card rounded-xl p-6">
                <div className="text-xs font-semibold tracking-normal text-slate-500 mb-2">Regolamento del Comune</div>
                <p className="text-sm text-slate-700">{spazio.comune.regole}</p>
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div className="border border-slate-100 bg-card rounded-xl overflow-hidden p-6 sticky top-24">
              <div className="text-xs font-semibold tracking-normal text-slate-500">Canone</div>
              <div className="font-heading font-semibold text-3xl mt-1">{spazio.canone_giornaliero} €<span className="text-sm font-normal text-slate-500">/giorno</span></div>
              <button data-testid="avvia-pratica-button" onClick={avvia} disabled={!spazio.disponibile}
                className="mt-6 w-full bg-primary text-primary-foreground rounded-md py-3.5 font-semibold hover:bg-primary transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed">
                {spazio.disponibile ? "Avvia candidatura" : "Non disponibile"}
              </button>
              {!user && <div className="text-xs text-slate-500 mt-2 text-center">Accedi o registrati per candidarti</div>}
            </div>
            <div className="border border-slate-100 rounded-xl overflow-hidden aspect-[16/10] w-full">
              <MapContainer center={[spazio.lat, spazio.lng]} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} attributionControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="flat-tiles" />
                <CircleMarker center={[spazio.lat, spazio.lng]} radius={10}
                  pathOptions={{ color: "#020617", weight: 2, fillColor: "hsl(var(--info))", fillOpacity: 1 }} />
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
