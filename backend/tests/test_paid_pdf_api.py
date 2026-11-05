"""Verify paid-only PDF issuance for OOH/OSP and municipality ownership."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
async def main():
    os.environ.update(DB_NAME='paid_pdf_test_'+uuid.uuid4().hex,MONGO_URL='mongodb://127.0.0.1:27017',JWT_SECRET='isolated-only')
    import server
    import httpx
    db=server.db
    user={'id':'owner','nome':'Test','ruolo':'user'}
    async def current():return user
    server.app.dependency_overrides[server.get_current_user]=current
    try:
        await db.comuni.insert_one({'id':'rome','nome':'Roma'})
        await db.spazi.insert_one({'id':'osp-space','nome':'Piazza','indirizzo':'Roma','tipologia':'OSP'})
        for tipo in ['OOH','OSP']:
            await db.pratiche.insert_one({'id':tipo,'tipo':tipo,'user_id':'owner','user_nome':'Test','comune_id':'rome','spazio_id':'osp-space' if tipo=='OSP' else 'circuit-id','stato':'APPROVATA','pagata':False,'importo':10,'spazio_nome':'Test','zona_nome':'Centro','data_inizio':'2027-01-01','data_fine':'2027-01-02','prenotazione_id':'pren'})
        await db.prenotazioni.insert_one({'id':'pren','stato':'OPTIONED'})
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test') as api:
            for tipo in ['OOH','OSP']:
                assert (await api.get('/api/pratiche/'+tipo+'/autorizzazione')).status_code==403
            r=await api.post('/api/ooh/pratiche/OOH/paga');assert r.status_code==200,r.text
            await db.pratiche.update_one({'id':'OSP'},{'$set':{'pagata':True}})
            for tipo in ['OOH','OSP']:
                r=await api.get('/api/pratiche/'+tipo+'/autorizzazione')
                assert r.status_code==200 and r.content.startswith(b'%PDF'),r.text
                user.update(ruolo='comune',comune_id='other')
                assert (await api.get('/api/pratiche/'+tipo+'/autorizzazione')).status_code==403
                user.update(comune_id='rome')
                assert (await api.get('/api/pratiche/'+tipo+'/autorizzazione')).status_code==200
                user.update(ruolo='user')
        print('PASS: PDF unavailable before payment, OOH checkout unlocks real PDF, paid OSP PDF, municipality isolation')
    finally:
        await server.client.drop_database(os.environ['DB_NAME']);server.client.close()
if __name__=='__main__':asyncio.run(main())
