"""Seed demo: 3 comuni (Roma, Napoli, Milano), 3 operatori L1/L2/L3 ciascuno,
3 zone per comune, 3 circuiti per comune intitolati alla via con >=4 impianti sulla stessa via.
Nessuna pratica. Ripetibile."""
import asyncio
import os
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")
random.seed(7)

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

# per ogni comune: 3 zone, ciascuna con la via del circuito
DATASET = {
    "Roma": {
        "regione": "Lazio", "provincia": "RM", "lat": 41.9028, "lng": 12.4964, "sigla": "RM",
        "zone": [
            {"nome": "EUR", "q": "Municipio IX", "c": (41.8320, 12.4700), "via": "Viale Europa"},
            {"nome": "Centro", "q": "Municipio I", "c": (41.8990, 12.4790), "via": "Via del Corso"},
            {"nome": "Ostiense", "q": "Municipio VIII", "c": (41.8660, 12.4790), "via": "Via Ostiense"},
        ],
        "osp": ("Area Eventi Circo Massimo", 41.8860, 12.4850, "Via del Circo Massimo", 400),
    },
    "Napoli": {
        "regione": "Campania", "provincia": "NA", "lat": 40.8518, "lng": 14.2681, "sigla": "NA",
        "zone": [
            {"nome": "Centro", "q": "Municipalità 2", "c": (40.8480, 14.2530), "via": "Via Toledo"},
            {"nome": "Vomero", "q": "Municipalità 5", "c": (40.8440, 14.2290), "via": "Via Scarlatti"},
            {"nome": "Chiaia", "q": "Municipalità 1", "c": (40.8330, 14.2330), "via": "Riviera di Chiaia"},
        ],
        "osp": ("Area Eventi Piazza del Plebiscito", 40.8360, 14.2480, "Piazza del Plebiscito", 380),
    },
    "Milano": {
        "regione": "Lombardia", "provincia": "MI", "lat": 45.4642, "lng": 9.19, "sigla": "MI",
        "zone": [
            {"nome": "Navigli", "q": "Municipio 6", "c": (45.4500, 9.1730), "via": "Corso San Gottardo"},
            {"nome": "Porta Nuova", "q": "Municipio 9", "c": (45.4820, 9.1900), "via": "Corso Como"},
            {"nome": "Centro", "q": "Municipio 1", "c": (45.4640, 9.1900), "via": "Corso Buenos Aires"},
        ],
        "osp": ("Area Eventi Darsena", 45.4520, 9.1770, "Piazza XXIV Maggio", 350),
    },
}

LIVELLI = {1: "Operatore", 2: "Referente", 3: "Responsabile"}
now = lambda: datetime.now(timezone.utc).isoformat()


def rect_polygon(lat, lng, dlat=0.008, dlng=0.011):
    return [[lat - dlat, lng - dlng], [lat - dlat, lng + dlng], [lat + dlat, lng + dlng], [lat + dlat, lng - dlng]]


