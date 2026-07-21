"""Crea il modulo OSP per i comuni con spazi 'Progetto Speciale' e lo assegna. Idempotente."""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

NOME_MODULO = "Modulo OSP — Occupazione Suolo Pubblico"

CAMPI_OSP = [
    {"id": "descrizione_evento", "label": "Descrizione dell'evento / manifestazione", "tipo": "textarea", "opzioni": [], "required": True, "condizione": None},
    {"id": "tipo_occupazione", "label": "Tipo di occupazione", "tipo": "select", "opzioni": ["Gazebo", "Palco", "Dehors", "Stand espositivo", "Altro"], "required": True, "condizione": None},
    {"id": "superficie_mq", "label": "Superficie occupata (mq)", "tipo": "number", "opzioni": [], "required": True, "condizione": None},
    {"id": "numero_partecipanti", "label": "Numero partecipanti stimato", "tipo": "number", "opzioni": [], "required": False, "condizione": None},
    {"id": "impianto_elettrico", "label": "Prevede impianto elettrico", "tipo": "checkbox", "opzioni": [], "required": False, "condizione": None},
    {"id": "potenza_kw", "label": "Potenza richiesta (kW)", "tipo": "number", "opzioni": [], "required": False, "condizione": {"campo": "impianto_elettrico", "valore": True}},
    {"id": "somministrazione", "label": "Somministrazione di alimenti e bevande", "tipo": "checkbox", "opzioni": [], "required": False, "condizione": None},
]

DOCS_OSP = [
    {"id": "planimetria", "label": "Planimetria dell'area", "required": True},
    {"id": "relazione_tecnica", "label": "Relazione tecnica dell'allestimento", "required": False},
    {"id": "polizza_assicurativa", "label": "Polizza assicurativa RC", "required": True},
    {"id": "doc_identita", "label": "Documento d'identità", "required": True},
]


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    comune_ids = await db.spazi.distinct("comune_id", {"tipologia": "Progetto Speciale"})
    for cid in comune_ids:
        tpl = await db.form_templates.find_one({"comune_id": cid, "nome": NOME_MODULO}, {"_id": 0})
        if not tpl:
            tpl = {"id": str(uuid.uuid4()), "comune_id": cid, "nome": NOME_MODULO,
                   "campi": CAMPI_OSP, "documenti_richiesti": DOCS_OSP,
                   "updated_at": datetime.now(timezone.utc).isoformat()}
            await db.form_templates.insert_one({**tpl})
            print(f"Creato modulo OSP per comune {cid}")
        else:
            await db.form_templates.update_one({"id": tpl["id"]}, {"$set": {"campi": CAMPI_OSP, "documenti_richiesti": DOCS_OSP}})
            print(f"Modulo OSP già presente per comune {cid}, aggiornato")
        res = await db.spazi.update_many({"comune_id": cid, "tipologia": "Progetto Speciale"},
                                         {"$set": {"form_template_id": tpl["id"]}})
        print(f"  Assegnato a {res.matched_count} spazi Progetto Speciale")

asyncio.run(main())
