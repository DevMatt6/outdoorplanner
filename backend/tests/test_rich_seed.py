"""Rich catalog and high-volume booking regression; disposable local database."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

async def main():
    os.environ['DB_NAME']='outdoorplanner_rich_test_'+uuid.uuid4().hex
    os.environ['MONGO_URL']='mongodb://127.0.0.1:27017'
    os.environ['JWT_SECRET']='isolated-seed-test-secret'
    import httpx
    import server
    from seed_demo import seed_rich_catalog
    db=server.db
    try:
        one=await seed_rich_catalog(db,server.hash_password)
        assert {k:one[k] for k in ['zone','impianti','pacchetti','spazi']}=={'zone':18,'impianti':195,'pacchetti':60,'spazi':108},one
        await db.spazi.update_one({}, {'$set':{'descrizione':'User edit preserved'}})
        two=await seed_rich_catalog(db,server.hash_password)
        assert one==two and await db.spazi.count_documents({'descrizione':'User edit preserved'})==1
        assert await db.pratiche.count_documents({})==0 and await db.prenotazioni.count_documents({})==0
        for city in await db.comuni.find({}, {'_id':0}).to_list(3):
            assert await db.spazi.count_documents({'comune_id':city['id']})==36
            assert await db.impianti.count_documents({'comune_id':city['id']})==65
        user=await db.users.find_one({'email':'user@demo.it'},{'_id':0,'password_hash':0})
        async def current():return user
        server.app.dependency_overrides[server.get_current_user]=current
        cities=await db.comuni.distinct('id')
        brief={'obiettivo':'awareness','budget':10000000,'comuni_ids':cities}
        dates={'data_inizio':'2027-04-01','data_fine':'2027-04-30'}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test') as api:
            p=(await api.post('/api/planning/recommend',json={'tipo':'OSP','brief':brief,**dates})).json()
            assert len(p['items'])==108,p
            created=await api.post('/api/campagne',json={'nome':'Large OSP test','spazi_ids':[i['id'] for i in p['items']],'brief':brief,**dates})
            assert created.status_code==200,created.text
            cid=created.json()['id']
            assert len((await api.get('/api/campagne/'+cid)).json()['pratiche'])==108
            paid=await api.post('/api/campagne/'+cid+'/checkout')
            assert paid.json()['pratiche_pagate']==108
            sent=await api.post('/api/campagne/'+cid+'/invia')
            assert sent.json()['inviate']==108
            p=(await api.post('/api/planning/recommend',json={'tipo':'OOH','brief':brief,**dates})).json()
            assert len(p['items'])==195,p
            grouped={}
            for i in p['items']:grouped.setdefault(i['pacchetto_id'],[]).append(i['id'])
            assert len(grouped)==60
            created=await api.post('/api/ooh/campagne',json={'nome':'Large OOH test','pacchetti_ids':list(grouped),'impianti_sel':grouped,'brief':brief,**dates})
            assert created.status_code==200,created.text
            assert sum(len(p['impianti']) for p in created.json()['pratiche'])==195
        print('Rich seed OK: counts, repeatability, preserved edits, 108 OSP bookings/payment/submission and 195 OOH installations in 60 circuits.')
    finally:
        await server.client.drop_database(db.name)
        server.client.close()

if __name__=='__main__':asyncio.run(main())
