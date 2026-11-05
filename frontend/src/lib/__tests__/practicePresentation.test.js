import { practiceLabel, installationGroups } from '../practicePresentation';
test('OOH summaries use city and zone while installation groups retain circuit details',()=>{
 const practice={tipo:'OOH',comune_nome:'Roma',zona_nome:'Centro, Nord',spazio_nome:'Circuito A + Circuito B',circuiti:[{nome:'Circuito A',zona_nome:'Centro',impianti_ids:['a','b']},{nome:'Circuito B',zona_nome:'Nord',impianti_ids:['c']}],impianti:[{id:'a'},{id:'b'},{id:'c'}]};
 expect(practiceLabel(practice)).toBe('Roma · Centro, Nord');
 const groups=installationGroups(practice);
 expect(groups.map(g=>[g.zona,g.impianti.length])).toEqual([['Centro',2],['Nord',1]]);
 expect(groups[0].impianti[0].circuito_nome).toBe('Circuito A');
 expect(practiceLabel({tipo:'OSP',spazio_nome:'Piazza'})).toBe('Piazza');
});
