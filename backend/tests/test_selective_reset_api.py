"""Integration checks against a disposable database; no application data is used."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

async def main():
    os.environ['DB_NAME'] = 'outdoorplanner_selective_test_' + uuid.uuid4().hex
    os.environ['MONGO_URL'] = 'mongodb://127.0.0.1:27017'
    os.environ['JWT_SECRET'] = 'isolated-test-only'
    import httpx
    import server
    db = server.db
    identity = {'id': 'admin', 'ruolo': 'superadmin'}
    async def current(): return identity
    server.app.dependency_overrides[server.get_current_user] = current
    cleared = ['pratiche', 'campagne', 'prenotazioni', 'soggetti', 'creativita', 'log_stato', 'chat', 'occupazioni']
    preserved = ['users', 'comuni', 'zone', 'impianti', 'pacchetti', 'spazi', 'form_templates', 'migrations']
    try:
        for coll in cleared + preserved:
            await db[coll].insert_one({'id': coll})
        await db.notifiche.insert_many([{'id': 'linked', 'pratica_id': 'pratiche'}, {'id': 'general', 'pratica_id': None}])
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='http://test') as api:
            for role in ['user', 'comune']:
                identity['ruolo'] = role
                assert (await api.post('/api/admin/reset-pratiche-campagne', json={'conferma': 'RESET'})).status_code == 403
            identity['ruolo'] = 'superadmin'
            assert (await api.post('/api/admin/reset-pratiche-campagne', json={'conferma': 'wrong'})).status_code == 400
            assert await db.pratiche.count_documents({}) == 1
            assert (await api.post('/api/admin/reset-pratiche-campagne', json={'conferma': 'RESET'})).status_code == 200
            for coll in cleared: assert await db[coll].count_documents({}) == 0, coll
            for coll in preserved: assert await db[coll].count_documents({}) == 1, coll
            assert (await db.notifiche.find_one({}))['id'] == 'general'
            assert (await api.post('/api/admin/reset-pratiche-campagne', json={'conferma': 'RESET'})).status_code == 200
            identity.update(ruolo='comune', comune_id='rome', livello=3)
            await db.form_templates.insert_one({'id': 'edit', 'comune_id': 'rome', 'nome': 'Edit', 'campi': []})
            for required in [True, False]:
                field = {'id': 'same', 'label': 'Renamed', 'required': required, 'scope': 'comune', 'condizione': {'campo': 'other', 'valore': True}}
                response = await api.put('/api/comune/form-templates/edit', json={'nome': 'Edit', 'campi': [field]})
                assert response.status_code == 200, response.text
                saved = (await api.get('/api/comune/form-templates')).json()
                edited = next(t for t in saved if t['id'] == 'edit')['campi'][0]
                assert all(edited[k] == v for k, v in field.items())
        print('PASS: role checks, confirmation, selective deletion, availability reset, configuration preservation, repeatability, persisted field updates')
    finally:
        await server.client.drop_database(os.environ['DB_NAME'])
        server.client.close()
if __name__ == '__main__': asyncio.run(main())
