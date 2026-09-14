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

## Implementato (Iterazione 4 — testato 100%, 63/63 backend)
- **Campaign Planner multi-spazio**: /campagne (lista), /campagne/nuova (planner 3 step: periodo → selezione multi-spazio con disponibilità reale → riepilogo, checkout unico mock, invio massivo), /campagne/:id (dettaglio con pratiche). Backend: collezione campagne, GET /spazi/disponibili, POST/GET /campagne, checkout e invia di campagna con log e notifiche
- **Calendario con periodi occupati**: DateRangePicker (react-day-picker range, locale it) nel wizard pratica e nel planner — date occupate rosse/disabilitate, blocco range che attraversano periodi occupati, riepilogo periodo e importo live

## Implementato (Iterazione 5 — testato 100%, 77/77 backend)
- Home "/" = pagina di login (landing rimossa); utenti loggati rediretti alla propria dashboard
- Registrazione per Privato/Azienda/Associazione con campi dedicati (ragione sociale, P.IVA, CF, PEC, telefono) salvati sul profilo utente
- Nuovo catalogo: tipologie impianto (Arredo Urbano, Poster Standard, Totem Digitale, Progetto Speciale/OSP) + formati (6x3, MUPI 120x180, 4x3, 75" LED, 55" LED, Pensilina 200x100, Maxi Ledwall, Su misura) con migrazione idempotente ensure_catalogo
- Filtri /spazi: Comune, Tipologia impianto, Formato + bottone "Avvia una campagna"
- Planner campagna a 4 step: Periodo → Spazi (mappa+elenco+filtri, selezione da lista o marker) → Moduli (form dinamico per ogni Comune coinvolto + upload documenti applicati alle pratiche del comune, PUT /campagne/{id}/dati-form) → Riepilogo con pagamento mock e invio massivo
- Dedupe campi form template per id (server-side)

## Implementato (Iterazione 6 — lista 15 punti Msg 213, testato 100%: 95/95 backend + frontend E2E)
- Spazi: immagini specifiche per tipologia (13 spazi reseedati Roma/Milano/Bologna con zona/quartiere), upload foto spazio (POST /comune/spazi/upload-foto), immagine MUPI generata via AI in /app/uploads/spazi/
- Mappa /spazi: tooltip su hover marker con foto + nome + prezzo; filtro Zona/quartiere (GET /spazi/zone, reset al cambio comune); zona mostrata nelle card
- Campaign Planner: step Moduli ora è PER SPAZIO (GET /form-templates/spazio/{id}, fallback su modulo comune; PUT /campagne/{id}/dati-form con pratica_ids); upload documenti per singola pratica; filtro zona nel planner
- Dashboard user: filtri pill per stato + eliminazione bozze (DELETE /pratiche/{id}, solo BOZZA, con conferma)
- Report comune: sezione "Dettaglio per spazio" (GET /comune/report/spazi) con storico espandibile per pratica
- Profilo comune: sezione "Canone per singolo spazio" con salvataggio inline (PATCH /comune/spazi/{id}/canone, L3)
- Logo comune: upload in onboarding superadmin (POST /admin/upload-logo, campo logo_url su ComuneOnboardIn); visualizzato in sidebar backoffice, profilo comune, tabelle admin
- Superadmin: tabella "KPI per comune" (GET /admin/comuni arricchito: spazi_attivi, approvate, incasso_totale, fee 5%) con drill-down report per comune (GET /admin/comuni/{id}/report: incassi/mese + ultime pratiche); tabella comuni con colonne incasso/fee

## Implementato (Iterazione 7 — documenti allegati configurabili + Modulo OSP, testato: 105/105 backend + UI)
- Ogni form template ha ora `documenti_richiesti` [{id,label,required}]: il Comune li gestisce dal Form Builder (aggiungi/rimuovi campo upload, toggle obbligatorio) — sezione "Documenti allegati richiesti"
- Step "Documenti" del wizard pratica e area upload per spazio nel Campaign Planner ora dinamici dal template (non più hardcoded bozzetto/planimetria/doc identità); validazione blocca l'invio se mancano documenti obbligatori
- Fallback backend: template legacy senza il campo → 3 documenti default (non obbligatori)
- Wizard pratica ora usa il modulo assegnato allo spazio (GET /form-templates/spazio/{id})
- Creato "Modulo OSP — Occupazione Suolo Pubblico" (7 campi con logica condizionale potenza_kw + 4 documenti: planimetria*, relazione tecnica, polizza RC*, doc identità*) e assegnato agli spazi Progetto Speciale (seed_osp.py idempotente)

