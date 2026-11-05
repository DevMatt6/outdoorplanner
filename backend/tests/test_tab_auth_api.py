"""Explicit per-tab tokens must take precedence over shared browser cookies."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
async def main():
    os.environ.update(DB_NAME='tab_auth_test_'+uuid.uuid4().hex,MONGO_URL='mongodb://127.0.0.1:27017',JWT_SECRET='isolated-only')
    import server
    import httpx
    db=server.db
    try:
        tokens={}
        for role in ['user','comune','superadmin']:
            await db.users.insert_one({'id':role,'email':role+'@example.invalid','nome':role,'ruolo':role})
            tokens[role]=server.create_access_token(role,role+'@example.invalid',role)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test',cookies={'access_token':tokens['user']}) as api:
            for role,token in tokens.items():
                r=await api.get('/api/auth/me',headers={'Authorization':'Bearer '+token})
                assert r.status_code==200 and r.json()['ruolo']==role,r.text
            assert (await api.get('/api/auth/me')).json()['ruolo']=='user'
            assert (await api.get('/api/auth/me',headers={'Authorization':'Bearer invalid'})).status_code==401
        print('PASS: independent role tokens with a shared cookie, cookie fallback and invalid-token rejection')
    finally:
        await server.client.drop_database(os.environ['DB_NAME']);server.client.close()
if __name__=='__main__':asyncio.run(main())
