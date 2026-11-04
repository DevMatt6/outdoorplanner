# Modulo OSP eventi – Roma Capitale

Implementato il 4 novembre 2026, confrontando l’allegato fornito con il modello ufficiale Roma Capitale del 2025. Le tariffe e le capienze del catalogo restano dati dimostrativi: il modulo non le qualifica come autorizzate dal Comune.

## Compilazione

Per ogni Comune, l’interfaccia raccoglie una sola volta i dati condivisi: richiedente, recapiti mancanti, informazioni dell’evento, persone previste, allestimenti, bolli/diritti e dichiarazioni. I dati presenti nel profilo sono mostrati precompilati; nascita, residenza e altri dati assenti vengono richiesti nel modulo. I valori comuni vengono salvati su ciascuna pratica, così ogni area conserva una richiesta completa.

Per ciascuna area restano ubicazione, ufficio competente da confermare, periodo prenotato, superfici per uso e caratteristiche dell’occupazione. Il periodo viene precompilato dalla prenotazione. Le quote di superficie non possono superare il totale; zero è ammesso per una quota non utilizzata.

Gli allegati si caricano separatamente per area: istanza firmata, identità, documenti tecnici e fotografie, sicurezza e documenti condizionali. L’upload di una pratica non completa l’altra. I collegamenti ai modelli sono disponibili nei rispettivi allegati. Il formato accettato è PDF/P7M, anche JPG/PNG per le fotografie, massimo 20 MB a file; la firma e il contenuto degli elaborati restano soggetti alla verifica dell’ufficio.

Il disegno semplificato richiede una dichiarazione di occasionalità e dimensioni limitate, entro tre giorni, senza inventare una soglia di superficie. Per tende, faretti e insegne restano gli elaborati specifici. Le condizioni comprendono anche sottoservizi, assicurazione, rifiuti, soggiorno e prove delle esenzioni. Le dichiarazioni obbligatorie devono essere confermate esplicitamente.

## Conservazione e verifiche

Le nuove richieste conservano una copia del modello utilizzato. Le bozze relative alle aree attive di Roma sono aggiornate con backup; le pratiche già inviate restano inalterate. La bozza si può salvare incompleta e riprendere dalla campagna. Il controllo finale del servizio verifica tutte le pratiche prima di avviarne l’invio interno, impedendo un invio parziale in caso di documenti mancanti.

Il pagamento resta simulato: non produce ricevute ufficiali. Non sono stati implementati protocollazione o invio PEC verso Roma Capitale.

## Fonti

- [Modello ufficiale OSP 2025](https://www.comune.roma.it/web-resources/cms/documents/OSP_eventi_manifestazioni_commercio_2025.pdf): adottati stralcio 1:500, suddivisione delle superfici, rifiuti e riferimenti aggiornati al canone e alla privacy rispetto all’allegato.
- [Servizio del Municipio V e modelli collegati](https://www.comune.roma.it/web/it/scheda-servizi.page?contentId=INF1340651&municipio=mun_v&stem=occupazione_suolo_pubblico&tipo=mun).
- [Valutazione rischi](https://www.comune.roma.it/web-resources/cms/documents/Modulo_tabella_valutazione_rischi_manifestazioni_pubbliche_2025.pdf).
- [Modello per il piano di emergenza](https://www.comune.roma.it/web-resources/cms/documents/modulo2_piano_emergenza_manifestazione.pdf).
- [Coordinamento centrale grandi eventi](https://www.comune.roma.it/web/it/scheda-servizi.page?contentId=UFF30792): da verificare per eventi su più Municipi o di interesse cittadino, senza attribuire automaticamente ogni area a un ufficio.

Verifiche: test di interfaccia su due aree/stesso Comune e su Comuni diversi; controlli su dichiarazioni, allegati condizionali, salvataggio e migrazione; prova API in database temporaneo, comprese validazione dei formati e assenza di invii parziali; compilazione del frontend e controllo visivo nell’app locale.
