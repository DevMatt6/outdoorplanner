"""Scoped Rome OSP replacement checks; uses only a disposable local database."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

async def main():
    os.environ['DB_NAME'] = 'outdoorplanner_rome_seed_test_' + uuid.uuid4().hex
    os.environ['MONGO_URL'] = 'mongodb://127.0.0.1:27017'
    os.environ['JWT_SECRET'] = 'isolated-rome-seed-test'
    import httpx
    import server
    from seed_rome_osp import seed_rome_osp, DATA, MIGRATION_ID, venue_id
    db = server.db
    user = {'id': 'test-user', 'nome': 'Test', 'ruolo': 'user'}
    async def current(): return user
    server.app.dependency_overrides[server.get_current_user] = current
    try:
        await db.comuni.insert_many([{'id':'roma','nome':'Roma','regione':'Lazio'}, {'id':'napoli','nome':'Napoli','regione':'Campania'}])
        await db.form_templates.insert_one({'id':'tpl','comune_id':'roma','tipo':'OSP','campi':[],'documenti_richiesti':[]})
        def old(id, city='roma', tipo='Progetto Speciale'):
            return {'id':id,'nome':id,'comune_id':city,'citta':city.title(),'tipologia':tipo,'disponibile':True,'canone_giornaliero':100,'indirizzo':'Test','lat':41.9,'lng':12.5}
        await db.spazi.insert_many([old('practice-ref'),old('campaign-ref'),old('unreferenced'),old('other-city','napoli'),old('legacy-ooh',tipo='Poster Standard')])
        await db.pratiche.insert_one({'id':'p','user_id':'test-user','comune_id':'roma','spazio_id':'practice-ref','stato':'BOZZA'})
        await db.campagne.insert_one({'id':'c','spazi_ids':['campaign-ref']})
        preview = await seed_rome_osp(db, apply=False)
        assert preview['archive_referenced'] == 2 and preview['remove_unreferenced'] == 1
        assert await db.spazi.count_documents({}) == 5
        result = await seed_rome_osp(db)
        active = await db.spazi.find({'comune_id':'roma','tipologia':'Progetto Speciale','archiviato':{'$ne':True}}, {'_id':0}).to_list(10)
        assert len(active)==5 and {s['nome'] for s in active} == {r['nome'] for r in DATA}
        assert all(2000<=s['canone_giornaliero']<=5000 and s['capienza']>0 and s['superficie_mq']>0 for s in active)
        assert all(s['foto_fonte_url'].startswith('https://commons.wikimedia.org/') and s['foto_autore'] for s in active)
        assert await db.spazi.find_one({'id':'unreferenced'}) is None
        for id in ['practice-ref','campaign-ref']:
            assert (await db.spazi.find_one({'id':id}))['archiviato'] is True
        assert (await db.spazi.find_one({'id':'other-city'}))['disponibile'] is True
        assert (await db.spazi.find_one({'id':'legacy-ooh'}))['disponibile'] is True
        assert len((await db.seed_backups.find_one({'_id':MIGRATION_ID}))['spazi'])==3
        assert (await db.pratiche.find_one({'id':'p'}))['spazio_id']=='practice-ref'
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test') as api:
            public=await api.get('/api/spazi',params={'citta':'Roma','tipologia':'Progetto Speciale'})
            assert public.status_code==200 and len(public.json())==5
            avail=await api.get('/api/spazi/disponibili',params={'citta':'Roma','tipologia':'Progetto Speciale','data_inizio':'2027-05-01','data_fine':'2027-05-03'})
            assert avail.status_code==200 and len(avail.json())==5
            assert (await api.get('/api/spazi/practice-ref')).status_code==200
            rejected=await api.post('/api/pratiche',json={'spazio_id':'practice-ref','data_inizio':'2027-05-01','data_fine':'2027-05-03'})
            assert rejected.status_code==409
            user.update({'ruolo':'comune','comune_id':'roma','livello':3})
            listing=await api.get('/api/comune/spazi')
            assert listing.status_code==200 and len(listing.json())==5
        first_id=venue_id(DATA[0]['slug'])
        await db.spazi.update_one({'id':first_id},{'$set':{'canone_giornaliero':2700}})
        assert (await seed_rome_osp(db))['status']=='already-applied'
        assert (await db.spazi.find_one({'id':first_id}))['canone_giornaliero']==2700
        assert await db.pratiche.count_documents({})==1 and await db.campagne.count_documents({})==1
        print('Rome OSP seed OK: five areas, safe scoped replacement, backup, historical references, catalog/API filtering and idempotency.')
    finally:
        await server.client.drop_database(db.name)
        server.client.close()

if __name__=='__main__': asyncio.run(main())
