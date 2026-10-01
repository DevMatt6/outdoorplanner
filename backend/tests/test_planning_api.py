"""Integration checks in an isolated, disposable local MongoDB database.
Run: ../.venv/bin/python tests/test_planning_api.py (httpx required only for tests).
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
async def main():
    os.environ['DB_NAME'] = 'outdoorplanner_planning_test_' + uuid.uuid4().hex
    os.environ['MONGO_URL'] = 'mongodb://127.0.0.1:27017'
    os.environ['JWT_SECRET'] = 'isolated-test-secret-never-used-in-production'
    import httpx
    import server
    db = server.db
    user = {'id': 'test-user', 'ruolo': 'user', 'nome': 'Planner test', 'email': 'test@example.invalid'}
    async def current_user(): return user
    server.app.dependency_overrides[server.get_current_user] = current_user
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as api:
        try:
            await db.comuni.insert_many([{'id': city, 'nome': city.title()} for city in ['roma', 'milano']])
            await db.zone.insert_one({'id': 'z', 'nome': 'Centro', 'comune_id': 'roma'})
            await db.impianti.insert_many([{'id': iid, 'comune_id': city, 'codice': iid, 'zona_id': 'z', 'tipologia': 'Manifesto 200x140', 'prezzo': price, 'attivo': True, 'lat': 41.9, 'lng': 12.5, 'giorni_minimi': minimum} for iid, city, price, minimum in [('r','roma',10,1),('m','milano',20,1),('busy','roma',1,1),('long','roma',1,30)]])
            await db.pacchetti.insert_many([{'id': 'p-'+city, 'comune_id': city, 'zona_id': 'z', 'nome': 'Circuito '+city, 'attivo': True, 'impianti_ids': ids} for city, ids in [('roma',['r','busy','long']),('milano',['m'])]])
            await db.prenotazioni.insert_one({'id':'existing','stato':'CONFIRMED','impianti_ids':['busy'],'data_inizio':'2027-01-01','data_fine':'2027-01-31'})
            await db.spazi.insert_many([{'id':'s-'+city,'comune_id':city,'nome':city,'disponibile':True,'canone_giornaliero':10,'lat':41.9,'lng':12.5,'attivita_ammesse':['sampling'],'superficie_mq':50} for city in ['roma','milano']])
            brief={'obiettivo':'awareness','budget':90,'comuni_ids':['roma','milano'],'distribuzione':'tutti'}
            period={'data_inizio':'2027-01-01','data_fine':'2027-01-03'}
            request={'tipo':'OOH','brief':brief,**period}
            r=await api.post('/api/planning/recommend',json=request)
            assert r.status_code==200, r.text
            proposal=r.json(); assert {i['id'] for i in proposal['items']}=={'r','m'}, proposal
            assert proposal['totale']==90
            body={'nome':'Integration OOH',**period,'pacchetti_ids':['p-roma','p-milano'],'impianti_sel':{'p-roma':['r'],'p-milano':['m']},'brief':brief}
            bad=await api.post('/api/ooh/campagne',json={**body,'brief':{**brief,'budget':89}})
            assert bad.status_code==400 and await db.campagne.count_documents({})==0
            assert await db.prenotazioni.count_documents({})==1  # No writes before validation.
            invalid=await api.post('/api/ooh/campagne',json={**body,'impianti_sel':{'p-roma':[],'p-milano':['m']}})
            assert invalid.status_code==400
            created=await api.post('/api/ooh/campagne',json=body)
            assert created.status_code==200, created.text
            campaign=created.json(); assert campaign['brief']['budget']==90 and campaign['importo_totale']==90
            assert {p['stato'] for p in campaign['pratiche']}=={'DA_COMPLETARE'}
            assert {p['stato'] async for p in db.prenotazioni.find({'campagna_id':campaign['id']})}=={'OPTIONED'}
            payment=await api.post('/api/ooh/campagne/'+campaign['id']+'/checkout')
            assert payment.status_code==400  # OOH still pays only after approval.
            unavailable=(await api.post('/api/planning/recommend',json=request)).json()
            assert unavailable['items']==[] and not unavailable['fattibile']
            changed=await api.post('/api/planning/recommend',json={**request,'data_inizio':'2027-02-01','data_fine':'2027-02-03','esclusi':['r']})
            assert changed.status_code==200 and all(i['id']!='r' for i in changed.json()['items'])
            osp_brief={**brief,'budget':60,'attivita':'sampling','superficie_mq':40}
            osp_request={'tipo':'OSP','brief':osp_brief,**period}
            osp=(await api.post('/api/planning/recommend',json=osp_request)).json()
            assert osp['totale']==60 and len(osp['items'])==2, osp
            osp_body={'nome':'Integration OSP',**period,'spazi_ids':['s-roma','s-milano'],'brief':osp_brief}
            rejected=await api.post('/api/campagne',json={**osp_body,'brief':{**osp_brief,'budget':59}})
            assert rejected.status_code==400
            created_osp=await api.post('/api/campagne',json=osp_body)
            assert created_osp.status_code==200, created_osp.text
            oc=created_osp.json(); assert oc['importo_totale']==60 and oc['brief']['attivita']=='sampling'
            assert (await api.post('/api/campagne/'+oc['id']+'/invia')).status_code==400
            assert (await api.post('/api/campagne/'+oc['id']+'/checkout')).status_code==200
            sent=await api.post('/api/campagne/'+oc['id']+'/invia')
            assert sent.status_code==200 and sent.json()['inviate']==2
            occupied=(await api.post('/api/planning/recommend',json=osp_request)).json()
            assert not occupied['fattibile'] and occupied['items']==[]
            bad_period=await api.post('/api/planning/recommend',json={**request,'data_fine':'2026-01-01'})
            assert bad_period.status_code==400
            print('API integration OK: availability, min duration, budget, exclusions, persisted brief, OOH option/payment policy and OSP payment/submission.')
        finally:
            await server.client.drop_database(db.name)
            server.client.close()

if __name__=='__main__': asyncio.run(main())
