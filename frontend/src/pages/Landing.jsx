import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { ItalyMap } from "../components/ItalyMap";
import { ArrowRight, MapPin, FileText, CreditCard, MessageSquare } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1699480114704-ac153307d2a0?crop=entropy&cs=srgb&fm=jpg&q=85";

export default function Landing() {
  return (
    <div>
      <NavBar />
      <section className="border-b border-slate-900">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2">
          <div className="px-6 py-16 lg:py-24 lg:pr-16">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#0033FF] mb-6">
              Pubblicità · Occupazione suolo pubblico · Eventi
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold tracking-tight leading-[1.02]">
              Lo spazio pubblico,<br />
              <span className="text-[#0A3D91]">digitalizzato.</span>
            </h1>
            <p className="mt-6 text-base text-slate-700 max-w-lg leading-relaxed">
              Trova lo spazio giusto sulla mappa, presenta la pratica online, paga e segui
              l'istruttoria del Comune in tempo reale. Niente sportelli, niente carta.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/spazi" data-testid="hero-cta-spazi"
                className="inline-flex items-center gap-2 bg-[#0033FF] text-white px-7 py-3.5 font-bold hover:bg-[#0A3D91] transition-colors">
                Cerca uno spazio <ArrowRight size={18} />
              </Link>
              <Link to="/login" data-testid="hero-cta-login"
                className="inline-flex items-center gap-2 border-2 border-slate-900 px-7 py-3.5 font-bold hover:bg-slate-900 hover:text-white transition-colors">
                Area riservata
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 border border-slate-300 divide-x divide-slate-300">
              {[["20", "regioni coperte"], ["16+", "spazi a catalogo"], ["5", "comuni attivi"]].map(([n, l]) => (
                <div key={l} className="px-4 py-4">
                  <div className="font-heading font-extrabold text-2xl">{n}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-l border-slate-900 hidden lg:block">
            <img src={HERO_IMG} alt="Billboard" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Esplora l'Italia</div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight mt-1">
              Scegli la regione, trova lo spazio
            </h2>
          </div>
        </div>
        <ItalyMap />
      </section>

      <section className="border-t border-slate-900 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight mb-10">Come funziona</h2>
          <div className="grid md:grid-cols-4 border border-slate-900 divide-y md:divide-y-0 md:divide-x divide-slate-900 bg-white">
            {[
              [MapPin, "01 — Trova", "Cerca sulla mappa lo spazio pubblicitario o l'area evento nel comune che ti interessa."],
              [FileText, "02 — Candidati", "Compila il wizard con i moduli dinamici del Comune e carica bozzetti e documenti."],
              [CreditCard, "03 — Paga", "Checkout online del canone calcolato automaticamente sul periodo richiesto."],
              [MessageSquare, "04 — Segui", "Monitora lo stato della pratica, chatta con l'ufficio e scarica l'autorizzazione."],
            ].map(([Icon, t, d]) => (
              <div key={t} className="p-8 hover:bg-blue-50 transition-colors">
                <Icon size={28} className="text-[#0033FF]" />
                <h3 className="font-heading font-extrabold text-lg mt-4">{t}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-900 bg-[#020617] text-white">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-white text-[#0A3D91] font-heading font-extrabold px-2 py-1">OP</span>
            <span className="font-heading font-bold">Outdoor Planner</span>
          </div>
          <div className="text-xs text-slate-400">Demo MVP — SPID/CIE, email e pagamenti sono simulati.</div>
        </div>
      </footer>
    </div>
  );
}
