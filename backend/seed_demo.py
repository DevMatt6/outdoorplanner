"""Seed demo: 3 comuni (Roma, Napoli, Milano), 3 operatori L1/L2/L3 ciascuno,
2 zone e 2 circuiti per comune, 5 impianti totali distribuiti 3 + 2.
Nessuna pratica. Ripetibile e senza cancellazioni."""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")

IMG_BILLBOARD = "https://images.unsplash.com/photo-1699480114704-ac153307d2a0?crop=entropy&cs=srgb&fm=jpg&q=85"
IMG_PIAZZA = "https://images.unsplash.com/photo-1777403705903-9704d002ca8a?crop=entropy&cs=srgb&fm=jpg&q=85"
IMG_LED = "https://images.unsplash.com/photo-1563089145-599997674d42?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"

TIPI = [
    ("Manifesto 200x140", "200x140 cm", 250, IMG_BILLBOARD),
    ("Poster Maxi 6x3", "6x3 m", 400, IMG_BILLBOARD),
    ("Maxi Ledwall Stradale", "Ledwall 6x3 m", 600, IMG_LED),
    ("Mupi Digitale / Totem Smart", "Mupi 120x180 cm", 320, IMG_LED),
    ("Manifesto 100x140", "100x140 cm", 180, IMG_BILLBOARD),
]

MODULO_OOH = {
    "campi": [
        {"id": "descrizione_contenuto", "label": "Descrizione del contenuto pubblicitario", "tipo": "textarea", "opzioni": [], "required": True, "condizione": None},
        {"id": "settore_merceologico", "label": "Settore merceologico", "tipo": "select",
         "opzioni": ["Retail", "Food & Beverage", "Automotive", "Servizi", "Cultura ed eventi", "Altro"], "required": True, "condizione": None},
        {"id": "contiene_alcolici", "label": "Il messaggio pubblicizza alcolici", "tipo": "checkbox", "opzioni": [], "required": False, "condizione": None},
        {"id": "note", "label": "Note per l'ufficio", "tipo": "textarea", "opzioni": [], "required": False, "condizione": None},
    ],
    "documenti_richiesti": [
        {"id": "bozzetto", "label": "Bozzetto / grafica della creatività", "required": True},
        {"id": "doc_identita", "label": "Documento d'identità", "required": True},
    ],
}

MODULO_OSP = {
    "campi": [
        {"id": "descrizione_evento", "label": "Descrizione dell'evento / manifestazione", "tipo": "textarea", "opzioni": [], "required": True, "condizione": None},
        {"id": "tipo_occupazione", "label": "Tipo di occupazione", "tipo": "select", "opzioni": ["Gazebo", "Palco", "Dehors", "Stand espositivo", "Altro"], "required": True, "condizione": None},
        {"id": "superficie_mq", "label": "Superficie occupata (mq)", "tipo": "number", "opzioni": [], "required": True, "condizione": None},
        {"id": "impianto_elettrico", "label": "Prevede impianto elettrico", "tipo": "checkbox", "opzioni": [], "required": False, "condizione": None},
        {"id": "potenza_kw", "label": "Potenza richiesta (kW)", "tipo": "number", "opzioni": [], "required": False, "condizione": {"campo": "impianto_elettrico", "valore": True}},
    ],
    "documenti_richiesti": [
        {"id": "planimetria", "label": "Planimetria dell'area", "required": True},
        {"id": "polizza_assicurativa", "label": "Polizza assicurativa RC", "required": True},
        {"id": "doc_identita", "label": "Documento d'identità", "required": True},
    ],
}

# per ogni comune: 2 zone, ciascuna con la via del circuito
DATASET = {
    "Roma": {
        "regione": "Lazio", "provincia": "RM", "lat": 41.9028, "lng": 12.4964, "sigla": "RM",
        "zone": [
            {"nome": "EUR", "q": "Municipio IX", "c": (41.8320, 12.4700), "via": "Viale Europa"},
            {"nome": "Centro", "q": "Municipio I", "c": (41.8990, 12.4790), "via": "Via del Corso"},
        ],
        "osp": ("Area Eventi Circo Massimo", 41.8860, 12.4850, "Via del Circo Massimo", 400),
    },
    "Napoli": {
        "regione": "Campania", "provincia": "NA", "lat": 40.8518, "lng": 14.2681, "sigla": "NA",
        "zone": [
            {"nome": "Centro", "q": "Municipalità 2", "c": (40.8480, 14.2530), "via": "Via Toledo"},
            {"nome": "Vomero", "q": "Municipalità 5", "c": (40.8440, 14.2290), "via": "Via Scarlatti"},
        ],
        "osp": ("Area Eventi Piazza del Plebiscito", 40.8360, 14.2480, "Piazza del Plebiscito", 380),
    },
    "Milano": {
        "regione": "Lombardia", "provincia": "MI", "lat": 45.4642, "lng": 9.19, "sigla": "MI",
        "zone": [
            {"nome": "Navigli", "q": "Municipio 6", "c": (45.4500, 9.1730), "via": "Corso San Gottardo"},
            {"nome": "Porta Nuova", "q": "Municipio 9", "c": (45.4820, 9.1900), "via": "Corso Como"},
        ],
        "osp": ("Area Eventi Darsena", 45.4520, 9.1770, "Piazza XXIV Maggio", 350),
    },
}

