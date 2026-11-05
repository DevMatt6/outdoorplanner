# PDF dopo pagamento e tabelle campagne

Il PDF è scaricabile soltanto per pratiche approvate e pagate. Il controllo è applicato dal server e dai pulsanti utente e Comune. Per OOH il PDF usa i dati degli impianti e della zona senza richiedere uno spazio OSP. Il Comune può scaricare solo documenti delle pratiche di propria competenza.

Avvisi di pagamento, scadenza e opzione usano i colori blu della piattaforma. La pagina Le mie campagne mostra colonne per impianti/spazi, stato delle pratiche e pagamento, con un pulsante Dettaglio esplicito.

La scrivania del Comune usa una tabella con una riga per campagna: nome, tipo, numero di pratiche, date, richiedente, stato e pagamento. Dettaglio apre la tabella delle pratiche collegate, da cui si accede all’istruttoria. Ricerca, ordinamento e paginazione usano il componente condiviso. I filtri di stato individuano le campagne pertinenti mantenendo completo il dettaglio delle relative pratiche; le richieste singole restano righe distinte.

Verifiche: 45 test frontend superati; test API su database temporaneo per blocco del PDF prima del pagamento, download OOH e OSP dopo pagamento e isolamento tra Comuni. Build frontend riuscita con i precedenti avvisi React sugli effetti.
