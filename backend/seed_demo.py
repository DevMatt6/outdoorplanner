"""Reset dati demo e seed Roma/Milano/Napoli: zone, vie, confini, impianti, circuiti, moduli, aree OSP. Ripetibile."""
import asyncio
import os
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")
random.seed(42)

IMG_BILLBOARD = "https://images.unsplash.com/photo-1699480114704-ac153307d2a0?crop=entropy&cs=srgb&fm=jpg&q=85"
IMG_PIAZZA = "https://images.unsplash.com/photo-1777403705903-9704d002ca8a?crop=entropy&cs=srgb&fm=jpg&q=85"
IMG_URBAN = "/api/uploads/spazi/mupi_urban.jpeg"
IMG_LED = "https://images.unsplash.com/photo-1563089145-599997674d42?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"

IMG_PER_TIPO = {
    "Manifesto 200x140": IMG_BILLBOARD, "Manifesto 100x140": IMG_BILLBOARD, "Manifesto 70x100": IMG_URBAN,
    "Maxi Ledwall Stradale": IMG_LED, "Mupi Digitale / Totem Smart": IMG_URBAN,
    "Schermo su Edicola/Chiosco": IMG_URBAN, "Impianto Digitale Temporaneo – SCIA": IMG_LED,
    "Poster Maxi 6x3": IMG_BILLBOARD, "Mega Poster Stradale >18mq": IMG_BILLBOARD,
}
FORMATO_PER_TIPO = {
    "Manifesto 200x140": "200x140 cm", "Manifesto 100x140": "100x140 cm", "Manifesto 70x100": "70x100 cm",
    "Maxi Ledwall Stradale": "Ledwall 6x3 m", "Mupi Digitale / Totem Smart": "Mupi 120x180 cm",
    "Schermo su Edicola/Chiosco": 'Schermo 55"', "Impianto Digitale Temporaneo – SCIA": "Ledwall 4x3 m",
    "Poster Maxi 6x3": "6x3 m", "Mega Poster Stradale >18mq": "12x6 m",
}
TIPI = list(IMG_PER_TIPO.keys())

now = lambda: datetime.now(timezone.utc).isoformat()

DATASET = {
    "Roma": {
        "ref": ("comune.l3@demo.it", None),
        "zone": {
            "EUR": {"c": (41.8320, 12.4700), "q": "Municipio IX", "vie": ["Via dei Sommozzatori", "Viale Europa", "Via Cristoforo Colombo", "Viale America"]},
            "Centro": {"c": (41.8990, 12.4790), "q": "Municipio I", "vie": ["Via del Corso", "Via Nazionale", "Via del Tritone"]},
            "Ostiense": {"c": (41.8660, 12.4790), "q": "Municipio VIII", "vie": ["Via Ostiense", "Via del Porto Fluviale", "Circonvallazione Ostiense"]},
            "Prati": {"c": (41.9080, 12.4620), "q": "Municipio I", "vie": ["Via Cola di Rienzo", "Viale Giulio Cesare", "Via Ottaviano"]},
        },
        "osp": [("Area Eventi Piazza San Giovanni", 41.8860, 12.5060, "Piazza di San Giovanni in Laterano", 300),
                ("Area OSP Circo Massimo", 41.8860, 12.4850, "Via del Circo Massimo", 400)],
    },
    "Milano": {
        "ref": ("comune.milano@demo.it", "Referente Milano"),
        "zone": {
            "Navigli": {"c": (45.4500, 9.1730), "q": "Municipio 6", "vie": ["Ripa di Porta Ticinese", "Corso San Gottardo", "Via Vigevano"]},
            "Porta Nuova": {"c": (45.4820, 9.1900), "q": "Municipio 9", "vie": ["Corso Como", "Via Melchiorre Gioia", "Viale della Liberazione"]},
            "CityLife": {"c": (45.4780, 9.1560), "q": "Municipio 8", "vie": ["Piazza Tre Torri", "Viale Scarampo", "Via Spinola"]},
            "Centro": {"c": (45.4640, 9.1900), "q": "Municipio 1", "vie": ["Corso Vittorio Emanuele II", "Via Dante", "Corso Buenos Aires"]},
        },
        "osp": [("Area Eventi Darsena", 45.4520, 9.1770, "Piazza XXIV Maggio", 350)],
    },
    "Napoli": {
        "ref": ("comune.napoli@demo.it", "Referente Napoli"),
        "zone": {
            "Centro": {"c": (40.8480, 14.2530), "q": "Municipalità 2", "vie": ["Via Toledo", "Corso Umberto I", "Spaccanapoli"]},
            "Vomero": {"c": (40.8440, 14.2290), "q": "Municipalità 5", "vie": ["Via Scarlatti", "Via Luca Giordano", "Via Cilea"]},
            "Chiaia": {"c": (40.8330, 14.2330), "q": "Municipalità 1", "vie": ["Riviera di Chiaia", "Via dei Mille", "Via Filangieri"]},
            "Fuorigrotta": {"c": (40.8260, 14.2000), "q": "Municipalità 10", "vie": ["Viale Augusto", "Via Terracina", "Piazzale Tecchio"]},
        },
        "osp": [("Area Eventi Piazza del Plebiscito", 40.8360, 14.2480, "Piazza del Plebiscito", 380)],
    },
}

