import os
import uuid
from datetime import datetime, timezone, timedelta

IMG_BILLBOARD = "https://images.unsplash.com/photo-1699480114704-ac153307d2a0?crop=entropy&cs=srgb&fm=jpg&q=85"
IMG_PIAZZA = "https://images.unsplash.com/photo-1777403705903-9704d002ca8a?crop=entropy&cs=srgb&fm=jpg&q=85"


def iso(dt):
    return dt.isoformat()


def _uid():
    return str(uuid.uuid4())


TIPOLOGIE_MAP = {
    "Billboard": ("Poster Standard", "6x3"),
    "Poster": ("Arredo Urbano", "MUPI 120x180"),
    "Totem": ("Totem Digitale", '55" LED'),
    "Suolo pubblico": ("Progetto Speciale", "Su misura"),
}


async def ensure_catalogo(db):
    for old, (new, fmt) in TIPOLOGIE_MAP.items():
        await db.spazi.update_many({"tipologia": old}, {"$set": {"tipologia": new}})
        await db.spazi.update_many({"tipologia": new, "formato": {"$exists": False}}, {"$set": {"formato": fmt}})
    await db.spazi.update_many({"formato": {"$exists": False}}, {"$set": {"formato": ""}})
    comuni = await db.comuni.find({}, {"_id": 0}).to_list(200)
    for c in comuni:
        tariffe = c.get("tariffe", [])
        changed = False
        for t in tariffe:
            if t.get("tipologia") in TIPOLOGIE_MAP:
                t["tipologia"] = TIPOLOGIE_MAP[t["tipologia"]][0]
                changed = True
        if changed:
            await db.comuni.update_one({"id": c["id"]}, {"$set": {"tariffe": tariffe}})



async def ensure_livelli(db, hash_password):
    now = datetime.now(timezone.utc)
    await db.users.update_many({"ruolo": "comune", "livello": {"$exists": False}}, {"$set": {"livello": 1}})
    await db.users.update_one({"email": "comune.milano@demo.it"}, {"$set": {"livello": 3, "nome": "Responsabile Milano L3"}})
    roma = await db.comuni.find_one({"nome": "Roma"}, {"_id": 0})
    if not roma:
        return
    pwd = hash_password("demo123")
    extra = [
        {"email": "comune.l2@demo.it", "nome": "Referente Roma L2", "livello": 2},
        {"email": "comune.l3@demo.it", "nome": "Responsabile Roma L3", "livello": 3},
    ]
    for u in extra:
        if not await db.users.find_one({"email": u["email"]}):
            await db.users.insert_one({"id": _uid(), "email": u["email"], "nome": u["nome"], "ruolo": "comune",
                                       "comune_id": roma["id"], "livello": u["livello"],
                                       "password_hash": pwd, "created_at": iso(now)})


