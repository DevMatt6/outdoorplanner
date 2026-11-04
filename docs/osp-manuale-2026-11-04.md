# OSP: scelta manuale degli spazi

Il percorso è ora **Budget → Periodo → Comuni → Spazi OSP → Moduli → Riepilogo**.

- Primo step con il solo budget. Rimossi obiettivo, pubblico, contesti, distribuzione, attività e superficie dal questionario OSP.
- Eliminata la fase Proposta e la relativa chiamata automatica al servizio di raccomandazione. Nessuna selezione o applicazione automatica degli spazi.
- Dopo i Comuni compare direttamente l’elenco di card con foto 4:3, nome, città, zona, canone giornaliero e costo dell’intero periodo.
- Indicazione “Consigliato nel budget” e ordinamento dei consigliati per costo crescente. I consigli si aggiornano in base al budget residuo, riservando il minimo necessario ai Comuni non ancora coperti. Rimane la regola di almeno uno spazio per ogni Comune scelto. Tutte le scelte restano manuali.
- Filtri per Comune e zona, ricerca per nome/indirizzo, riepilogo del budget e selezione utilizzabile da tastiera.
- Nessuna mappa nel planner OSP. Gestione di caricamento, errori e immagini mancanti; passaggi riportati all’inizio della schermata.
- Adattamento circoscritto dell’API: il brief OSP ammette l’assenza dell’obiettivo. Il brief OOH continua a richiederlo. Budget, disponibilità, durata minima, copertura dei Comuni, moduli, documenti, pagamento e invio conservano i controlli esistenti.

## Verifiche

- Build frontend di produzione riuscita, con i precedenti avvisi sulle dipendenze degli effetti React.
- 17 test frontend superati: inclusi budget senza targeting, disponibilità, calcolo dei consigli con copertura dei Comuni, assenza di preselezione, card 4:3, richiesta di selezione manuale, dati inviati all’API e blocco del superamento budget.
- 14 test backend sulle regole di pianificazione superati, inclusi OSP senza obiettivo e obbligatorietà dell’obiettivo OOH.
- Test API completo su database locale temporaneo e separato: creazione OSP senza obiettivo, rispetto del budget, salvataggio brief, pagamento simulato/invio, e regressioni OOH. Database temporaneo eliminato al termine; dati dell’app non modificati.
- Verifica browser con account demo: budget, periodo, scelta Comune, apertura diretta delle card, immagini 4:3, prezzi e consigli. Nessuna pratica creata durante la verifica visiva.
- Server locale riavviato per rendere disponibile il nuovo modello OSP.
