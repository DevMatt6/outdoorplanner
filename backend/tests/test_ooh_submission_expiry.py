"""Exercise creation, submission deadlines, release and post-submission protection on an isolated DB."""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
async def main():
    os.environ.update(DB_NAME='ooh_expiry_test_'+uuid.uuid4().hex, MONGO_URL='mongodb://127.0.0.1:27017', JWT_SECRET='isolated-only')
    import httpx
    import server
    db=server.db
    user={'id':'test','ruolo':'user','nome':'Test','email':'test@example.invalid'}
    async def current(): return user
    server.app.dependency_overrides[server.get_current_user]=current
    past=(datetime.now(timezone.utc)-timedelta(hours=25)).isoformat()
    future=(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()
    try:
        await db.comuni.insert_one({'id':'rome','nome':'Roma'})
        await db.zone.insert_one({'id':'z','nome':'Centro','comune_id':'rome'})
        await db.impianti.insert_one({'id':'i','comune_id':'rome','zona_id':'z','codice':'I','tipologia':'Manifesto 200x140','attivo':True,'prezzo':10,'lat':41.9,'lng':12.5})
        await db.pacchetti.insert_one({'id':'pac','nome':'Centro','zona_id':'z','comune_id':'rome','attivo':True,'impianti_ids':['i']})
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='http://test') as api:
            body={'nome':'Deadline','data_inizio':'2027-01-01','data_fine':'2027-01-02','pacchetti_ids':['pac'],'impianti_sel':{'pac':['i']}}
            r=await api.post('/api/ooh/campagne',json=body); assert r.status_code==200,r.text
            campaign=r.json(); cid=campaign['id']; p=campaign['pratiche'][0]
            delta=datetime.fromisoformat(campaign['submission_due_at'])-datetime.fromisoformat((await db.prenotazioni.find_one({'campagna_id':cid}))['hold_created_at'])
            assert delta==timedelta(hours=24)
            assert await server.expire_holds()==0
            await db.prenotazioni.update_many({'campagna_id':cid},{'$set':{'hold_expires_at':past}})
            r=await api.get('/api/ooh/pacchetti',params={'comune_id':'rome','data_inizio':body['data_inizio'],'data_fine':body['data_fine']})
            assert r.json()[0]['impianti_liberi']==1
            assert (await db.pratiche.find_one({'id':p['id']}))['stato']=='PRENOTAZIONE_SCADUTA'
            assert (await db.campagne.find_one({'id':cid}))['stato']=='SCADUTA'
            assert (await api.post('/api/ooh/campagne/'+cid+'/invia')).status_code==400
            notices=await db.notifiche.count_documents({})
            assert await server.expire_holds()==0 and await db.notifiche.count_documents({})==notices
            # A pre-existing draft without a deadline also expires from its original creation time.
            await db.campagne.insert_one({'id':'legacy','nome':'Legacy','user_id':'test','stato':'IN_COMPLETAMENTO'})
            await db.prenotazioni.insert_one({'id':'legacy','campagna_id':'legacy','stato':'OPTIONED','hold_created_at':past})
            await db.pratiche.insert_one({'id':'legacy','campagna_id':'legacy','prenotazione_id':'legacy','stato':'DA_COMPLETARE','created_at':past})
            assert await server.expire_holds()==1
            # Submit a fresh complete campaign, then ensure the initial deadline cannot expire it.
            r=await api.post('/api/ooh/campagne',json=body); assert r.status_code==200,r.text
            fresh=r.json(); pid=fresh['pratiche'][0]['id']; pren=fresh['pratiche'][0]['prenotazione_id']
            await db.pratiche.update_one({'id':pid},{'$set':{'creativita':[{'impianto_id':'i'}]}})
            r=await api.post('/api/ooh/campagne/'+fresh['id']+'/invia'); assert r.status_code==200,r.text
            assert 'hold_expires_at' not in await db.prenotazioni.find_one({'id':pren})
            await db.prenotazioni.update_one({'id':pren},{'$set':{'hold_expires_at':past}})
            assert await server.expire_holds()==0
            assert (await db.pratiche.find_one({'id':pid}))['stato']=='INVIATA'
            # The separate post-approval payment deadline still releases unpaid bookings.
            await db.pratiche.update_one({'id':pid},{'$set':{'stato':'APPROVATA','payment_due_at':past,'pagata':False}})
            assert await server.expire_holds()==1
            assert (await db.pratiche.find_one({'id':pid}))['stato']=='PAGAMENTO_SCADUTO'
            assert (await db.prenotazioni.find_one({'id':pren}))['stato']=='CANCELLED'
        print('PASS: 24h creation deadline, expiry/release, blocked late send, repeatability, legacy drafts, submitted protection and independent payment expiry')
    finally:
        await server.client.drop_database(os.environ['DB_NAME']); server.client.close()
if __name__=='__main__': asyncio.run(main())
