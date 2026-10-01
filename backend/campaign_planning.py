"""Explainable catalog recommendations. Scores express suitability, never predicted reach."""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from math import asin, cos, radians, sin, sqrt
from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator
from fastapi import APIRouter, Depends, HTTPException

AUDIENCES = ['studenti', 'famiglie', 'pendolari', 'turisti']
CONTEXTS = ['centro', 'commerciale', 'stazione', 'universita', 'residenziale']
ACTIVITIES = ['evento', 'sampling', 'stand', 'installazione']

class CatalogPlanning(BaseModel):
    contesti: list[Literal['centro', 'commerciale', 'stazione', 'universita', 'residenziale']] = Field(default_factory=list)
    pubblici: list[Literal['studenti', 'famiglie', 'pendolari', 'turisti']] = Field(default_factory=list)
    attivita_ammesse: list[Literal['evento', 'sampling', 'stand', 'installazione']] = Field(default_factory=list)
    superficie_mq: Optional[float] = Field(default=None, gt=0, allow_inf_nan=False)

class CampaignBrief(BaseModel):
    obiettivo: Literal['awareness', 'engagement', 'conversion']
    budget: float = Field(gt=0, allow_inf_nan=False)
    pubblici: list[Literal['studenti', 'famiglie', 'pendolari', 'turisti']] = Field(default_factory=list)
    contesti: list[Literal['centro', 'commerciale', 'stazione', 'universita', 'residenziale']] = Field(default_factory=list)
    formato: Literal['qualsiasi', 'cartaceo', 'digitale', 'maxi'] = 'qualsiasi'
    distribuzione: Literal['tutti', 'migliore'] = 'tutti'
    comuni_ids: list[str] = Field(default_factory=list, max_length=50)
    punto_vendita: str = ''
    lat: Optional[float] = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    lng: Optional[float] = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    raggio_km: float = Field(default=5, gt=0, le=100, allow_inf_nan=False)
    attivita: Optional[Literal['evento', 'sampling', 'stand', 'installazione']] = None
    superficie_mq: Optional[float] = Field(default=None, gt=0, allow_inf_nan=False)

    @model_validator(mode='after')
    def coordinates(self):
        if (self.lat is None) != (self.lng is None):
            raise ValueError('Inserisci entrambe le coordinate del punto vendita')
        if cents(self.budget) <= 0:
            raise ValueError('Budget minimo 0,01 €')
        self.comuni_ids = list(dict.fromkeys(self.comuni_ids))
        return self

class RecommendationIn(BaseModel):
    tipo: Literal['OOH', 'OSP']
    brief: CampaignBrief
    data_inizio: date
    data_fine: date
    esclusi: list[str] = Field(default_factory=list, max_length=1000)


