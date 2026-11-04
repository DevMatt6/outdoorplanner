"""One-time, backed-up reset requested for user@demo.it; preserves the account/catalog."""
import argparse
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path

RESET_ID = 'reset-user-demo-campaigns-2026-11-04-v1'
EMAIL = 'user@demo.it'

async def reset_demo_user(db, apply=False):
    done = await db.migrations.find_one({'_id': RESET_ID})
    if done:
        return {'status': 'already-applied', **done.get('result', {})}
    user = await db.users.find_one({'email': EMAIL}, {'_id': 0, 'id': 1})
    if not user:
        return {'status': 'user-not-found'}
    uid = user['id']
    backup = await db.maintenance_backups.find_one({'_id': RESET_ID})
    if not backup:
        practices = await db.pratiche.find({'user_id': uid}).to_list(None)
        campaigns = await db.campagne.find({'user_id': uid}).to_list(None)
        pids, cids = [p['id'] for p in practices], [c['id'] for c in campaigns]
        booking_ids = [p['prenotazione_id'] for p in practices if p.get('prenotazione_id')]
        queries = {
            'prenotazioni': {'$or': [{'user_id': uid}, {'pratica_id': {'$in': pids}}, {'campagna_id': {'$in': cids}}, {'id': {'$in': booking_ids}}]},
            'log_stato': {'pratica_id': {'$in': pids}},
            'chat': {'pratica_id': {'$in': pids}},
            'notifiche': {'$or': [{'pratica_id': {'$in': pids}}, {'campagna_id': {'$in': cids}}]},
            'soggetti': {'user_id': uid, 'campagna_id': {'$in': cids}},
        }
        rows = {'pratiche': practices, 'campagne': campaigns}
        for name, query in queries.items():
            rows[name] = await db[name].find(query).to_list(None)
        backup = {'_id': RESET_ID, 'user_id': uid, 'created_at': datetime.now(timezone.utc).isoformat(), 'collections': rows}
    result = {name: len(rows) for name, rows in backup['collections'].items()}
    if not apply:
        return {'status': 'preview', **result}
    # Snapshot before removing anything; retry deletes only originally captured records.
    await db.maintenance_backups.update_one({'_id': RESET_ID}, {'$setOnInsert': backup}, upsert=True)
    backup = await db.maintenance_backups.find_one({'_id': RESET_ID})
    result = {name: len(rows) for name, rows in backup['collections'].items()}
    for name, rows in backup['collections'].items():
        if rows:
            await db[name].delete_many({'_id': {'$in': [r['_id'] for r in rows]}})
    await db.migrations.update_one({'_id': RESET_ID}, {'$setOnInsert': {'completed_at': datetime.now(timezone.utc).isoformat(), 'result': result}}, upsert=True)
    return {'status': 'applied', **result}

async def main():
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient
    load_dotenv(Path(__file__).parent / '.env')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL') or os.environ['MONGODB_URI'])
    try:
        print(json.dumps(await reset_demo_user(client[os.environ['DB_NAME']], apply=args.apply), indent=2))
    finally:
        client.close()
if __name__ == '__main__': asyncio.run(main())
