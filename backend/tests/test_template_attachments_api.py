"""Template models: isolated upload, download, permissions and persistent editing."""
import asyncio
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
async def main():
    os.environ.update(DB_NAME='model_files_test_'+uuid.uuid4().hex, MONGO_URL='mongodb://127.0.0.1:27017', JWT_SECRET='isolated-only')
    import httpx
    import server
    from rome_osp_form import install, SCHEMA
    db=server.db
    user={'id':'test','ruolo':'comune','comune_id':'rome','livello':3}
    async def current(): return user
    server.app.dependency_overrides[server.get_current_user]=current
    try:
        await db.comuni.insert_one({'id':'rome','livelli_attivi':[1,2,3]})
        await db.migrations.insert_one({'_id':SCHEMA})
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test') as api:
            endpoint='/api/comune/form-templates/upload-allegato'
            for role, level in [('user',3),('comune',1)]:
                user.update(ruolo=role,livello=level)
                assert (await api.post(endpoint,files={'file':('test.pdf',b'%PDF-test','application/pdf')})).status_code==403
            user.update(ruolo='comune',livello=3)
            assert (await api.post(endpoint,files={'file':('bad.html',b'html','text/html')})).status_code==400
            assert (await api.post(endpoint,files={'file':('empty.pdf',b'','application/pdf')})).status_code==400
            response=await api.post(endpoint,files={'file':('../../model.pdf',b'%PDF-model','application/pdf')})
            assert response.status_code==200,response.text
            upload=response.json(); assert upload['url'].startswith('/api/uploads/modelli/rome/')
            assert (await api.get(upload['url'])).content==b'%PDF-model'
            doc={'id':'piano_emergenza','label':'Piano','required':True,'fonte_url':upload['url'],'fonte_nome':upload['nome']}
            field={'id':'campo','label':'Campo','fonte_url':upload['url']}
            created=await api.post('/api/comune/form-templates',json={'nome':'Test','campi':[field],'documenti_richiesti':[doc]})
            assert created.status_code==200,created.text
            tid=created.json()['id']
            await db.form_templates.update_one({'id':tid},{'$set':{'schema_key':SCHEMA}})
            await install(db)
            assert (await db.form_templates.find_one({'id':tid}))['documenti_richiesti'][0]['fonte_url']==upload['url']
            for url in ['https://example.org/replaced.pdf','']:
                doc.update(fonte_url=url,fonte_nome='')
                r=await api.put('/api/comune/form-templates/'+tid,json={'nome':'Test','campi':[field],'documenti_richiesti':[doc]})
                assert r.status_code==200,r.text
                saved=next(t for t in (await api.get('/api/comune/form-templates')).json() if t['id']==tid)
                assert saved['documenti_richiesti'][0]['fonte_url']==url
                assert saved['campi'][0]['fonte_url']==upload['url']
        print('PASS: attachment upload/download, role checks, invalid files, creation, replacement/removal, persistence and restart preservation')
    finally:
        await server.client.drop_database(os.environ['DB_NAME']); server.client.close()
if __name__=='__main__': asyncio.run(main())
