# PRD — Outdoor Planner

## Problem statement (originale)
SaaS per digitalizzare la gestione della pubblicità e dell'occupazione del suolo pubblico (OSP) per eventi. Tre ruoli: Inserzionista (User), Comune, Superadmin. Landing pubblica con mappa Italia interattiva (hover regioni), ricerca spazi, wizard pratica dinamico con FormTemplate condizionali, upload documenti, checkout mock, chat, notifiche in-app, backoffice comune con state machine pratiche + PDF autorizzazione + reporting, dashboard KPI superadmin. UI flat assoluta (no shadows), tutta in italiano.

## Scelte utente
- Auth: JWT custom (email/password) + bottone mock SPID/CIE
- Pagamenti: solo mock (nessuna Stripe)
- Tutte le fasi 1-5 nella prima iterazione
- Account demo: password demo123; superadmin = mattia.fabrizi92@gmail.com
- Lingua: italiano

## Architettura
- Backend: FastAPI (`/app/backend/server.py`, seed in `seed.py`), MongoDB (users, comuni, spazi, form_templates, pratiche, log_stato, notifiche, chat), JWT Bearer, upload su `/app/uploads` serviti da `/api/uploads`, PDF con reportlab
- Frontend: React (CRA) + zustand + axios + react-leaflet v5 + recharts + Tailwind flat design (Cabinet Grotesk / IBM Plex Sans, no shadows via CSS globale)
- GeoJSON regioni: `/app/frontend/public/geo/italy_regions.json` (openpolis)
- State machine: BOZZA → INVIATA → IN_ISTRUTTORIA ↔ INTEGRAZIONE_RICHIESTA → APPROVATA | RIFIUTATA, loggata in log_stato

## Implementato (17/06/2026 — MVP completo, testato 100%)
- Landing + mappa Italia hover/click regioni; ricerca spazi con filtri + mappa marker; dettaglio spazio
- Auth JWT 3 ruoli + mock SPID/CIE; route protette per ruolo
- Wizard pratica 5 step (periodo, form dinamico condizionale, upload doc, checkout mock, invio)
- Dashboard user, dettaglio pratica con cronologia stati, chat, download PDF, flusso integrazione
- Backoffice comune: scrivania con code, istruttoria (presa in carico/approva/rifiuta/integrazione), CRUD spazi con posizionamento mappa, form builder con logica condizionale, report incassi/stati, profilo & tariffe
- Superadmin: KPI dashboard, onboarding comuni (crea account referente), monitor anomalie
- Notifiche in-app cross-ruolo (campanella, polling 15s), email mock su log console
- Seed: 5 comuni, 16 spazi, 5 pratiche demo in tutti gli stati, chat/notifiche demo

## Credenziali demo
Vedi `/app/memory/test_credentials.md` (password demo123 per tutti).

## Design language (aggiornato — iterazione 3)
Su richiesta utente (screenshot stile "Donezo") il design è passato da flat brutalist a **soft modern SaaS**: canvas grigio caldo #F2F3F0, card bianche rounded-2xl/3xl con bordi slate-100, palette verde (primario #2F5B41, scuro #1F3D2B, soft #D8EADB/#E4EEE6), bottoni a pillola, badge stato soft (bg tenue + testo colorato), sidebar backoffice chiara con voce attiva verde e icone, font Plus Jakarta Sans. **Tutte le animazioni rimosse** (niente reveal, marquee, grain, transform hover); restano solo transition-colors e l'hover fluido della mappa Italia (fill verde).

## Backlog prioritizzato
- P1: Campaign Planner (candidatura multi-spazio)
- P2: date picker calendario (shadcn) con evidenza visiva dei periodi occupati nel wizard
- P2: Stripe test mode reale al posto del mock; export report CSV/PDF
- P2: clustering marker (react-leaflet-cluster) su città con molti spazi
- P2: notifiche real-time (websocket) al posto del polling

## Note tecniche
- seed_all non è idempotente per singola collezione (si attiva solo se manca il superadmin)
- CORS "*" ok perché auth è Bearer header (no cookie cross-origin)
- Test suite backend riusabile: `/app/backend/tests/backend_test.py`
