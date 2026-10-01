import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from pydantic import ValidationError
from campaign_planning import CampaignBrief, check_selection, period_days, recommend


def item(id, city='roma', cost=10, **extra):
    return {'id': id, 'comune_id': city, 'prezzo': cost, 'canone_giornaliero': cost, 'attivo': True, **extra}

class PlanningTests(unittest.TestCase):
    def brief(self, **changes):
        return CampaignBrief(**({'obiettivo': 'awareness', 'budget': 100, 'comuni_ids': ['roma', 'milano']} | changes))

    def test_all_cities_and_budget_for_whole_period(self):
        b = self.brief(budget=60)
        p = recommend([item('r'), item('m', 'milano'), item('extra', cost=25)], b, 'OOH', 3)
        self.assertTrue(p['fattibile'])
        self.assertEqual(p['totale'], 60)
        self.assertEqual(set(p['per_comune']), {'roma', 'milano'})
        self.assertEqual(p['residuo'], 0)

    def test_no_partial_proposal_when_all_cities_are_unaffordable(self):
        p = recommend([item('r'), item('m', 'milano')], self.brief(budget=59.99), 'OOH', 3)
        self.assertFalse(p['fattibile'])
        self.assertEqual(p['items'], [])
        self.assertIn('60.00', p['avvisi'][0])

    def test_missing_city_cannot_be_claimed_as_covered(self):
        p = recommend([item('r')], self.brief(), 'OOH', 1)
        self.assertFalse(p['fattibile'])
        self.assertIn('milano', p['avvisi'][0])

    def test_best_overall_can_use_subset_of_cities(self):
        b = self.brief(budget=10, distribuzione='migliore')
        p = recommend([item('r', contesti=['centro']), item('m', 'milano')], b, 'OOH', 1)
        self.assertEqual([i['id'] for i in p['items']], ['r'])

    def test_exclusion_and_minimum_duration(self):
        b = self.brief(comuni_ids=['roma'])
        p = recommend([item('x'), item('long', giorni_minimi=7), item('ok')], b, 'OOH', 3, ['x'])
        self.assertEqual([i['id'] for i in p['items']], ['ok'])

    def test_format_is_hard_constraint(self):
        b = self.brief(comuni_ids=['roma'], formato='digitale')
        p = recommend([item('paper', tipologia='Manifesto'), item('led', tipologia='Maxi Ledwall Stradale')], b, 'OOH', 1)
        self.assertEqual([i['id'] for i in p['items']], ['led'])

    def test_osp_unknown_surface_and_activity_excluded(self):
        b = self.brief(comuni_ids=['roma'], attivita='sampling', superficie_mq=30)
        p = recommend([item('unknown'), item('small', superficie_mq=20, attivita_ammesse=['sampling']), item('yes', superficie_mq=40, attivita_ammesse=['sampling'])], b, 'OSP', 1)
        self.assertEqual([i['id'] for i in p['items']], ['yes'])

    def test_drive_to_store_uses_real_coordinates(self):
        b = self.brief(comuni_ids=['roma'], obiettivo='conversion', lat=41.9, lng=12.5, raggio_km=1)
        p = recommend([item('near', lat=41.9, lng=12.5), item('far', lat=45.4, lng=9.2), item('unknown')], b, 'OOH', 1)
        self.assertEqual([i['id'] for i in p['items']], ['near'])
        self.assertIn('0.0 km', p['items'][0]['motivi'][-1])

    def test_actual_selection_budget_and_coverage_enforced(self):
        with self.assertRaises(HTTPException):
            check_selection(self.brief(budget=10), [item('r'), item('m', 'milano')], 'OOH', 1)
        with self.assertRaises(HTTPException):
            check_selection(self.brief(), [item('r')], 'OOH', 1)

    def test_currency_rounding_never_exceeds_budget(self):
        b = self.brief(budget=0.3, comuni_ids=['roma'])
        p = recommend([item('a', cost=0.1), item('b', cost=0.2)], b, 'OOH', 1)
        self.assertEqual(p['totale'], 0.3)
        self.assertEqual(p['residuo'], 0)

    def test_bad_dates_and_brief_rejected(self):
        for start, end in [('bad', '2026-10-01'), ('2026-10-03', '2026-10-01')]:
            with self.assertRaises(HTTPException): period_days(start, end)
        for change in [{'budget': float('nan')}, {'budget': -1}, {'lat': 41.9}, {'obiettivo': 'unknown'}]:
            with self.assertRaises(ValidationError): self.brief(**change)

if __name__ == '__main__': unittest.main()
