"""Replace only Rome's OSP catalog; preserve referenced records and a full backup."""
import argparse
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

MIGRATION_ID = 'rome-osp-five-venues-2026-11-04-v1'
DATA = json.loads((Path(__file__).parent / 'data' / 'rome_osp.json').read_text())

def venue_id(slug):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'outdoorplanner/rome-osp/' + slug))

async def seed_rome_osp(db, apply=True):
    comune = await db.comuni.find_one({'nome': 'Roma'}, {'_id': 0})
    if not comune:
        return {'status': 'no-rome'}
    if await db.migrations.find_one({'_id': MIGRATION_ID}):
        return {'status': 'already-applied'}
    cid = comune['id']
    ids = [venue_id(row['slug']) for row in DATA]
    old = await db.spazi.find({'comune_id': cid, 'tipologia': 'Progetto Speciale', 'id': {'$nin': ids}}).to_list(10000)
    old_ids = [row['id'] for row in old]
    references = set(await db.pratiche.distinct('spazio_id', {'spazio_id': {'$in': old_ids}}))
    references.update(await db.campagne.distinct('spazi_ids', {'spazi_ids': {'$in': old_ids}}))
    archive = sorted(set(old_ids) & references)
    remove = sorted(set(old_ids) - references)
    result = {'status': 'applied' if apply else 'preview', 'comune': 'Roma', 'replace': len(old), 'archive_referenced': len(archive), 'remove_unreferenced': len(remove), 'new_areas': [{'nome': r['nome'], 'euro_giorno': r['canone_giornaliero'], 'mq_demo': r['superficie_mq'], 'capienza_demo': r['capienza']} for r in DATA]}
    if not apply:
        return result
    now = datetime.now(timezone.utc).isoformat()
    # Save all previous documents, including internal IDs, before any mutation.
    await db.seed_backups.update_one({'_id': MIGRATION_ID}, {'$setOnInsert': {'comune_id': cid, 'created_at': now, 'spazi': old}}, upsert=True)
    template = await db.form_templates.find_one({'comune_id': cid, 'tipo': 'OSP'}, {'_id': 0})
    if not template:
        from seed_demo import MODULO_OSP
        template = {'id': venue_id('modulo-osp'), 'comune_id': cid, 'tipo': 'OSP', 'nome': 'Modulo Eventi OSP — Roma', **MODULO_OSP, 'updated_at': now}
        await db.form_templates.update_one({'id': template['id']}, {'$setOnInsert': template}, upsert=True)
    zones = {z['nome']: z['id'] for z in await db.zone.find({'comune_id': cid}, {'_id': 0, 'id': 1, 'nome': 1}).to_list(1000)}
    for row in DATA:
        record = {**row, 'id': venue_id(row['slug']), 'comune_id': cid, 'citta': 'Roma', 'regione': comune.get('regione', 'Lazio'), 'zona_id': zones.get(row['zona']), 'tipologia': 'Progetto Speciale', 'formato': 'Area OSP', 'dimensioni': f"{row['superficie_mq']} m²", 'disponibile': True, 'archiviato': False, 'giorni_minimi': 1, 'form_template_id': template['id'], 'opzioni': {}, 'demo': True, 'seed_version': MIGRATION_ID, 'created_at': now}
        await db.spazi.update_one({'id': record['id'], 'comune_id': cid}, {'$setOnInsert': record}, upsert=True)
    if archive:
        await db.spazi.update_many({'comune_id': cid, 'id': {'$in': archive}}, {'$set': {'archiviato': True, 'disponibile': False, 'archiviato_il': now, 'motivo_archiviazione': MIGRATION_ID}})
    if remove:
        await db.spazi.delete_many({'comune_id': cid, 'id': {'$in': remove}})
    active = await db.spazi.count_documents({'comune_id': cid, 'tipologia': 'Progetto Speciale', 'archiviato': {'$ne': True}})
    if active != 5:
        raise RuntimeError(f'Expected 5 Rome OSP areas, found {active}; backup retained')
    await db.migrations.update_one({'_id': MIGRATION_ID}, {'$setOnInsert': {'completed_at': now, 'result': result}}, upsert=True)
    return result

async def main():
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient
    load_dotenv(Path(__file__).parent / '.env')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Apply the scoped replacement; default is a read-only preview')
    args = parser.parse_args()
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL') or os.environ['MONGODB_URI'])
    try:
        print(json.dumps(await seed_rome_osp(client[os.environ['DB_NAME']], apply=args.apply), ensure_ascii=False, indent=2))
    finally:
        client.close()

if __name__ == '__main__':
    asyncio.run(main())
