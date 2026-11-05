# Reset dei test e modifica dei moduli

La dashboard Superadmin include «Elimina pratiche e campagne», accanto al reset completo. Richiede la conferma RESET ed elimina pratiche, campagne, prenotazioni, soggetti e creatività, cronologie, chat e notifiche collegate. Conserva account, comuni, cataloghi, moduli, file caricati e migrazioni. Le disponibilità OOH/OSP tornano libere. Non esegue il reset durante il deploy.

In Comune → Moduli (`/comune/form`) i campi esistenti consentono di modificare etichetta, tipo, opzioni e obbligatorietà. Anche i documenti esistenti permettono di modificare il nome. Premere «Salva modulo» per rendere persistenti le modifiche. Gli identificativi e i metadati aggiuntivi dei campi vengono conservati. Le pratiche con uno snapshot del modulo conservano il proprio schema storico.

Verifiche: 31 test frontend; integrazione API su database temporaneo per autorizzazioni, conferma, cancellazione selettiva, conservazione configurazioni, ripetibilità e modifica persistente dei campi. Build frontend completata con gli avvisi React sugli effetti già presenti.
