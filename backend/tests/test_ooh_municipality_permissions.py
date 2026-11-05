"""Verify all municipality levels can process OOH, while OSP rules stay intact."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
async def main():
    os.environ.update(DB_NAME='ooh_permissions_test_'+uuid.uuid4().hex,MONGO_URL='mongodb://127.0.0.1:27017',JWT_SECRET='isolated-only')
    import server
    import httpx
    db=server.db
    user={'id':'op','nome':'Operator','ruolo':'comune','comune_id':'rome','livello':1}
    async def current():return user
    server.app.dependency_overrides[server.get_current_user]=current
    try:
        await db.comuni.insert_one({'id':'rome','livelli_attivi':[1,2,3]})
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test') as api:
            for tipo in ['OOH','OSP']:
                for level in [1,2,3]:
                    user['livello']=level
                    for action in ['approva','rifiuta','richiedi_integrazione','annulla']:
                        id=uuid.uuid4().hex
                        state='IN_VERIFICA' if tipo=='OOH' else 'IN_ISTRUTTORIA'
                        await db.pratiche.insert_one({'id':id,'tipo':tipo,'comune_id':'rome','user_id':'advertiser','stato':state,'spazio_nome':'Test','pagata':False})
                        expected=200 if tipo=='OOH' or level>=({'approva':3,'rifiuta':2,'annulla':2,'richiedi_integrazione':1}[action]) else 403
                        r=await api.post('/api/comune/pratiche/'+id+'/transizione',json={'azione':action,'nota':'Motivazione test'})
                        assert r.status_code==expected,(tipo,level,action,r.text)
                        if action=='approva' and expected==200 and tipo=='OOH': assert (await db.pratiche.find_one({'id':id})).get('payment_due_at')
            await db.pratiche.insert_one({'id':'foreign','tipo':'OOH','comune_id':'other','stato':'IN_VERIFICA'})
            assert (await api.post('/api/comune/pratiche/foreign/transizione',json={'azione':'approva'})).status_code==404
        print('PASS: all OOH levels/actions, unchanged OSP restrictions, payment deadline and cross-municipality protection')
    finally:
        await server.client.drop_database(os.environ['DB_NAME']);server.client.close()
if __name__=='__main__':asyncio.run(main())
