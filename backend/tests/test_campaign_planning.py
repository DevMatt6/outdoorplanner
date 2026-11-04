import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from pydantic import ValidationError
from campaign_planning import CampaignBrief, OSPCampaignBrief, CatalogPlanning, check_selection, period_days, recommend


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

class OSPBudgetOnlyTests(unittest.TestCase):
    def test_budget_only_osp_is_accepted_without_an_objective(self):
        brief = OSPCampaignBrief(budget=90, comuni_ids=['roma', 'milano'])
        self.assertIsNone(brief.obiettivo)
        check_selection(brief, [item('r', cost=10), item('m', 'milano', cost=20)], 'OSP', 3)

    def test_osp_still_enforces_budget_municipalities_and_minimum_duration(self):
        cases = [
            (OSPCampaignBrief(budget=89, comuni_ids=['roma', 'milano']), [item('r', cost=10), item('m', 'milano', cost=20)], 3),
            (OSPCampaignBrief(budget=100, comuni_ids=['roma', 'milano']), [item('r')], 1),
            (OSPCampaignBrief(budget=100, comuni_ids=['roma']), [item('m', 'milano')], 1),
            (OSPCampaignBrief(budget=100, comuni_ids=['roma']), [item('r', giorni_minimi=5)], 3),
        ]
        for brief, spaces, days in cases:
            with self.assertRaises(HTTPException): check_selection(brief, spaces, 'OSP', days)

    def test_ooh_still_requires_a_valid_objective(self):
        with self.assertRaises(ValidationError): CampaignBrief(budget=100, comuni_ids=['roma'])
        with self.assertRaises(ValidationError): CampaignBrief(obiettivo=None, budget=100)

class OSPCapacityTests(unittest.TestCase):
    def test_capacity_and_attendance_are_positive_integers(self):
        for value in [0, -1, 2.5, '20', True]:
            with self.assertRaises(ValidationError): CatalogPlanning(capienza=value)
            with self.assertRaises(ValidationError): OSPCampaignBrief(budget=100, persone_previste=value)
        self.assertEqual(CatalogPlanning(capienza=100, superficie_mq=55.5).capienza, 100)

    def test_selection_enforces_declared_capacity_and_rejects_unknown(self):
        brief = OSPCampaignBrief(budget=100, comuni_ids=['roma'], persone_previste=50)
        check_selection(brief, [item('yes', capienza=50)], 'OSP', 1)
        for extra in [{}, {'capienza': None}, {'capienza': 49}]:
            with self.assertRaises(HTTPException): check_selection(brief, [item('no', **extra)], 'OSP', 1)

    def test_legacy_osp_without_attendance_remains_compatible(self):
        check_selection(OSPCampaignBrief(budget=100, comuni_ids=['roma']), [item('legacy')], 'OSP', 1)

if __name__ == '__main__': unittest.main()
