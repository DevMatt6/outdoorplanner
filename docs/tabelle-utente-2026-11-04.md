# Tabelle: Le mie pratiche e Le mie campagne

- Le mie pratiche: tabella condivisa con colonne Spazio/Circuito, Comune/Città, Tipo, Dal, Al, Importo, Stato e Azioni. Conservati filtri di stato, collegamenti ai dettagli ed eliminazione delle sole bozze con conferma.
- Le mie campagne: tabella con colonne Campagna, Tipo, Dal, Al, Circuiti/Spazi, Pratiche, Importo, Stato pratiche e Azioni. Destinazioni dei dettagli OOH e OSP conservate. Le richieste singole OSP, quando presenti, usano una seconda tabella con la colonna Comune.
- Entrambe riutilizzano DataTable con ricerca, ordinamento, paginazione e scorrimento orizzontale sui dispositivi stretti. Tipografia Geist, senza monospace.
- Il servizio di elenco delle proprie pratiche aggiunge il nome del Comune tramite una sola lettura aggregata dei riferimenti. Include correttamente il Comune delle proprie pratiche anche se sospeso; non modifica dati, autorizzazioni o filtri di proprietà.

## Verifiche

Build frontend riuscita con i precedenti avvisi sugli effetti React. Tutti i 21 test frontend superati, inclusi colonna Comune, ricerca per Comune, filtri di stato, eliminazione di bozze con conferma e destinazioni dei dettagli delle campagne OOH/OSP.

Test API completato su database temporaneo separato, con verifica del Comune delle pratiche anche dopo sospensione del Comune e del filtro per il proprietario. I dati dell’app non sono stati modificati dal collaudo. Server locale riavviato e verifica nel browser completata per entrambe le tabelle con i dati esistenti.

Anteprima: `pratiche-table-preview.png`.
