"""Isolated API/migration regression; never uses the application's database."""
import asyncio
import copy
import logging
import os
import sys
import uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
async def main():
    os.environ['DB_NAME']='outdoorplanner_osp_form_test_'+uuid.uuid4().hex
    os.environ['MONGO_URL']='mongodb://127.0.0.1:27017'
    os.environ['JWT_SECRET']='isolated-only'
    import httpx
    import server
    from rome_osp_form import install, SCHEMA, condition
    logging.disable(logging.INFO)
    db=server.db
    user={'id':'test','ruolo':'user','nome':'Mario Test','email':'test@example.invalid','tipo_soggetto':'Privato','pec':'test@pec.invalid','codice_fiscale':'TEST','telefono':'123'}
    async def current(): return user
    server.app.dependency_overrides[server.get_current_user]=current
    # Avoid persistent upload artifacts in integration tests; exercise real API metadata/validation.
    uploads={}
    class Storage:
        async def save(self,key,content): uploads[key]=content
    server.upload_storage=Storage()
    try:
        await db.comuni.insert_one({'id':'rome','nome':'Roma'})
        await db.users.insert_one(user)
        await db.form_templates.insert_one({'id':'old','comune_id':'rome','tipo':'OSP','nome':'Old','campi':[]})
        await db.spazi.insert_many([{'id':id,'comune_id':'rome','nome':id,'tipologia':'Progetto Speciale','canone_giornaliero':10,'superficie_mq':100,'capienza':100,'indirizzo':'Roma','disponibile':True,'form_template_id':'old'} for id in ['a','b']])
        historical={'id':'historical','tipo':'OSP','spazio_id':'a','comune_id':'rome','user_id':'test','stato':'INVIATA','dati_form':{'old':'retained'},'documenti':[]}
        await db.pratiche.insert_one(copy.deepcopy(historical))
        draft={**historical,'id':'draft','stato':'BOZZA','data_inizio':'2027-01-01','data_fine':'2027-01-03'}
        await db.pratiche.insert_one(copy.deepcopy(draft))
        await install(db)
        assert (await db.pratiche.find_one({'id':'historical'},{'_id':0}))==historical
        assert (await db.pratiche.find_one({'id':'draft'}))['form_template_snapshot']['schema_key']==SCHEMA
        assert (await db.seed_backups.find_one({'_id':SCHEMA}))['bozze'][0]['dati_form']=={'old':'retained'}
        await install(db)
        assert await db.form_templates.count_documents({'schema_key':SCHEMA})==1
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test') as api:
            period={'data_inizio':'2027-02-01','data_fine':'2027-02-03'}
            response=await api.post('/api/campagne',json={'nome':'Manifestazione test',**period,'spazi_ids':['a','b'],'brief':{'budget':100,'persone_previste':50,'comuni_ids':['rome']}})
            assert response.status_code==200,response.text
            campaign=response.json(); cid=campaign['id']; pratiche=campaign['pratiche']
            assert all(p['dati_form']['nome']=='Mario Test' and p['dati_form']['persone_previste']==50 for p in pratiche)
            assert all(p['form_template_snapshot']['schema_key']==SCHEMA for p in pratiche)
            for p in pratiche:
                values=p['dati_form'].copy()
                for f in p['form_template_snapshot']['campi']:
                    if values.get(f['id']) not in (None,''): continue
                    if f['tipo']=='checkbox': values[f['id']]=f['required']
                    elif f['tipo']=='select': values[f['id']]=f['opzioni'][0]
                    elif f['tipo']=='number': values[f['id']]=0 if f.get('min',1)==0 else 10
                    elif f['tipo']=='date': values[f['id']]='2000-01-01'
                    else: values[f['id']]='Test'
                values['nome']='Forged name'
                r=await api.put('/api/campagne/'+cid+'/dati-form',json={'pratica_ids':[p['id']],'dati_form':values})
                assert r.status_code==200,r.text
                saved=await db.pratiche.find_one({'id':p['id']})
                assert saved['dati_form']['nome']=='Mario Test'
                p['dati_form']=saved['dati_form']
            assert (await api.post('/api/campagne/'+cid+'/checkout')).status_code==200
            r=await api.post('/api/campagne/'+cid+'/invia')
            assert r.status_code==400 and await db.pratiche.count_documents({'campagna_id':cid,'stato':'INVIATA'})==0
            for i,p in enumerate(pratiche):
                for doc in p['form_template_snapshot']['documenti_richiesti']:
                    if doc['required'] and condition(doc.get('condizione'),p['dati_form']):
                        if doc['id']=='doc_identita':
                            invalid=await api.post(f'/api/pratiche/{p["id"]}/documenti?tipo=doc_identita',files={'file':('bad.exe',b'bad')})
                            assert invalid.status_code==400
                        r=await api.post(f'/api/pratiche/{p["id"]}/documenti?tipo={doc["id"]}',files={'file':('test.pdf',b'%PDF-test','application/pdf')})
                        assert r.status_code==200,r.text
                if i==0:
                    r=await api.post('/api/campagne/'+cid+'/invia')
                    assert r.status_code==400 and pratiche[1]['spazio_nome'] in r.text
                    assert await db.pratiche.count_documents({'campagna_id':cid,'stato':'INVIATA'})==0
            r=await api.post('/api/campagne/'+cid+'/invia')
            assert r.status_code==200 and r.json()['inviate']==2,r.text
            fetched=(await api.get('/api/campagne/'+cid)).json()
            assert all(p['comune_nome']=='Roma' and p['dati_form']['nome']=='Mario Test' for p in fetched['pratiche'])
            print('PASS: scoped migration, history preserved, prefills, protected profile, per-area uploads, invalid formats, and all-or-nothing submission')
    finally:
        await server.client.drop_database(os.environ['DB_NAME'])
        server.client.close()
if __name__=='__main__': asyncio.run(main())