async def main():
    import bcrypt
    hash_pw = lambda p: bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    # pulizia dati business (mantiene superadmin e inserzionisti)
    for coll in ["comuni", "zone", "impianti", "pacchetti", "spazi", "form_templates",
                 "pratiche", "campagne", "prenotazioni", "soggetti", "creativita",
                 "log_stato", "chat", "notifiche"]:
        r = await db[coll].delete_many({})
        print(f"Pulita {coll}: {r.deleted_count}")
    await db.users.delete_many({"ruolo": "comune"})

    for nome, d in DATASET.items():
        cid = str(uuid.uuid4())
        await db.comuni.insert_one({
            "id": cid, "nome": nome, "regione": d["regione"], "provincia": d["provincia"],
            "lat": d["lat"], "lng": d["lng"], "logo_url": None, "tariffe": [],
            "regole": "Regolamento comunale standard", "attivo": True,
            "livelli_attivi": [1, 2, 3], "stato_onboarding": "ATTIVO", "created_at": now(),
        })

        low = nome.lower()
        for lv, ruolo in LIVELLI.items():
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "email": f"{low}.l{lv}@demo.it",
                "nome": f"{ruolo} {nome}", "ruolo": "comune", "comune_id": cid, "livello": lv,
                "password_hash": hash_pw("demo123"), "created_at": now(),
            })
        print(f"{nome}: utenze {low}.l1@demo.it / {low}.l2@demo.it / {low}.l3@demo.it (demo123)")

        tpl_ooh = {"id": str(uuid.uuid4()), "comune_id": cid, "tipo": "OOH",
                   "nome": f"Modulo Campagna OOH — {nome}", **MODULO_OOH, "updated_at": now()}
        tpl_osp = {"id": str(uuid.uuid4()), "comune_id": cid, "tipo": "OSP",
                   "nome": "Modulo OSP — Occupazione Suolo Pubblico", **MODULO_OSP, "updated_at": now()}
        await db.form_templates.insert_many([dict(tpl_ooh), dict(tpl_osp)])

        for z in d["zone"]:
            lat, lng = z["c"]
            zona = {"id": str(uuid.uuid4()), "comune_id": cid, "nome": z["nome"],
                    "descrizione": f"Zona {z['nome']} — {z['q']}", "quartiere": z["q"],
                    "polygon": rect_polygon(lat, lng), "vie": [z["via"]], "created_at": now()}
            await db.zone.insert_one(dict(zona))

            via = z["via"]
            abbrev = "".join(w[0] for w in via.split()).upper()
            impianti = []
            for i in range(5):
                tipo, formato, prezzo, img = TIPI[i % len(TIPI)]
                # impianti distribuiti lungo la via
                imp = {"id": str(uuid.uuid4()), "comune_id": cid, "zona_id": zona["id"],
                       "codice": f"{d['sigla']}-{abbrev}-{i+1:03d}",
                       "via": via, "indirizzo": f"{via}, {10 + i * 22}",
                       "lat": lat - 0.003 + i * 0.0015, "lng": lng - 0.004 + i * 0.002,
                       "tipologia": tipo, "formato": formato, "dimensioni": formato,
                       "categoria": "dooh" if "Led" in tipo or "Mupi" in tipo else ("maxi" if "6x3" in tipo else "cartacee"),
                       "prezzo": float(prezzo), "foto_url": img, "note": "", "attivo": True, "created_at": now()}
                impianti.append(imp)
            await db.impianti.insert_many([dict(i) for i in impianti])

            await db.pacchetti.insert_one({
                "id": str(uuid.uuid4()), "comune_id": cid, "zona_id": zona["id"],
                "nome": f"Circuito {via}",
                "descrizione": f"{len(impianti)} impianti lungo {via} ({z['nome']}, {nome})",
                "impianti_ids": [i["id"] for i in impianti],
                "form_template_id": tpl_ooh["id"], "attivo": True, "created_at": now()})
            print(f"  {nome}/{z['nome']}: zona + Circuito {via} con {len(impianti)} impianti")

        snome, slat, slng, sind, canone = d["osp"]
        await db.spazi.insert_one({
            "id": str(uuid.uuid4()), "comune_id": cid, "citta": nome, "regione": d["regione"],
            "nome": snome, "tipologia": "Progetto Speciale", "formato": "Area su misura",
            "zona": d["zone"][0]["nome"], "zona_id": None, "indirizzo": sind,
            "lat": slat, "lng": slng, "canone_giornaliero": canone,
            "dimensioni": "Area su misura",
            "descrizione": "Area comunale per eventi, occupazioni temporanee e progetti speciali.",
            "disponibile": True, "foto_url": IMG_PIAZZA, "form_template_id": tpl_osp["id"], "created_at": now()})
        print(f"  {nome}: 1 area OSP ({snome})")

    print("Seed demo completato: 3 comuni, 9 utenze comunali, 9 zone, 9 circuiti, 45 impianti, 0 pratiche.")

asyncio.run(main())
