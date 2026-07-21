import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from motor.motor_asyncio import AsyncIOMotorClient

IMG_BILLBOARD = "https://images.unsplash.com/photo-1699480114704-ac153307d2a0?crop=entropy&cs=srgb&fm=jpg&q=85"
IMG_PIAZZA = "https://images.unsplash.com/photo-1777403705903-9704d002ca8a?crop=entropy&cs=srgb&fm=jpg&q=85"
IMG_URBAN = "/api/uploads/spazi/mupi_urban.jpeg"
IMG_LED = "https://images.unsplash.com/photo-1563089145-599997674d42?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"

def uid():
    return str(uuid.uuid4())

def iso(d):
    return d.isoformat()

async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc)

    for coll in ["spazi", "pratiche", "campagne", "log_stato", "chat", "notifiche"]:
        await db[coll].delete_many({})
    print("collezioni dati svuotate")

    comuni = {c["nome"]: c for c in await db.comuni.find({}, {"_id": 0}).to_list(50)}

    # template: assicura id e mappa comune -> template default
    tpl_by_comune = {}
    for t in await db.form_templates.find({}).to_list(50):
        if not t.get("id"):
            await db.form_templates.update_one({"_id": t["_id"]}, {"$set": {"id": uid()}})
            t["id"] = (await db.form_templates.find_one({"_id": t["_id"]}))["id"]
        tpl_by_comune[t["comune_id"]] = t["id"]

    def spazio(cnome, nome, tipologia, formato, zona, indirizzo, lat, lng, canone, foto, opzioni):
        c = comuni[cnome]
        return {"id": uid(), "comune_id": c["id"], "citta": c["nome"], "regione": c["regione"],
                "nome": nome, "tipologia": tipologia, "formato": formato, "zona": zona,
                "indirizzo": indirizzo, "lat": lat, "lng": lng, "canone_giornaliero": canone,
                "dimensioni": formato, "opzioni": opzioni,
                "form_template_id": tpl_by_comune.get(c["id"]),
                "descrizione": f"Spazio {tipologia.lower()} ({formato}) in zona {zona}, posizione ad alta visibilità a {c['nome']}.",
                "disponibile": True, "foto_url": foto, "created_at": iso(now)}

    P = "Poster Standard"; A = "Arredo Urbano"; T = "Totem Digitale"; S = "Progetto Speciale"
    spazi = [
        spazio("Roma", "Poster 6x3 Via Tiburtina", P, "6x3", "Tiburtino", "Via Tiburtina 450", 41.912, 12.545, 65, IMG_BILLBOARD, {"formato": "6x3", "quantita": 1, "orientamento": "Orizzontale"}),
        spazio("Roma", "Maxi 4x3 Stazione Termini", P, "4x3", "Esquilino", "Piazza dei Cinquecento", 41.9009, 12.5018, 55, IMG_BILLBOARD, {"formato": "4x3", "quantita": 1, "orientamento": "Orizzontale"}),
        spazio("Roma", "Banner verticale Via del Corso", P, "Banner verticale", "Centro Storico", "Via del Corso 300", 41.9059, 12.4784, 70, IMG_URBAN, {"formato": "Banner verticale", "quantita": 2, "orientamento": "Verticale"}),
        spazio("Roma", "Cartellone stradale GRA Uscita 24", P, "Cartellone stradale", "Tiburtino", "GRA Uscita 24", 41.836, 12.578, 48, IMG_BILLBOARD, {"formato": "Cartellone stradale", "quantita": 1, "orientamento": "Orizzontale"}),
        spazio("Roma", "MUPI Via Cola di Rienzo", A, "MUPI 120x180", "Prati", "Via Cola di Rienzo 150", 41.9077, 12.4655, 32, IMG_URBAN, {"formato": "MUPI 120x180", "quantita": 4}),
        spazio("Roma", "Pensilina Viale Trastevere", A, "Pensilina 200x100", "Trastevere", "Viale di Trastevere 80", 41.8867, 12.4692, 30, IMG_URBAN, {"formato": "Pensilina 200x100", "quantita": 2}),
        spazio("Roma", "Totem LED Viale Europa", T, '75" LED', "EUR", "Viale Europa 120", 41.8256, 12.4646, 60, IMG_LED, {"formato": '75" LED', "secondi_spot": "30"}),
        spazio("Roma", "OSP Piazza San Giovanni", S, "Su misura", "San Giovanni", "Piazza di San Giovanni in Laterano", 41.8859, 12.5057, 110, IMG_PIAZZA, {"superficie_mq": 150, "tipo_occupazione": "Palco"}),
        spazio("Milano", "Poster 6x3 Viale Certosa", P, "6x3", "Certosa", "Viale Certosa 148", 45.5015, 9.13, 75, IMG_BILLBOARD, {"formato": "6x3", "quantita": 1, "orientamento": "Orizzontale"}),
        spazio("Milano", "Maxi Ledwall Piazza Duomo", T, "Maxi Ledwall", "Centro", "Piazza Duomo", 45.4641, 9.19, 140, IMG_LED, {"formato": "Maxi Ledwall", "secondi_spot": "15"}),
        spazio("Bologna", "Poster 6x3 Via Stalingrado", P, "6x3", "San Donato", "Via Stalingrado 40", 44.5148, 11.3608, 45, IMG_BILLBOARD, {"formato": "6x3", "quantita": 1, "orientamento": "Orizzontale"}),
        spazio("Bologna", "MUPI Via Indipendenza", A, "MUPI 120x180", "Centro", "Via dell'Indipendenza 40", 44.4986, 11.3426, 28, IMG_URBAN, {"formato": "MUPI 120x180", "quantita": 3}),
        spazio("Bologna", "Totem LED Quartiere Fiera", T, '55" LED', "Fiera", "Viale della Fiera 20", 44.5075, 11.3705, 38, IMG_LED, {"formato": '55" LED', "secondi_spot": "30"}),
    ]
    await db.spazi.insert_many([{**s} for s in spazi])
    print(f"{len(spazi)} spazi creati")

    user = await db.users.find_one({"email": "user@demo.it"}, {"_id": 0})
    op = await db.users.find_one({"email": "comune@demo.it"}, {"_id": 0})

    def pratica(sp, stato, giorni_fa, extra=None):
        created = now - timedelta(days=giorni_fa)
        p = {"id": uid(), "user_id": user["id"], "user_nome": user["nome"],
             "spazio_id": sp["id"], "spazio_nome": sp["nome"], "comune_id": sp["comune_id"],
             "stato": stato,
             "dati_form": {"tipo_richiedente": "Azienda", "ragione_sociale": "Eventi Italia Srl",
                           "partita_iva": "12345678901", "codice_fiscale": "VNTITL80A01H501X",
                           "descrizione_contenuto": "Campagna promozionale evento culturale",
                           "impianto_elettrico": False},
             "documenti": [], "data_inizio": iso(now + timedelta(days=20))[:10],
             "data_fine": iso(now + timedelta(days=27))[:10],
             "importo": round(8 * sp["canone_giornaliero"], 2), "pagata": True,
             "created_at": iso(created), "updated_at": iso(created + timedelta(hours=5))}
        if extra:
            p.update(extra)
        return p

    p1 = pratica(spazi[0], "INVIATA", 4)
    p2 = pratica(spazi[1], "IN_ISTRUTTORIA", 9)
    p3 = pratica(spazi[4], "INTEGRAZIONE_RICHIESTA", 6)
    p4 = pratica(spazi[7], "APPROVATA", 15, {"numero_autorizzazione": "AUT-2026-DEMO01", "data_approvazione": iso(now - timedelta(days=2))})
    await db.pratiche.insert_many([{**p} for p in [p1, p2, p3, p4]])

    logs = []
    def add_logs(p, catena, autori):
        prev = None
        t = datetime.fromisoformat(p["created_at"])
        for i, st in enumerate(catena):
            logs.append({"id": uid(), "pratica_id": p["id"], "da": prev, "a": st,
                         "autore_id": autori[i]["id"], "autore_nome": autori[i]["nome"],
                         "nota": "", "timestamp": iso(t + timedelta(hours=i * 8))})
            prev = st
    add_logs(p1, ["BOZZA", "INVIATA"], [user, user])
    add_logs(p2, ["BOZZA", "INVIATA", "IN_ISTRUTTORIA"], [user, user, op])
    add_logs(p3, ["BOZZA", "INVIATA", "IN_ISTRUTTORIA", "INTEGRAZIONE_RICHIESTA"], [user, user, op, op])
    add_logs(p4, ["BOZZA", "INVIATA", "IN_ISTRUTTORIA", "APPROVATA"], [user, user, op, op])
    await db.log_stato.insert_many(logs)
    print("4 pratiche demo create")

asyncio.run(main())