COMUNI_BASE = {
    "Milano": {"regione": "Lombardia", "provincia": "MI", "lat": 45.4642, "lng": 9.19},
    "Napoli": {"regione": "Campania", "provincia": "NA", "lat": 40.8518, "lng": 14.2681},
}

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
        {"id": "numero_partecipanti", "label": "Numero partecipanti stimato", "tipo": "number", "opzioni": [], "required": False, "condizione": None},
        {"id": "impianto_elettrico", "label": "Prevede impianto elettrico", "tipo": "checkbox", "opzioni": [], "required": False, "condizione": None},
        {"id": "potenza_kw", "label": "Potenza richiesta (kW)", "tipo": "number", "opzioni": [], "required": False, "condizione": {"campo": "impianto_elettrico", "valore": True}},
        {"id": "somministrazione", "label": "Somministrazione di alimenti e bevande", "tipo": "checkbox", "opzioni": [], "required": False, "condizione": None},
    ],
    "documenti_richiesti": [
        {"id": "planimetria", "label": "Planimetria dell'area", "required": True},
        {"id": "relazione_tecnica", "label": "Relazione tecnica dell'allestimento", "required": False},
        {"id": "polizza_assicurativa", "label": "Polizza assicurativa RC", "required": True},
        {"id": "doc_identita", "label": "Documento d'identità", "required": True},
    ],
}


def rect_polygon(lat, lng, dlat=0.008, dlng=0.011):
    return [[lat - dlat, lng - dlng], [lat - dlat, lng + dlng], [lat + dlat, lng + dlng], [lat + dlat, lng - dlng]]


