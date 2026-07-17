import os
import uuid
from datetime import datetime, timezone, timedelta

IMG_BILLBOARD = "https://images.unsplash.com/photo-1699480114704-ac153307d2a0?crop=entropy&cs=srgb&fm=jpg&q=85"
IMG_PIAZZA = "https://images.unsplash.com/photo-1777403705903-9704d002ca8a?crop=entropy&cs=srgb&fm=jpg&q=85"


def iso(dt):
    return dt.isoformat()


def _uid():
    return str(uuid.uuid4())


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
            {"tipologia": "Billboard", "canone_giornaliero": 55},
            {"tipologia": "Poster", "canone_giornaliero": 25},
            {"tipologia": "Totem", "canone_giornaliero": 40},
            {"tipologia": "Suolo pubblico", "canone_giornaliero": 35},
        ], "regole": "Regolamento comunale per pubblicità e OSP. Preavviso minimo 15 giorni. Bozzetto obbligatorio.",
            "attivo": True, "created_at": iso(now)})
    await db.comuni.insert_many([{**c} for c in comuni])
    roma, milano, firenze, napoli, bologna = comuni

    users = [
        {"id": _uid(), "email": admin_email, "nome": "Mattia Fabrizi", "ruolo": "superadmin", "comune_id": None},
        {"id": _uid(), "email": "user@demo.it", "nome": "Luca Bianchi", "ruolo": "user", "comune_id": None},
        {"id": _uid(), "email": "comune@demo.it", "nome": "Operatore Roma L1", "ruolo": "comune", "comune_id": roma["id"]},
        {"id": _uid(), "email": "comune.milano@demo.it", "nome": "Referente Milano L2", "ruolo": "comune", "comune_id": milano["id"]},
    ]
    for u in users:
        u["created_at"] = iso(now)
    await db.users.insert_many([{**u, "password_hash": pwd} for u in users])
    superadmin, demo_user, op_roma, op_milano = users

    def spazio(comune, nome, tipologia, indirizzo, lat, lng, canone, dim, foto=IMG_BILLBOARD, disp=True):
        return {"id": _uid(), "comune_id": comune["id"], "citta": comune["nome"], "regione": comune["regione"],
                "nome": nome, "tipologia": tipologia, "indirizzo": indirizzo, "lat": lat, "lng": lng,
                "canone_giornaliero": canone, "dimensioni": dim,
                "descrizione": f"Spazio {tipologia.lower()} in posizione ad alta visibilità a {comune['nome']}.",
                "disponibile": disp, "foto_url": foto, "created_at": iso(now)}

    spazi = [
        spazio(roma, "Billboard Via Tiburtina", "Billboard", "Via Tiburtina 450", 41.912, 12.545, 65, "6x3 m"),
        spazio(roma, "Poster Stazione Termini", "Poster", "Piazza dei Cinquecento", 41.9009, 12.5018, 30, "140x200 cm"),
        spazio(roma, "Totem EUR Laurentina", "Totem", "Viale America 20", 41.8256, 12.4646, 45, "120x250 cm"),
        spazio(roma, "Area Eventi Piazza del Popolo", "Suolo pubblico", "Piazza del Popolo", 41.9109, 12.4768, 120, "200 mq", IMG_PIAZZA),
        spazio(roma, "Billboard GRA Uscita 24", "Billboard", "GRA Uscita 24", 41.836, 12.578, 58, "6x3 m", IMG_BILLBOARD, False),
        spazio(milano, "Billboard Viale Certosa", "Billboard", "Viale Certosa 148", 45.5015, 9.13, 75, "6x3 m"),
        spazio(milano, "Poster Metro Duomo", "Poster", "Piazza Duomo", 45.4641, 9.19, 40, "140x200 cm"),
        spazio(milano, "Area Eventi Parco Sempione", "Suolo pubblico", "Piazza Sempione", 45.4757, 9.1738, 150, "300 mq", IMG_PIAZZA),
        spazio(milano, "Totem Corso Buenos Aires", "Totem", "Corso Buenos Aires 33", 45.4785, 9.2103, 55, "120x250 cm"),
        spazio(firenze, "Poster Ponte Vecchio Nord", "Poster", "Lungarno Acciaiuoli", 43.768, 11.2531, 28, "140x200 cm"),
        spazio(firenze, "Area Eventi Piazza Santa Croce", "Suolo pubblico", "Piazza Santa Croce", 43.7686, 11.2622, 100, "250 mq", IMG_PIAZZA),
        spazio(firenze, "Billboard Viale Europa", "Billboard", "Viale Europa 120", 43.7455, 11.29, 48, "6x3 m"),
        spazio(napoli, "Billboard Via Marina", "Billboard", "Via Nuova Marina 10", 40.845, 14.265, 50, "6x3 m"),
        spazio(napoli, "Area Eventi Piazza Plebiscito", "Suolo pubblico", "Piazza del Plebiscito", 40.8359, 14.2488, 110, "400 mq", IMG_PIAZZA),
        spazio(bologna, "Poster Via Indipendenza", "Poster", "Via dell'Indipendenza 40", 44.4986, 11.3426, 26, "140x200 cm"),
        spazio(bologna, "Totem Fiera District", "Totem", "Viale della Fiera 20", 44.5075, 11.3705, 38, "120x250 cm"),
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
