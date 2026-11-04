# Roma: cinque aree OSP

Il catalogo attivo OSP di Roma è stato sostituito con queste cinque aree. I prezzi sono **giornalieri**, secondo il modello già utilizzato dall’app. Prezzi, superfici e capienze sono dati dimostrativi scelti per il seed: non rappresentano tariffe ufficiali, capienze autorizzate o disponibilità effettiva dei luoghi.

| Area | €/giorno demo | Superficie demo | Capienza demo |
|---|---:|---:|---:|
| Lago Eur | 2.000 | 1.500 m² | 500 persone |
| Osservatorio Astronomico Romano | 2.500 | 600 m² | 150 persone |
| Villa Ada | 3.000 | 4.500 m² | 1.500 persone |
| Circo Massimo | 5.000 | 20.000 m² | 10.000 persone |
| Piazza del popolo | 4.500 | 7.500 m² | 3.000 persone |

L’Osservatorio corrisponde alla sede romana di Monte Mario, Villa Mellini, Viale del Parco Mellini 84. Le altre schede includono zona, indirizzo, coordinate indicative, descrizione e modulo OSP del Comune.

## Sostituzione e conservazione dello storico

Migrazione `rome-osp-five-venues-2026-11-04-v1`, ripetibile senza reinserire i vecchi spazi o sovrascrivere le modifiche successive del Comune. Nel database locale: 36 vecchie aree, 29 prive di riferimenti rimosse e 7 collegate a pratiche/campagne archiviate. Catalogo attivo: 5 aree. I record archiviati restano accessibili ai dettagli delle pratiche storiche ma non prenotabili né presenti nei cataloghi attivi. Salvata una copia completa dei 36 documenti originali nella collezione `seed_backups`, con identificativo della migrazione. Pratiche, campagne, account, impianti e circuiti OOH non sono stati modificati.

Il seed esteso esclude la generazione delle vecchie aree OSP di Roma; continua a generare gli impianti OOH e i cataloghi delle altre città. La migrazione viene controllata all’avvio, anche dopo deploy, senza rieseguire la sostituzione se già completata.

## Fotografie reali e licenze

Foto salvate in `frontend/public/images/osp/roma/`; crediti e collegamenti alle licenze sono visualizzati sulle card e nelle schede. Nessuna foto generata. Le immagini sono mostrate con ritaglio CSS nel formato delle card; i file di origine non sono stati alterati localmente.

- Lago Eur: [foto di Sergio D’Afflitto](https://commons.wikimedia.org/wiki/File:Roma_EUR_Laghetto_vista_dal_basso.jpg), [CC BY-SA 3.0 IT](https://creativecommons.org/licenses/by-sa/3.0/it/).
- Osservatorio: [foto di H. Raab / Vesta](https://commons.wikimedia.org/wiki/File:Osservatorio_Astronomico_di_Roma.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Villa Ada: [foto di Gidipa / Giuseppe Di Paolo](https://commons.wikimedia.org/wiki/File:Roma_Villa_Ada.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Circo Massimo: [foto di Jebulon](https://commons.wikimedia.org/wiki/File:Circo_Massimo,_Rome,_Italy.jpg), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Piazza del Popolo: [foto European Commission / © European Union, 2026](https://commons.wikimedia.org/wiki/File:Piazza_del_Popolo,_Roma.jpg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Riferimenti sui luoghi: [Lago EUR](https://www.turismoroma.it/en/node/2118), [Osservatorio](https://www.turismoroma.it/it/luoghi/osservatorio-astronomico-di-roma), [Villa Ada](https://www.turismoroma.it/it/luoghi/villa-ada-savoia), [Circo Massimo](https://www.turismoroma.it/it/luoghi/circo-massimo), [Piazza del Popolo](https://www.turismoroma.it/it/luoghi/piazza-del-popolo).

## Verifiche

25 test frontend superati e build di produzione riuscita, con i precedenti avvisi sugli effetti React. Test di sostituzione Roma su database temporaneo: cinque aree, backup, conservazione riferimenti, isolamento delle altre città e dell’OOH, esclusione degli archivi dai cataloghi e blocco nuove richieste sugli archivi, ripetibilità e conservazione delle modifiche successive. Test del seed esteso: 77 aree OSP complessive (5 Roma + 36 Napoli + 36 Milano), prenotazione/pagamento/invio simulati e 195 impianti OOH in 60 circuiti, senza regressioni.