async def main():
    import bcrypt
    hash_pw = lambda p: bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    # 1. elimina comuni non demo (Bologna, Firenze, ecc.) e relativi dati/utenti
    keep = ["Roma", "Milano", "Napoli"]
    old = await db.comuni.find({"nome": {"$nin": keep}}, {"_id": 0, "id": 1, "nome": 1}).to_list(50)
    for c in old:
        pids = [p["id"] for p in await db.pratiche.find({"comune_id": c["id"]}, {"_id": 0, "id": 1}).to_list(5000)]
        if pids:
            await db.log_stato.delete_many({"pratica_id": {"$in": pids}})
            await db.chat.delete_many({"pratica_id": {"$in": pids}})
        await db.pratiche.delete_many({"comune_id": c["id"]})
        await db.users.delete_many({"ruolo": "comune", "comune_id": c["id"]})
        await db.comuni.delete_one({"id": c["id"]})
        print(f"Eliminato comune {c['nome']}")

    # 2. pulizia dati demo vecchia logica (mantiene utenti e comuni demo)
    for coll in ["spazi", "pratiche", "campagne", "log_stato", "chat", "notifiche",
                 "zone", "impianti", "pacchetti", "prenotazioni", "creativita", "form_templates"]:
        r = await db[coll].delete_many({})
        print(f"Pulita collezione {coll}: {r.deleted_count}")

    # 3. comuni demo (crea Milano/Napoli se mancanti) + stato onboarding ATTIVO
    for nome, base in COMUNI_BASE.items():
        if not await db.comuni.find_one({"nome": nome}):
            await db.comuni.insert_one({"id": str(uuid.uuid4()), "nome": nome, **base, "logo_url": None,
                                        "tariffe": [], "regole": "Regolamento comunale standard",
                                        "attivo": True, "created_at": now()})
            print(f"Creato comune {nome}")
    await db.comuni.update_many({}, {"$set": {"stato_onboarding": "ATTIVO"}})
    comuni = {c["nome"]: c for c in await db.comuni.find({}, {"_id": 0}).to_list(10)}

    # 4. referenti L3 Milano/Napoli
    for nome, data in DATASET.items():
        email, ref_nome = data["ref"]
        if ref_nome and not await db.users.find_one({"email": email}):
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "nome": ref_nome,
                                       "ruolo": "comune", "comune_id": comuni[nome]["id"], "livello": 3,
                                       "password_hash": hash_pw("demo123"), "created_at": now()})
            print(f"Creato referente {email}")

    # 5. zone, impianti, pacchetti, moduli, aree OSP
    for nome, data in DATASET.items():
        cid = comuni[nome]["id"]
        sigla = {"Roma": "RM", "Milano": "MI", "Napoli": "NA"}[nome]

        tpl_ooh = {"id": str(uuid.uuid4()), "comune_id": cid, "tipo": "OOH",
                   "nome": f"Modulo Campagna OOH - {nome}", **MODULO_OOH, "updated_at": now()}
        tpl_osp = {"id": str(uuid.uuid4()), "comune_id": cid, "tipo": "OSP",
                   "nome": "Modulo OSP — Occupazione Suolo Pubblico", **MODULO_OSP, "updated_at": now()}
        await db.form_templates.insert_many([dict(tpl_ooh), dict(tpl_osp)])

        for znome, zdata in data["zone"].items():
            lat, lng = zdata["c"]
            zona = {"id": str(uuid.uuid4()), "comune_id": cid, "nome": znome,
                    "descrizione": f"Zona {znome} — {zdata['q']}", "quartiere": zdata["q"],
                    "vie": zdata["vie"], "polygon": rect_polygon(lat, lng), "created_at": now()}
            await db.zone.insert_one(dict(zona))

            impianti = []
            n_imp = 12
            for i in range(n_imp):
                tipo = TIPI[i % len(TIPI)]
                via = zdata["vie"][i % len(zdata["vie"])]
                imp = {"id": str(uuid.uuid4()), "comune_id": cid, "zona_id": zona["id"],
                       "codice": f"{sigla}-{znome[:3].upper()}-{i+1:03d}", "via": via,
                       "indirizzo": f"{via}, {random.randint(1, 120)}",
                       "lat": lat + random.uniform(-0.006, 0.006), "lng": lng + random.uniform(-0.009, 0.009),
                       "tipologia": tipo, "categoria": "dooh" if "Led" in tipo or "Digital" in tipo or "Mupi" in tipo or "Schermo" in tipo else ("maxi" if "6x3" in tipo or "Mega" in tipo else "cartacee"),
                       "formato": FORMATO_PER_TIPO[tipo], "dimensioni": FORMATO_PER_TIPO[tipo],
                       "foto_url": IMG_PER_TIPO[tipo], "note": "", "attivo": True, "created_at": now()}
                impianti.append(imp)
            await db.impianti.insert_many([dict(i) for i in impianti])

            base_price = {"Roma": 60, "Milano": 70, "Napoli": 45}[nome]
            for size, mult in [(5, 1.0), (8, 1.5), (12, 2.0)]:
                subset = [i["id"] for i in impianti[:size]]
                await db.pacchetti.insert_one({
                    "id": str(uuid.uuid4()), "comune_id": cid, "zona_id": zona["id"],
                    "nome": f"Circuito {znome} {size}",
                    "descrizione": f"{size} impianti a formati misti nella zona {znome} di {nome}",
                    "impianti_ids": subset, "prezzo_giornaliero": round(base_price * mult * size / 5, 2),
                    "form_template_id": tpl_ooh["id"], "attivo": True, "created_at": now()})
            print(f"{nome}/{znome}: {n_imp} impianti, 3 circuiti")

        for (snome, slat, slng, sind, canone) in data["osp"]:
            await db.spazi.insert_one({
                "id": str(uuid.uuid4()), "comune_id": cid, "citta": nome, "regione": comuni[nome]["regione"],
                "nome": snome, "tipologia": "Area Eventi / OSP", "formato": "Area su misura", "zona": "",
                "indirizzo": sind, "lat": slat, "lng": slng, "canone_giornaliero": canone,
                "dimensioni": "Area su misura", "descrizione": "Area comunale per eventi, occupazioni temporanee e progetti speciali.",
                "disponibile": True, "foto_url": IMG_PIAZZA, "form_template_id": tpl_osp["id"], "created_at": now()})
        print(f"{nome}: {len(data['osp'])} aree OSP")

    print("Seed demo completato.")

asyncio.run(main())
