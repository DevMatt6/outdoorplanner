import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { ItalyMap } from "../components/ItalyMap";
import { ArrowRight, MapPin, FileText, CreditCard, MessageSquare } from "lucide-react";

const HERO_IMG = "https://images.unsplash.com/photo-1699480114704-ac153307d2a0?crop=entropy&cs=srgb&fm=jpg&q=85";

export default function Landing() {
  return (
    <div className="pb-4">
      <NavBar />
      <section className="max-w-7xl mx-auto px-4 mt-4">
        <div className="bg-white rounded-3xl border border-slate-100 grid lg:grid-cols-2 overflow-hidden">
          <div className="px-8 lg:px-12 py-16 lg:py-24">
            <span className="inline-block text-xs font-bold text-[#1F3BB3] bg-[#E8EFFF] rounded-full px-4 py-1.5 mb-6">
              Pubblicità · Occupazione suolo pubblico · Eventi
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-extrabold tracking-tight leading-[1.05]">
              Lo spazio pubblico,<br />
              <span className="text-[#1F3BB3]">digitalizzato.</span>
            </h1>
            <p className="mt-6 text-base text-slate-600 max-w-lg leading-relaxed">
              Trova lo spazio giusto sulla mappa, presenta la pratica online, paga e segui
              l'istruttoria del Comune in tempo reale. Niente sportelli, niente carta.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/spazi" data-testid="hero-cta-spazi"
                className="inline-flex items-center gap-2 bg-[#1F3BB3] text-white rounded-full px-7 py-3.5 font-bold hover:bg-[#172E93] transition-colors">
                Cerca uno spazio <ArrowRight size={18} />
              </Link>
              <Link to="/login" data-testid="hero-cta-login"
                className="inline-flex items-center gap-2 border border-slate-200 rounded-full px-7 py-3.5 font-bold hover:border-[#1F3BB3] hover:text-[#1F3BB3] transition-colors">
                Area riservata
              </Link>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-3">
              {[["20", "regioni coperte"], ["16+", "spazi a catalogo"], ["5", "comuni attivi"]].map(([n, l]) => (
                <div key={l} className="bg-[#F8F9FD] rounded-2xl px-5 py-4">
                  <div className="font-heading font-extrabold text-2xl">{n}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block relative p-4">
            <img src={HERO_IMG} alt="Billboard" className="w-full h-full object-cover rounded-2xl" />
            <div className="absolute bottom-10 left-10 bg-white rounded-2xl px-5 py-4 max-w-[260px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1F3BB3]">In evidenza</div>
              <div className="font-heading font-extrabold text-sm mt-0.5">Billboard 6x3 · alta visibilità</div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 mt-4">
        <div className="bg-white rounded-3xl border border-slate-100 p-8 lg:p-12">
          <div className="mb-8">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Esplora l'Italia</div>
            <h2 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight mt-1">
              Scegli la regione, trova lo spazio
            </h2>
          </div>
          <ItalyMap />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 mt-4">
        <div className="bg-white rounded-3xl border border-slate-100 p-8 lg:p-12">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight mb-8">Come funziona</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              [MapPin, "01 — Trova", "Cerca sulla mappa lo spazio pubblicitario o l'area evento nel comune che ti interessa."],
              [FileText, "02 — Candidati", "Compila il wizard con i moduli dinamici del Comune e carica bozzetti e documenti."],
              [CreditCard, "03 — Paga", "Checkout online del canone calcolato automaticamente sul periodo richiesto."],
              [MessageSquare, "04 — Segui", "Monitora lo stato della pratica, chatta con l'ufficio e scarica l'autorizzazione."],
            ].map(([Icon, t, d]) => (
              <div key={t} className="bg-[#F8F9FD] rounded-2xl p-7 hover:bg-[#E8EFFF] transition-colors">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[#1F3BB3] text-white"><Icon size={20} /></span>
                <h3 className="font-heading font-extrabold text-lg mt-4">{t}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-4 mt-4">
        <div className="bg-[#2B4BDB] text-white rounded-3xl px-8 py-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-white text-[#2B4BDB] font-heading font-extrabold w-9 h-9 rounded-full flex items-center justify-center text-sm">OP</span>
            <span className="font-heading font-bold">Outdoor Planner</span>
          </div>
          <div className="text-xs text-emerald-100/70">Demo MVP — email e pagamenti sono simulati.</div>
        </div>
      </footer>
    </div>
  );
}
