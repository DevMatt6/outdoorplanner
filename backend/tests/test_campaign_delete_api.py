"""Check draft campaign deletion on an isolated temporary database."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
async def main():
    os.environ.update(DB_NAME='campaign_delete_test_'+uuid.uuid4().hex, MONGO_URL='mongodb://127.0.0.1:27017', JWT_SECRET='isolated-only')
    import httpx
    import server
    db = server.db
    identity = {'id': 'owner', 'ruolo': 'user'}
    async def current(): return identity
    server.app.dependency_overrides[server.get_current_user] = current
    try:
        await db.campagne.insert_many([{'id': 'osp', 'user_id': 'owner'}, {'id': 'ooh', 'tipo': 'OOH', 'stato': 'IN_COMPLETAMENTO', 'user_id': 'owner'}, {'id': 'other', 'user_id': 'someone'}, {'id': 'submitted', 'user_id': 'owner'}, {'id': 'paid', 'user_id': 'owner'}])
        await db.pratiche.insert_many([{'id': 'p1', 'campagna_id': 'osp', 'stato': 'BOZZA'}, {'id': 'p2', 'campagna_id': 'ooh', 'stato': 'DA_COMPLETARE'}, {'id': 'p3', 'campagna_id': 'submitted', 'stato': 'INVIATA'}, {'id': 'p4', 'campagna_id': 'paid', 'stato': 'BOZZA', 'pagata': True}])
        for coll in ['prenotazioni', 'soggetti', 'creativita', 'log_stato', 'chat', 'notifiche']:
            await db[coll].insert_many([{'id': 'linked', 'campagna_id': 'ooh', 'pratica_id': 'p2'}, {'id': 'keep', 'campagna_id': 'other'}])
        await db.impianti.insert_one({'id': 'catalog'})
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as api:
            for id, expected in [('other',404), ('missing',404), ('submitted',400), ('paid',400), ('osp',200), ('ooh',200)]:
                r = await api.delete('/api/campagne/'+id)
                assert r.status_code == expected, r.text
            for coll in ['prenotazioni', 'soggetti', 'creativita', 'log_stato', 'chat', 'notifiche']:
                assert await db[coll].count_documents({}) == 1, coll
            assert await db.pratiche.count_documents({}) == 2
            assert await db.impianti.count_documents({}) == 1
            identity['ruolo'] = 'comune'
            assert (await api.delete('/api/campagne/other')).status_code == 403
        print('PASS: OSP/OOH draft deletion, ownership, payment/status guards, related data cleanup and catalog preservation')
    finally:
        await server.client.drop_database(os.environ['DB_NAME'])
        server.client.close()
if __name__ == '__main__': asyncio.run(main())