LIVELLI = {1: "Operatore", 2: "Referente", 3: "Responsabile"}
now = lambda: datetime.now(timezone.utc).isoformat()


def rect_polygon(lat, lng, dlat=0.008, dlng=0.011):
    return [[lat - dlat, lng - dlng], [lat - dlat, lng + dlng], [lat + dlat, lng + dlng], [lat + dlat, lng - dlng]]


def stable_id(key):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "outdoorplanner/demo-three-cities/" + key))


async def seed_three_cities(db, hash_password):
    """Insert missing demo resources; preserve existing catalog and accounts."""
    demo_password_hash = hash_password("demo123")
    for nome, d in DATASET.items():
        low = nome.lower()
        existing = await db.comuni.find_one({"nome": nome})
        cid = existing["id"] if existing else stable_id(low)
        await db.comuni.update_one({"id": cid}, {"$setOnInsert": {
            "id": cid, "nome": nome, "regione": d["regione"], "provincia": d["provincia"],
            "lat": d["lat"], "lng": d["lng"], "logo_url": None, "tariffe": [],
            "regole": "Regolamento comunale demo", "attivo": True,
            "livelli_attivi": [1, 2, 3], "stato_onboarding": "ATTIVO", "created_at": now(),
        }}, upsert=True)
        for lv, label in LIVELLI.items():
            email = f"{low}.l{lv}@demo.it"
            await db.users.update_one({"email": email}, {"$setOnInsert": {
                "id": stable_id(email), "email": email, "nome": f"{label} {nome}",
                "ruolo": "comune", "comune_id": cid, "livello": lv, "attivo": True,
                "password_hash": demo_password_hash, "created_at": now(),
            }}, upsert=True)
        tid = stable_id(f"{low}/form-ooh")
        await db.form_templates.update_one({"id": tid}, {"$setOnInsert": {
            "id": tid, "comune_id": cid, "tipo": "OOH",
            "nome": f"Modulo Campagna OOH — {nome}", **MODULO_OOH, "updated_at": now(),
        }}, upsert=True)
        for zi, z in enumerate(d["zone"]):
            lat, lng = z["c"]
            zid = stable_id(f"{low}/zone/{zi}")
            await db.zone.update_one({"id": zid}, {"$setOnInsert": {
                "id": zid, "comune_id": cid, "nome": z["nome"],
                "descrizione": f"Zona {z['nome']} — {z['q']}", "quartiere": z["q"],
                "polygon": rect_polygon(lat, lng), "vie": [z["via"]], "created_at": now(),
            }}, upsert=True)
            ids = []
            for i in range(3 if zi == 0 else 2):
                index = zi * 3 + i
                tipo, formato, prezzo, img = TIPI[index]
                iid = stable_id(f"{low}/impianto/{index}")
                ids.append(iid)
                await db.impianti.update_one({"id": iid}, {"$setOnInsert": {
                    "id": iid, "comune_id": cid, "zona_id": zid,
                    "codice": f"{d['sigla']}-DEMO-{index + 1:03d}",
                    "via": z["via"], "indirizzo": f"{z['via']}, {10 + i * 22}",
                    "lat": lat - 0.0015 + i * 0.0015, "lng": lng - 0.002 + i * 0.002,
                    "tipologia": tipo, "formato": formato, "dimensioni": formato,
                    "categoria": "dooh" if "Led" in tipo or "Mupi" in tipo else ("maxi" if "6x3" in tipo else "cartacee"),
                    "prezzo": float(prezzo), "foto_url": img, "foto_urls": [img],
                    "giorni_minimi": 1, "note": "Impianto dimostrativo", "attivo": True,
                    "created_at": now(),
                }}, upsert=True)
            pid = stable_id(f"{low}/circuito/{zi}")
            await db.pacchetti.update_one({"id": pid}, {"$setOnInsert": {
                "id": pid, "comune_id": cid, "zona_id": zid, "nome": f"Circuito {z['via']}",
                "descrizione": f"{len(ids)} impianti — {z['nome']}, {nome}",
                "impianti_ids": ids, "form_template_id": tid, "attivo": True, "created_at": now(),
            }}, upsert=True)
    return {"comuni": 3, "utenze_comunali": 9, "zone": 6, "circuiti": 6, "impianti": 15}


async def main():
    import bcrypt
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL") or os.environ["MONGODB_URI"])
    try:
        def hash_password(password):
            return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        result = await seed_three_cities(client[os.environ["DB_NAME"]], hash_password)
        print("Catalogo demo disponibile:", result)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