## Implementato (Iterazione 8 — gestione comuni superadmin + monitor L3, testato via curl + UI)
- Superadmin /admin/comuni: modifica comune (PUT /admin/comuni/{id}, form pre-compilato senza sezione referente; rinomina propaga citta/regione agli spazi) ed eliminazione con cascade (DELETE: spazi, pratiche + log/chat, form template, account operatori) previa conferma
- Monitor anomalie per Comune L3: GET /comune/anomalie (scoped al proprio comune, 403 per L1/L2), pagina /comune/monitor con voce sidebar visibile solo a L3

## Implementato (Iterazione 9 — nuova esplorazione mappa drill-down, testato: testing agent frontend + fix verificato)
- Nuovo componente EsploraMappa: mappa flat full-width con drill-down Italia (GeoJSON regioni, no tile) → Regione (marker comuni arancioni) → Comune (tile CartoDB light_nolabels, bolle zona/quartiere con conteggio) → Zona (pin spazi con tooltip hover che include FOTO, nome, tipologia, prezzo); breadcrumb overlay Italia/Regione/Comune/Zona
- Sotto la mappa: griglia comuni selezionabili (logo, nome, regione, n. spazi) → click comune → griglia spazi con foto 4:3 e specifiche (componente SpazioCard)
- Stessa UX in /spazi (card → dettaglio) e nel Campaign Planner step Spazi (card/pin → selezione con check, selezione multi-comune preservata, filtri tipologia/formato client-side)
- Fix: "Tutti i Comuni" resetta anche la regione; crumb regione torna al livello regione

## Implementato (Iterazione 9-10 — RISTRUTTURAZIONE OOH/OSP da specifica 59 punti, testato: 18/18 backend + frontend E2E)
- **Due servizi distinti**: Home hub post-login "Cosa vuoi fare?" (Pianifica Campagna OOH / Avvia richiesta OSP)
- **Campagne OOH**: flusso Periodo → Comuni (multi) → Zone/Circuiti (pacchetti con impianti visualizzabili) → Riepilogo → Genera; blocco impianti 24h (prenotazioni HELD/CONFIRMED/EXPIRED/CANCELLED, hold_expires_at, HOLD_HOURS env configurabile, scadenza automatica con loop 60s + notifiche + rilascio impianti), countdown live da backend, verifica anti race-condition, 409 su doppia prenotazione
- **Post-generazione**: checklist per pratica (moduli, documenti, creatività, pagamento mock); creatività con compatibilità formato+digitale/DOOH validata server-side; invia → INVIATA + CONFIRMED; annulla → libera impianti
- **Nuove entità**: zone (poligono, vie, quartiere), impianti (tipologie gerarchiche: Cartacee/DOOH/Maxi), pacchetti (prezzo, modulo assegnabile), prenotazioni, creativita; pratiche tipizzate OOH/OSP con nuovi stati (DA_COMPLETARE, IN_VERIFICA, PRENOTAZIONE_SCADUTA, ANNULLATA)
- **OSP preservato**: wizard esistente su aree OSP seedate; /spazi = catalogo aree OSP; transizioni comune separate (OOH: INVIATA→IN_VERIFICA)
- **Backoffice comune**: pagine Zone & confini (disegno poligono a click su mappa flat), Impianti OOH (CRUD con tipologie gerarchiche), Circuiti/Pacchetti (CRUD con selezione impianti e modulo); report OOH per circuito + prenotazioni HELD/CONFIRMED/conversione, sezione OSP separata
- **Superadmin**: stati onboarding comune (DA_CONFIGURARE→ATTIVO→SOSPESO... — solo ATTIVO visibile agli utenti), KPI OOH (zone, impianti, circuiti, HELD, confermati, conversione, campagne multicomune)
- **SPID rimosso** completamente (endpoint + UI); **reset demo**: solo Roma/Milano/Napoli, 4 zone ciascuno, 12 impianti/zona, 3 circuiti/zona, moduli OOH+OSP, aree OSP (seed_demo.py ripetibile)
- Tile mappa: OSM con filtro CSS flat (CartoDB richiedeva API key)

## Backlog prioritizzato
- P2: date picker anche per modifica pratiche in INTEGRAZIONE_RICHIESTA
- P2: Stripe test mode reale al posto del mock; export report CSV/PDF
- P2: clustering marker su città con molti spazi; notifiche websocket
- P3: refactor server.py in router per feature (>750 righe)

## Note tecniche
- seed_all non è idempotente per singola collezione (si attiva solo se manca il superadmin)
- CORS "*" ok perché auth è Bearer header (no cookie cross-origin)
- Test suite backend riusabile: `/app/backend/tests/backend_test.py`
