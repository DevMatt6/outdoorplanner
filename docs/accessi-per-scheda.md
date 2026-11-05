# Accessi indipendenti per scheda

L’identità e il token sono conservati nella sessione della singola scheda. Aprendo tre schede è possibile accedere come Comune, Superadmin e Inserzionista: il ricaricamento mantiene l’account di quella scheda, mentre l’uscita o un nuovo accesso non cambiano le altre schede. Anche le richieste API e i download PDF usano il token della scheda corrente.

La precedente sessione condivisa viene eliminata al primo caricamento della nuova versione: occorre accedere nuovamente in ogni scheda. I browser possono copiare inizialmente la sessione quando si duplica una scheda; è sufficiente uscire nella scheda duplicata e accedere con l’account desiderato. Da quel momento gli accessi restano indipendenti.

Il server dà precedenza al token esplicito della richiesta rispetto a eventuali cookie condivisi. Un aggiornamento dell’utente ancora in corso non può ripristinare una sessione dopo l’uscita.

Verifiche: 48 test frontend, inclusa simulazione di tre sessioni isolate, ricaricamento, token API e uscita; test API con tre ruoli e cookie condiviso; build frontend.
