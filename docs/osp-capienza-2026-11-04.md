# OSP: superficie, capienza e persone previste

Nell’area Comune, “Dati per i suggerimenti di campagna” mostra soltanto superficie disponibile (m²) e capienza (numero di persone). Contesti, pubblico e attività non sono più mostrati per OSP; i controlli OOH sono conservati. Superficie e capienza compaiono anche nell’elenco delle aree OSP.

La creazione della campagna OSP richiede budget e numero di persone previste, intero positivo. Il numero viene salvato nel brief e mostrato nel riepilogo e nel dettaglio della campagna. L’elenco manuale comprende solo aree disponibili con capienza dichiarata sufficiente. Le card riportano superficie e capienza, restano ferme alla selezione e i consigli continuano a considerare budget e copertura dei Comuni.

Il backend convalida capienza e persone previste come interi positivi e rifiuta la selezione di spazi con capienza insufficiente o non dichiarata quando sono specificate persone previste. I brief storici senza questo dato restano compatibili. Nessuna capienza è stata stimata dalla superficie o inserita automaticamente nei dati esistenti: i Comuni devono completare le aree prima che risultino idonee alle nuove campagne.

Verifiche: 25 test frontend, 17 test delle regole backend e test API su database temporaneo separato superati. L’integrazione copre salvataggio e aggiornamento della capienza, rifiuto di valori frazionari, persistenza delle persone previste e rifiuto di capienza insufficiente/non dichiarata. Build di produzione riuscita con i precedenti avvisi sugli effetti React. Verifica nel browser del nuovo primo step. Nessun dato reale modificato durante i test.
