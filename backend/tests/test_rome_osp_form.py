import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rome_osp_form import make_template, condition, prepare, merge_values, errors

class RomeFormTest(unittest.TestCase):
    def setUp(self):
        self.tpl=make_template()
        self.p={'data_inizio':'2027-01-01','data_fine':'2027-01-03','dati_form':{},'richiedente':{'nome':'Mario Rossi'},'documenti':[]}
        prepare(self.p,self.tpl,{'indirizzo':'Roma','slug':'villa-ada','superficie_mq':100},{'nome':'Mario Rossi','tipo_soggetto':'Privato'},50)
        v=self.p['dati_form']
        for f in self.tpl['campi']:
            if f['id'] in v and v[f['id']] != '': continue
            if f['tipo']=='checkbox': v[f['id']]=f['required']
            elif f['tipo']=='number': v[f['id']]=0 if f.get('min',1)==0 else 10
            elif f['tipo']=='select': v[f['id']]=f['opzioni'][0]
            elif f['tipo']=='date': v[f['id']]='2000-01-01'
            else: v[f['id']]='Valore di prova'
        self.attach()
    def attach(self):
        self.p['documenti']=[{'tipo':d['id']} for d in self.tpl['documenti_richiesti'] if d['required'] and condition(d.get('condizione'),self.p['dati_form'])]
    def required_docs(self):
        return {d['id'] for d in self.tpl['documenti_richiesti'] if d['required'] and condition(d.get('condizione'),self.p['dati_form'])}
    def test_valid_full_and_zero_area_quotas(self):
        self.assertEqual(errors(self.p),[])
        self.assertEqual(self.p['dati_form']['superficie_commerciale'],0)
    def test_declarations_must_be_true(self):
        self.p['dati_form']['veridicita']=False
        self.assertTrue(any('veridicità' in e for e in errors(self.p)))
    def test_conditional_simplified_and_special_setups(self):
        self.p['dati_form']['elaborato_semplificato']=True
        self.assertNotIn('stralcio',self.required_docs())
        self.assertIn('disegno_semplificato',self.required_docs())
        self.p['dati_form']['tende_luci_insegne']=True
        self.assertTrue({'prospetti','dettagli','foto_ambiente_1','foto_dettaglio_3'} <= self.required_docs())
        self.p['data_fine']=self.p['dati_form']['data_fine']='2027-01-04'
        self.assertTrue(any('3 giorni' in e for e in errors(self.p)))
    def test_green_insurance_and_waste_exemption(self):
        self.assertNotIn('polizza_rct',self.required_docs())
        self.p['dati_form'].update(tipo_soggetto='Associazione',natura_evento='Culturale / ricreativa')
        self.assertIn('polizza_rct',self.required_docs())
        self.assertIn('contratto_rifiuti',self.required_docs())
        self.p['dati_form']['canone_esente']=True
        self.assertNotIn('contratto_rifiuti',self.required_docs())
        self.assertIn('esenzione_canone',self.required_docs())
    def test_receipt_and_stamp_exemption_are_not_automatic(self):
        self.p['dati_form'].update(diritti_regime='Esenzione richiesta',bollo_regime='Esenzione richiesta')
        self.assertTrue({'esenzione_diritti','esenzione_bollo'} <= self.required_docs())
        self.assertNotIn('ricevuta_diritti',self.required_docs())
        self.assertTrue(any('Allegato:' in e for e in errors(self.p)))
    def test_snapshot_profile_and_dates_are_protected(self):
        self.tpl['campi'].clear()
        self.assertGreater(len(self.p['form_template_snapshot']['campi']),20)
        v=merge_values(self.p,{'nome':'Altro','data_inizio':'2030-01-01','evento_descrizione':'Nuovo'})
        self.assertEqual(v['nome'],'Mario Rossi')
        self.assertEqual(v['data_inizio'],'2027-01-01')
        self.assertEqual(v['evento_descrizione'],'Nuovo')
    def test_docs_are_not_shared_and_legacy_is_preserved(self):
        second=copy.deepcopy(self.p); second['documenti']=[]
        self.assertTrue(errors(second))
        self.assertEqual(errors(self.p),[])
        self.assertEqual(errors({'dati_form':{},'documenti':[]}),[])
    def test_area_totals_are_consistent_and_numbers_finite(self):
        self.p['dati_form']['superficie_commerciale']=101
        self.assertIn('Le quote di superficie superano il totale',errors(self.p))
        self.p['dati_form']['persone_previste']='NaN'
        self.assertTrue(any('persone previste non valido' in e for e in errors(self.p)))

if __name__=='__main__': unittest.main()