def cents(value):
    return int((Decimal(str(value)) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def period_cost(price, days):
    return cents(Decimal(str(price)) * days)


def period_days(start, end):
    try:
        days = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    except ValueError:
        raise HTTPException(400, 'Periodo non valido')
    if days <= 0:
        raise HTTPException(400, 'La fine deve essere successiva o uguale all’inizio')
    return days


def format_kind(item):
    category = item.get('categoria')
    text = item.get('tipologia', '').lower()
    if category == 'dooh' or any(x in text for x in ['digitale', 'ledwall', 'schermo']):
        return 'digitale'
    if category == 'maxi' or any(x in text for x in ['poster maxi', 'mega poster']):
        return 'maxi'
    return 'cartaceo'


def distance_km(a, b, c, d):
    p, q = radians(a), radians(c)
    h = sin((q-p)/2)**2 + cos(p)*cos(q)*sin(radians(d-b)/2)**2
    return 6371 * 2 * asin(min(1, sqrt(h)))


def suitability(item, brief, tipo):
    reasons, score = [], 10
    contexts, audiences = set(item.get('contesti', [])), set(item.get('pubblici', []))
    matches = contexts & set(brief.contesti)
    if matches:
        score += 25 * len(matches); reasons.append('Contesto richiesto: ' + ', '.join(sorted(matches)))
    matches = audiences & set(brief.pubblici)
    if matches:
        score += 25 * len(matches); reasons.append('Pubblico indicato nel catalogo: ' + ', '.join(sorted(matches)))
    objective_context = {'awareness': {'centro', 'stazione'}, 'engagement': {'universita', 'commerciale', 'centro'}, 'conversion': {'commerciale', 'residenziale'}}[brief.obiettivo]
    if contexts & objective_context:
        score += 20; reasons.append('Contesto coerente con l’obiettivo')
    if tipo == 'OOH':
        kind = format_kind(item)
        if brief.formato != 'qualsiasi' and kind != brief.formato:
            return None
        if (brief.obiettivo == 'awareness' and kind == 'maxi') or (brief.obiettivo == 'engagement' and kind == 'digitale'):
            score += 15; reasons.append('Formato coerente con l’obiettivo')
    else:
        if brief.attivita:
            if brief.attivita not in item.get('attivita_ammesse', []):
                return None
            score += 20; reasons.append('Attività ammessa: ' + brief.attivita)
        if brief.superficie_mq:
            if (item.get('superficie_mq') or 0) < brief.superficie_mq:
                return None
            reasons.append('Superficie sufficiente: ' + str(item['superficie_mq']) + ' m²')
    if brief.obiettivo == 'conversion' and brief.lat is not None:
        if item.get('lat') is None or item.get('lng') is None:
            return None
        distance = distance_km(brief.lat, brief.lng, item['lat'], item['lng'])
        if distance > brief.raggio_km:
            return None
        score += 30 * (1 - distance / brief.raggio_km)
        reasons.append(f'A {distance:.1f} km dal punto vendita (distanza in linea d’aria)')
    if not reasons:
        reasons.append('Disponibile nel periodo; scelta basata su costo e distribuzione. Dati di affinità non presenti.')
    return score, reasons


def recommend(items, brief, tipo, days, excluded=()):
    candidates = []
    for item in items:
        if item['id'] in excluded or item.get('comune_id') not in brief.comuni_ids or days < (item.get('giorni_minimi') or 1):
            continue
        cost = period_cost(item.get('prezzo' if tipo == 'OOH' else 'canone_giornaliero', 0), days)
        if cost < 0:
            continue
        fit = suitability(item, brief, tipo)
        if fit is not None:
            score, reasons = fit
            candidates.append({**item, 'costo': cost / 100, '_cost': cost, 'punteggio': round(score, 2), 'motivi': reasons})
    budget = cents(brief.budget)
    chosen, warnings = [], []
    if brief.distribuzione == 'tutti':
        # Reserve the cheapest suitable item in each city before allocating the remainder.
        for city in brief.comuni_ids:
            available = [i for i in candidates if i['comune_id'] == city]
            if not available:
                warnings.append('Nessuna disponibilità compatibile per il comune ' + city)
            else:
                chosen.append(min(available, key=lambda i: (i['_cost'], -i['punteggio'], i['id'])))
        minimum = sum(i['_cost'] for i in chosen)
        if warnings or minimum > budget:
            if minimum > budget:
                warnings.append(f'Per coprire tutti i comuni servono almeno {minimum/100:.2f} € nel periodo selezionato.')
            return {'items': [], 'totale': 0, 'residuo': budget/100, 'per_comune': {}, 'avvisi': warnings, 'fattibile': False}
    if any(not i.get('contesti') or (brief.pubblici and not i.get('pubblici')) for i in candidates):
        warnings.append('Alcuni elementi del catalogo non hanno dati completi su contesti o pubblico: il suggerimento usa soltanto le caratteristiche note.')
    spent = sum(i['_cost'] for i in chosen)
    while True:
        ids = {i['id'] for i in chosen}
        available = [i for i in candidates if i['id'] not in ids and spent + i['_cost'] <= budget]
        if not available:
            break
        def utility(i):
            diversity = 15 if brief.obiettivo == 'awareness' and not any(x.get('zona_id') == i.get('zona_id') and x['comune_id'] == i['comune_id'] for x in chosen) else 0
            return ((i['punteggio'] + diversity) / max(i['_cost'], 1), i['punteggio'], -i['_cost'], i['id'])
        winner = max(available, key=utility)
        chosen.append(winner); spent += winner['_cost']
    if not chosen:
        warnings.append('Nessuno spazio compatibile con budget, periodo e requisiti. Amplia il budget o modifica i criteri.')
    if tipo == 'OSP' and (brief.attivita or brief.superficie_mq):
        warnings.append('Le aree prive di dati su attività o superficie sono escluse quando questi requisiti sono richiesti.')
    if brief.obiettivo == 'conversion' and brief.lat is None:
        warnings.append('Senza coordinate del punto vendita non viene valutata la vicinanza geografica.')
    by_city = {}
    for i in chosen:
        by_city[i['comune_id']] = round(by_city.get(i['comune_id'], 0) + i['costo'], 2)
    return {'items': [{k: v for k, v in i.items() if k != '_cost'} for i in chosen], 'totale': spent/100, 'residuo': (budget-spent)/100, 'per_comune': by_city, 'avvisi': warnings, 'fattibile': bool(chosen)}


def check_selection(brief, items, tipo, days):
    if brief is None:
        return  # Compatibility with existing integrations.
    unique = {i['id']: i for i in items}.values()
    total = sum(period_cost(i.get('prezzo' if tipo == 'OOH' else 'canone_giornaliero', 0), days) for i in unique)
    if total > cents(brief.budget):
        raise HTTPException(400, f'Selezione oltre il budget: {total/100:.2f} €')
    cities = {i['comune_id'] for i in items}
    if not cities <= set(brief.comuni_ids):
        raise HTTPException(400, 'Selezione fuori dai comuni richiesti')
    if brief.distribuzione == 'tutti' and cities != set(brief.comuni_ids):
        raise HTTPException(400, 'Seleziona almeno uno spazio in ciascun comune richiesto')
    for item in items:
        if days < (item.get('giorni_minimi') or 1):
            raise HTTPException(400, 'Durata inferiore al minimo richiesto')
        if suitability(item, brief, tipo) is None:
            raise HTTPException(400, 'Uno spazio selezionato non rispetta formato, attività, superficie o raggio richiesti')


def build_planning(require_role, available_osp, available_ooh):
    router = APIRouter()
    @router.post('/planning/recommend')
    async def recommendation(data: RecommendationIn, user=Depends(require_role('user'))):
        start, end = data.data_inizio.isoformat(), data.data_fine.isoformat()
        days = period_days(start, end)
        if not data.brief.comuni_ids:
            raise HTTPException(400, 'Seleziona almeno un comune')
        if data.tipo == 'OSP':
            items = await available_osp(start, end)
        else:
            packages = await available_ooh(data_inizio=start, data_fine=end)
            items, seen = [], set()
            for p in packages:
                for i in p['impianti']:
                    if i['id'] not in seen and not i['occupato'] and i.get('attivo', True):
                        seen.add(i['id'])
                        items.append({**i, 'pacchetto_id': p['id'], 'circuito_nome': p['nome'], 'zona_nome': p['zona_nome'], 'comune_id': p['comune_id']})
        return recommend(items, data.brief, data.tipo, days, data.esclusi)
    return router
