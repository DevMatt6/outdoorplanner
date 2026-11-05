# Campagne in bozza e proposta OOH su mappa

In «Le mie campagne» il pulsante cestino elimina una campagna OSP in bozza o OOH in completamento, previa conferma. Il backend verifica proprietario, stato di tutte le pratiche e assenza di pagamenti; campagne inviate o pagate non sono eliminabili. La cancellazione include pratiche e record collegati, liberando le prenotazioni senza modificare il catalogo.

Nello step «Proposta» del planner OOH, selezionare un Comune per vedere i relativi impianti consigliati. La legenda consente di isolare un circuito. Colori e collegamenti tratteggiati ne mostrano la distribuzione geografica. I collegamenti non rappresentano percorsi o coperture misurate. I popup contengono dettagli, motivi della raccomandazione e il comando per escludere l’impianto e ricalcolare. I punti senza coordinate restano consultabili sotto la mappa. «Applica proposta» mantiene la selezione proposta per tutti i Comuni, indipendentemente dal Comune visualizzato.

Verifiche: 33 test frontend superati, inclusi cambio Comune, filtro circuito, collegamenti locali, esclusione e cancellazione da tabella. Test API su database temporaneo per cancellazione OSP/OOH, permessi, blocco di pratiche inviate/pagate, eliminazione dei record collegati e conservazione del catalogo.