async def seed_all(db, hash_password):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@demo.it")
    if await db.users.find_one({"email": admin_email}):
        return

    now = datetime.now(timezone.utc)
    pwd = hash_password("demo123")

    comuni = [
        {"id": _uid(), "nome": "Roma", "regione": "Lazio", "provincia": "RM", "lat": 41.9028, "lng": 12.4964},
        {"id": _uid(), "nome": "Milano", "regione": "Lombardia", "provincia": "MI", "lat": 45.4642, "lng": 9.19},
        {"id": _uid(), "nome": "Firenze", "regione": "Toscana", "provincia": "FI", "lat": 43.7696, "lng": 11.2558},
        {"id": _uid(), "nome": "Napoli", "regione": "Campania", "provincia": "NA", "lat": 40.8518, "lng": 14.2681},
        {"id": _uid(), "nome": "Bologna", "regione": "Emilia-Romagna", "provincia": "BO", "lat": 44.4949, "lng": 11.3426},
    ]
    for c in comuni:
        c.update({"tariffe": [
            {"tipologia": "Poster Standard", "canone_giornaliero": 55},
            {"tipologia": "Arredo Urbano", "canone_giornaliero": 25},
            {"tipologia": "Totem Digitale", "canone_giornaliero": 40},
            {"tipologia": "Progetto Speciale", "canone_giornaliero": 35},
        ], "regole": "Regolamento comunale per pubblicità e OSP. Preavviso minimo 15 giorni. Bozzetto obbligatorio.",
            "attivo": True, "created_at": iso(now)})
    await db.comuni.insert_many([{**c} for c in comuni])
    roma, milano, firenze, napoli, bologna = comuni

    users = [
        {"id": _uid(), "email": admin_email, "nome": "Mattia Fabrizi", "ruolo": "superadmin", "comune_id": None},
        {"id": _uid(), "email": "user@demo.it", "nome": "Luca Bianchi", "ruolo": "user", "comune_id": None},
        {"id": _uid(), "email": "comune@demo.it", "nome": "Operatore Roma L1", "ruolo": "comune", "comune_id": roma["id"], "livello": 1},
        {"id": _uid(), "email": "comune.milano@demo.it", "nome": "Responsabile Milano L3", "ruolo": "comune", "comune_id": milano["id"], "livello": 3},
    ]
    for u in users:
        u["created_at"] = iso(now)
    await db.users.insert_many([{**u, "password_hash": pwd} for u in users])
    superadmin, demo_user, op_roma, op_milano = users

    def spazio(comune, nome, tipologia, formato, indirizzo, lat, lng, canone, foto=IMG_BILLBOARD, disp=True):
        return {"id": _uid(), "comune_id": comune["id"], "citta": comune["nome"], "regione": comune["regione"],
                "nome": nome, "tipologia": tipologia, "formato": formato, "indirizzo": indirizzo,
                "lat": lat, "lng": lng, "canone_giornaliero": canone, "dimensioni": formato,
                "descrizione": f"Spazio {tipologia.lower()} in posizione ad alta visibilità a {comune['nome']}.",
                "disponibile": disp, "foto_url": foto, "created_at": iso(now)}

    spazi = [
        spazio(roma, "Poster Via Tiburtina", "Poster Standard", "6x3", "Via Tiburtina 450", 41.912, 12.545, 65),
        spazio(roma, "MUPI Stazione Termini", "Arredo Urbano", "MUPI 120x180", "Piazza dei Cinquecento", 41.9009, 12.5018, 30),
        spazio(roma, "Totem EUR Laurentina", "Totem Digitale", '55" LED', "Viale America 20", 41.8256, 12.4646, 45),
        spazio(roma, "OSP Piazza del Popolo", "Progetto Speciale", "Su misura", "Piazza del Popolo", 41.9109, 12.4768, 120, IMG_PIAZZA),
        spazio(roma, "Poster GRA Uscita 24", "Poster Standard", "4x3", "GRA Uscita 24", 41.836, 12.578, 58, IMG_BILLBOARD, False),
        spazio(milano, "Poster Viale Certosa", "Poster Standard", "6x3", "Viale Certosa 148", 45.5015, 9.13, 75),
        spazio(milano, "Pensilina Metro Duomo", "Arredo Urbano", "Pensilina 200x100", "Piazza Duomo", 45.4641, 9.19, 40),
        spazio(milano, "OSP Parco Sempione", "Progetto Speciale", "Su misura", "Piazza Sempione", 45.4757, 9.1738, 150, IMG_PIAZZA),
        spazio(milano, "Ledwall Corso Buenos Aires", "Totem Digitale", "Maxi Ledwall", "Corso Buenos Aires 33", 45.4785, 9.2103, 55),
        spazio(firenze, "MUPI Ponte Vecchio Nord", "Arredo Urbano", "MUPI 120x180", "Lungarno Acciaiuoli", 43.768, 11.2531, 28),
        spazio(firenze, "OSP Piazza Santa Croce", "Progetto Speciale", "Su misura", "Piazza Santa Croce", 43.7686, 11.2622, 100, IMG_PIAZZA),
        spazio(firenze, "Poster Viale Europa", "Poster Standard", "4x3", "Viale Europa 120", 43.7455, 11.29, 48),
        spazio(napoli, "Poster Via Marina", "Poster Standard", "6x3", "Via Nuova Marina 10", 40.845, 14.265, 50),
        spazio(napoli, "OSP Piazza Plebiscito", "Progetto Speciale", "Su misura", "Piazza del Plebiscito", 40.8359, 14.2488, 110, IMG_PIAZZA),
        spazio(bologna, "Totem Via Indipendenza", "Totem Digitale", '75" LED', "Via dell'Indipendenza 40", 44.4986, 11.3426, 26),
        spazio(bologna, "Ledwall Fiera District", "Totem Digitale", "Maxi Ledwall", "Viale della Fiera 20", 44.5075, 11.3705, 38),
    ]
    await db.spazi.insert_many([{**s} for s in spazi])

    campi_standard = [
        {"id": "tipo_richiedente", "label": "Tipo richiedente", "tipo": "select",
         "opzioni": ["Privato", "Azienda", "Associazione"], "required": True, "condizione": None},
        {"id": "ragione_sociale", "label": "Ragione sociale", "tipo": "text", "opzioni": [], "required": True,
         "condizione": {"campo": "tipo_richiedente", "valore": "Azienda"}},
        {"id": "partita_iva", "label": "Partita IVA", "tipo": "text", "opzioni": [], "required": True,
         "condizione": {"campo": "tipo_richiedente", "valore": "Azienda"}},
        {"id": "codice_fiscale", "label": "Codice fiscale", "tipo": "text", "opzioni": [], "required": True, "condizione": None},
        {"id": "descrizione_contenuto", "label": "Descrizione contenuto pubblicitario / evento", "tipo": "textarea",
         "opzioni": [], "required": True, "condizione": None},
        {"id": "impianto_elettrico", "label": "È previsto un impianto elettrico?", "tipo": "checkbox",
         "opzioni": [], "required": False, "condizione": None},
        {"id": "potenza_kw", "label": "Potenza richiesta (kW)", "tipo": "number", "opzioni": [], "required": True,
         "condizione": {"campo": "impianto_elettrico", "valore": True}},
    ]
    for c in comuni:
        await db.form_templates.insert_one({"comune_id": c["id"], "nome": f"Istanza OSP/Pubblicità - {c['nome']}",
                                            "campi": campi_standard, "updated_at": iso(now)})

    # demo pratiche in vari stati per user@demo.it su spazi Roma
    def pratica(sp, stato, giorni_fa, pagata=True):
        created = now - timedelta(days=giorni_fa)
        return {"id": _uid(), "user_id": demo_user["id"], "user_nome": demo_user["nome"],
                "spazio_id": sp["id"], "spazio_nome": sp["nome"], "comune_id": sp["comune_id"],
                "stato": stato,
                "dati_form": {"tipo_richiedente": "Azienda", "ragione_sociale": "Eventi Italia Srl",
                              "partita_iva": "12345678901", "codice_fiscale": "VNTITL80A01H501X",
                              "descrizione_contenuto": "Campagna promozionale evento culturale",
                              "impianto_elettrico": False},
                "documenti": [], "data_inizio": iso(now + timedelta(days=20))[:10],
                "data_fine": iso(now + timedelta(days=27))[:10],
                "importo": round(8 * sp["canone_giornaliero"], 2), "pagata": pagata,
                "created_at": iso(created), "updated_at": iso(created + timedelta(hours=5))}

    p1 = pratica(spazi[0], "INVIATA", 4)
    p2 = pratica(spazi[1], "IN_ISTRUTTORIA", 9)
    p3 = pratica(spazi[2], "INTEGRAZIONE_RICHIESTA", 6)
    p4 = pratica(spazi[3], "APPROVATA", 15)
    p4["numero_autorizzazione"] = "AUT-2026-DEMO01"
    p4["data_approvazione"] = iso(now - timedelta(days=2))
    p5 = pratica(spazi[5], "RIFIUTATA", 20)
    await db.pratiche.insert_many([{**p} for p in [p1, p2, p3, p4, p5]])

    logs = []
    def add_logs(p, catena, autori):
        prev = None
        t = datetime.fromisoformat(p["created_at"])
        for i, st in enumerate(catena):
            logs.append({"id": _uid(), "pratica_id": p["id"], "da": prev, "a": st,
                         "autore_id": autori[i]["id"], "autore_nome": autori[i]["nome"],
                         "nota": "", "timestamp": iso(t + timedelta(hours=i * 8))})
            prev = st

    add_logs(p1, ["BOZZA", "INVIATA"], [demo_user, demo_user])
    add_logs(p2, ["BOZZA", "INVIATA", "IN_ISTRUTTORIA"], [demo_user, demo_user, op_roma])
    add_logs(p3, ["BOZZA", "INVIATA", "IN_ISTRUTTORIA", "INTEGRAZIONE_RICHIESTA"], [demo_user, demo_user, op_roma, op_roma])
    add_logs(p4, ["BOZZA", "INVIATA", "IN_ISTRUTTORIA", "APPROVATA"], [demo_user, demo_user, op_roma, op_roma])
    add_logs(p5, ["BOZZA", "INVIATA", "IN_ISTRUTTORIA", "RIFIUTATA"], [demo_user, demo_user, op_milano, op_milano])
    await db.log_stato.insert_many(logs)

    await db.chat.insert_many([
        {"id": _uid(), "pratica_id": p3["id"], "autore_id": op_roma["id"], "autore_nome": op_roma["nome"],
         "autore_ruolo": "comune", "testo": "Buongiorno, il bozzetto caricato non è leggibile. Può ricaricarlo in alta risoluzione?",
         "created_at": iso(now - timedelta(days=5))},
        {"id": _uid(), "pratica_id": p3["id"], "autore_id": demo_user["id"], "autore_nome": demo_user["nome"],
         "autore_ruolo": "user", "testo": "Certo, provvedo entro domani. Grazie della segnalazione.",
         "created_at": iso(now - timedelta(days=4))},
    ])

    await db.notifiche.insert_many([
        {"id": _uid(), "user_id": demo_user["id"], "titolo": "Richiesta integrazione documenti",
         "messaggio": f"Pratica '{p3['spazio_nome']}': bozzetto illeggibile, ricaricare", "pratica_id": p3["id"],
         "letta": False, "created_at": iso(now - timedelta(days=5))},
        {"id": _uid(), "user_id": demo_user["id"], "titolo": "Pratica approvata! Autorizzazione disponibile",
         "messaggio": f"Pratica '{p4['spazio_nome']}' approvata", "pratica_id": p4["id"],
         "letta": False, "created_at": iso(now - timedelta(days=2))},
        {"id": _uid(), "user_id": op_roma["id"], "titolo": "Nuova attività su pratica",
         "messaggio": f"Pratica '{p1['spazio_nome']}' → INVIATA", "pratica_id": p1["id"],
         "letta": False, "created_at": iso(now - timedelta(days=4))},
    ])
