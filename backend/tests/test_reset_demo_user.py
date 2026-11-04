"""Exercise the reset against a disposable local database, including other-user isolation."""
import asyncio
import sys
import uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from motor.motor_asyncio import AsyncIOMotorClient
from reset_demo_user import reset_demo_user, RESET_ID
async def main():
    client=AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    name='outdoorplanner_reset_test_'+uuid.uuid4().hex
    db=client[name]
    try:
        await db.users.insert_many([{'id':'target','email':'user@demo.it'},{'id':'other','email':'other@example.invalid'}])
        for collection in ['pratiche','campagne']:
            await db[collection].insert_many([{'id':'target-'+collection,'user_id':'target'},{'id':'other-'+collection,'user_id':'other'}])
        for collection in ['prenotazioni','soggetti']:
            await db[collection].insert_many([{'id':'target-'+collection,'user_id':'target','campagna_id':'target-campagne'},{'id':'other-'+collection,'user_id':'other','campagna_id':'other-campagne'}])
        for collection in ['chat','log_stato','notifiche']:
            await db[collection].insert_many([{'id':'target-'+collection,'pratica_id':'target-pratiche'},{'id':'other-'+collection,'pratica_id':'other-pratiche'}])
        await db.spazi.insert_one({'id':'catalog'})
        preview=await reset_demo_user(db)
        assert preview['pratiche']==1 and preview['campagne']==1
        assert await db.pratiche.count_documents({})==2
        result=await reset_demo_user(db,apply=True)
        assert result['status']=='applied'
        for collection in ['pratiche','campagne','prenotazioni','soggetti','chat','log_stato','notifiche']:
            rows=await db[collection].find({}).to_list(None)
            assert len(rows)==1 and rows[0]['id'].startswith('other-'),(collection,rows)
        assert await db.users.count_documents({})==2 and await db.spazi.count_documents({})==1
        backup=await db.maintenance_backups.find_one({'_id':RESET_ID})
        assert all(len(rows)==1 for rows in backup['collections'].values())
        await db.pratiche.insert_one({'id':'new','user_id':'target'})
        assert (await reset_demo_user(db,apply=True))['status']=='already-applied'
        assert await db.pratiche.count_documents({'user_id':'target'})==1
        print('PASS: reset preview, scoped removal, related reservations, backup, account/catalog preservation and new work survives restart')
    finally:
        await client.drop_database(name)
        client.close()
if __name__=='__main__': asyncio.run(main())
