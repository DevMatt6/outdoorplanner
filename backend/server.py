from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import io
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib.pagesizes import A4

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

UPLOAD_DIR = Path('/app/uploads')
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI()
api_router = APIRouter(prefix="/api")
JWT_ALGO = "HS256"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STATI = ["BOZZA", "INVIATA", "IN_ISTRUTTORIA", "INTEGRAZIONE_RICHIESTA", "APPROVATA", "RIFIUTATA"]

DOC_DEFAULT = [
    {"id": "bozzetto", "label": "Bozzetto / grafica", "required": False},
    {"id": "planimetria", "label": "Planimetria", "required": False},
    {"id": "doc_identita", "label": "Documento d'identità", "required": False},
]

# ---------- helpers ----------

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str, ruolo: str) -> str:
    payload = {"sub": user_id, "email": email, "ruolo": ruolo,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGO)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non autenticato")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGO])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utente non trovato")
        if user.get("attivo") is False:
            raise HTTPException(status_code=403, detail="Account disabilitato")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")

def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["ruolo"] not in roles:
            raise HTTPException(status_code=403, detail="Permessi insufficienti")
        return user
    return checker

async def require_comune_l3(user: dict = Depends(get_current_user)):
    if user["ruolo"] != "comune":
        raise HTTPException(status_code=403, detail="Permessi insufficienti")
    comune_doc = await db.comuni.find_one({"id": user.get("comune_id")}, {"_id": 0, "livelli_attivi": 1})
    max_lv = max((comune_doc or {}).get("livelli_attivi") or [1, 2, 3])
    if user.get("livello", 1) < min(3, max_lv):
        raise HTTPException(status_code=403, detail="Operazione riservata al Responsabile (L3)")
    return user

async def notifica(user_id: str, titolo: str, messaggio: str, pratica_id: Optional[str] = None):
    await db.notifiche.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "titolo": titolo,
                                   "messaggio": messaggio, "pratica_id": pratica_id, "letta": False,
                                   "created_at": now_iso()})
    logger.info(f"[EMAIL MOCK] a utente {user_id}: {titolo} - {messaggio}")

async def log_stato(pratica_id: str, da: Optional[str], a: str, autore: dict, nota: str = ""):
    await db.log_stato.insert_one({"id": str(uuid.uuid4()), "pratica_id": pratica_id, "da": da, "a": a,
                                   "autore_id": autore["id"], "autore_nome": autore["nome"],
                                   "nota": nota, "timestamp": now_iso()})

# ---------- schemas ----------

class RegisterIn(BaseModel):
    email: str
    password: str
    nome: str
    tipo_soggetto: str = "Privato"
    ragione_sociale: Optional[str] = None
    partita_iva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    pec: Optional[str] = None
    telefono: Optional[str] = None

class LoginIn(BaseModel):
    email: str
    password: str

class SpazioIn(BaseModel):
    nome: str
    zona: str = ""
    zona_id: Optional[str] = None
    form_template_id: Optional[str] = None
    opzioni: dict = {}
    indirizzo: str
    lat: float
    lng: float
    canone_giornaliero: float
    descrizione: str = ""
    foto_url: str = ""

class CampoTemplate(BaseModel):
    id: str
    label: str
    tipo: str = "text"
    opzioni: List[str] = []
    required: bool = False
    condizione: Optional[dict] = None

class DocumentoRichiesto(BaseModel):
    id: str
    label: str
    required: bool = False

class TemplateIn(BaseModel):
    nome: str
    campi: List[CampoTemplate]
    documenti_richiesti: List[DocumentoRichiesto] = []

class PraticaIn(BaseModel):
    spazio_id: str
    data_inizio: str
    data_fine: str
    dati_form: dict = {}

class PraticaUpdate(BaseModel):
    data_inizio: Optional[str] = None
    data_fine: Optional[str] = None
    dati_form: Optional[dict] = None

class TransizioneIn(BaseModel):
    azione: str
    nota: str = ""

class ChatIn(BaseModel):
    testo: str

class CampagnaIn(BaseModel):
    nome: str
    data_inizio: str
    data_fine: str
    spazi_ids: List[str]

class CampagnaFormIn(BaseModel):
    pratica_ids: List[str]
    dati_form: dict


class UtenzaIn(BaseModel):
    email: str
    password: str
    nome: str
    livello: int = 1

class ComuneOnboardIn(BaseModel):
    nome: str
    regione: str
    provincia: str
    lat: float
    lng: float
    logo_url: Optional[str] = None
    livelli_attivi: List[int] = [1]
    utenze: List[UtenzaIn] = []

class ComuneUpdateIn(BaseModel):
    nome: Optional[str] = None
    regione: Optional[str] = None
    provincia: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    logo_url: Optional[str] = None
    livelli_attivi: Optional[List[int]] = None

class ComuneProfiloIn(BaseModel):
    tariffe: Optional[List[dict]] = None
    regole: Optional[str] = None

# ---------- auth ----------

@api_router.post("/auth/register")
async def register(data: RegisterIn):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email già registrata")
    user = {"id": str(uuid.uuid4()), "email": email, "nome": data.nome, "ruolo": "user",
            "comune_id": None, "tipo_soggetto": data.tipo_soggetto,
            "ragione_sociale": data.ragione_sociale, "partita_iva": data.partita_iva,
            "codice_fiscale": data.codice_fiscale, "pec": data.pec, "telefono": data.telefono,
            "created_at": now_iso()}
    await db.users.insert_one({**user, "password_hash": hash_password(data.password)})
    token = create_access_token(user["id"], email, "user")
    return {"user": user, "access_token": token}

@api_router.post("/auth/login")
async def login(data: LoginIn):
    email = data.email.lower().strip()
    doc = await db.users.find_one({"email": email})
    if not doc or not verify_password(data.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    user = {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
    token = create_access_token(user["id"], email, user["ruolo"])
    return {"user": user, "access_token": token}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------- public: comuni, spazi, geo ----------

@api_router.get("/geo/regioni")
async def geo_regioni():
    pipeline = [{"$match": {"disponibile": True}}, {"$group": {"_id": "$regione", "count": {"$sum": 1}}}]
    rows = await db.spazi.aggregate(pipeline).to_list(50)
    return {r["_id"]: r["count"] for r in rows}

@api_router.get("/comuni")
async def list_comuni():
    return await db.comuni.find({"stato_onboarding": {"$in": [None, "ATTIVO"]}}, {"_id": 0}).to_list(200)

@api_router.get("/spazi")
async def list_spazi(regione: Optional[str] = None, citta: Optional[str] = None,
                     tipologia: Optional[str] = None, formato: Optional[str] = None,
                     zona: Optional[str] = None, prezzo_max: Optional[float] = None,
                     q: Optional[str] = None, disponibile: Optional[bool] = None):
    query: dict = {}
    if regione:
        query["regione"] = regione
    if citta:
        query["citta"] = citta
    if tipologia:
        query["tipologia"] = tipologia
    if formato:
        query["formato"] = formato
    if zona:
        query["zona"] = zona
    if prezzo_max is not None:
        query["canone_giornaliero"] = {"$lte": prezzo_max}
    if disponibile is not None:
        query["disponibile"] = disponibile
    if q:
        query["$or"] = [{"nome": {"$regex": q, "$options": "i"}},
                        {"indirizzo": {"$regex": q, "$options": "i"}},
                        {"citta": {"$regex": q, "$options": "i"}}]
    return await db.spazi.find(query, {"_id": 0}).to_list(500)

@api_router.get("/spazi/zone")
async def spazi_zone(citta: Optional[str] = None):
    query = {"zona": {"$nin": [None, ""]}}
    if citta:
        query["citta"] = citta
    return sorted(await db.spazi.distinct("zona", query))

@api_router.get("/spazi/disponibili")
async def spazi_disponibili(data_inizio: str, data_fine: str, regione: Optional[str] = None,
                            citta: Optional[str] = None, tipologia: Optional[str] = None,
                            formato: Optional[str] = None, zona: Optional[str] = None):
    query: dict = {"disponibile": True}
    if regione:
        query["regione"] = regione
    if citta:
        query["citta"] = citta
    if tipologia:
        query["tipologia"] = tipologia
    if formato:
        query["formato"] = formato
    if zona:
        query["zona"] = zona
    spazi = await db.spazi.find(query, {"_id": 0}).to_list(500)
    occupati = await db.pratiche.find(
        {"stato": {"$in": STATI_ATTIVI}, "data_inizio": {"$lte": data_fine}, "data_fine": {"$gte": data_inizio}},
        {"_id": 0, "spazio_id": 1}).to_list(2000)
    busy = {o["spazio_id"] for o in occupati}
    return [s for s in spazi if s["id"] not in busy]

@api_router.get("/spazi/{spazio_id}")
async def get_spazio(spazio_id: str):
    spazio = await db.spazi.find_one({"id": spazio_id}, {"_id": 0})
    if not spazio:
        raise HTTPException(status_code=404, detail="Spazio non trovato")
    comune = await db.comuni.find_one({"id": spazio["comune_id"]}, {"_id": 0})
    return {**spazio, "comune": comune}

@api_router.get("/spazi/{spazio_id}/occupazioni")
async def occupazioni_spazio(spazio_id: str):
    rows = await db.pratiche.find({"spazio_id": spazio_id, "stato": {"$in": STATI_ATTIVI}},
                                  {"_id": 0, "data_inizio": 1, "data_fine": 1, "stato": 1}).to_list(200)
    return sorted(rows, key=lambda r: r["data_inizio"])

@api_router.get("/form-templates/comune/{comune_id}")
async def get_template(comune_id: str):
    tpl = await db.form_templates.find_one({"comune_id": comune_id}, {"_id": 0})
    if tpl:
        tpl.setdefault("documenti_richiesti", DOC_DEFAULT)
        return tpl
    return {"comune_id": comune_id, "nome": "Modulo standard", "campi": [], "documenti_richiesti": DOC_DEFAULT}

@api_router.get("/form-templates/spazio/{spazio_id}")
async def get_template_spazio(spazio_id: str):
    spazio = await db.spazi.find_one({"id": spazio_id}, {"_id": 0})
    if not spazio:
        raise HTTPException(status_code=404, detail="Spazio non trovato")
    tpl = None
    if spazio.get("form_template_id"):
        tpl = await db.form_templates.find_one({"id": spazio["form_template_id"]}, {"_id": 0})
    if not tpl:
        tpl = await db.form_templates.find_one({"comune_id": spazio["comune_id"]}, {"_id": 0})
    if tpl:
        tpl.setdefault("documenti_richiesti", DOC_DEFAULT)
        return tpl
    return {"comune_id": spazio["comune_id"], "nome": "Modulo standard", "campi": [], "documenti_richiesti": DOC_DEFAULT}

# ---------- pratiche (user) ----------

def _giorni(inizio: str, fine: str) -> int:
    d1 = datetime.fromisoformat(inizio)
    d2 = datetime.fromisoformat(fine)
    return max((d2 - d1).days + 1, 1)

STATI_ATTIVI = ["INVIATA", "IN_ISTRUTTORIA", "INTEGRAZIONE_RICHIESTA", "APPROVATA"]

async def _periodo_occupato(spazio_id: str, inizio: str, fine: str, exclude_id: Optional[str] = None) -> bool:
    query = {"spazio_id": spazio_id, "stato": {"$in": STATI_ATTIVI},
             "data_inizio": {"$lte": fine}, "data_fine": {"$gte": inizio}}
    if exclude_id:
        query["id"] = {"$ne": exclude_id}
    return await db.pratiche.find_one(query, {"_id": 0, "id": 1}) is not None

@api_router.post("/pratiche")
async def crea_pratica(data: PraticaIn, user: dict = Depends(require_role("user"))):
    spazio = await db.spazi.find_one({"id": data.spazio_id}, {"_id": 0})
    if not spazio:
        raise HTTPException(status_code=404, detail="Spazio non trovato")
    if await _periodo_occupato(spazio["id"], data.data_inizio, data.data_fine):
        raise HTTPException(status_code=409, detail="Periodo non disponibile: lo spazio è già impegnato in queste date")
    importo = round(_giorni(data.data_inizio, data.data_fine) * spazio["canone_giornaliero"], 2)
    tpl = await db.form_templates.find_one({"comune_id": spazio["comune_id"], "tipo": "OSP"}, {"_id": 0}) \
        or await db.form_templates.find_one({"comune_id": spazio["comune_id"]}, {"_id": 0}) or {"campi": []}
    pratica = {"id": str(uuid.uuid4()), "tipo": "OSP", "user_id": user["id"], "user_nome": user["nome"],
               "spazio_id": spazio["id"], "spazio_nome": spazio["nome"], "comune_id": spazio["comune_id"],
               "stato": "BOZZA", "dati_form": {**prefill_dati_form(tpl.get("campi", []), user),
                                               **{k: v for k, v in data.dati_form.items() if v not in (None, "")}},
               "documenti": [], "richiedente": snapshot_richiedente(user),
               "data_inizio": data.data_inizio, "data_fine": data.data_fine,
               "importo": importo, "pagata": False,
               "created_at": now_iso(), "updated_at": now_iso()}
    await db.pratiche.insert_one({**pratica})
    await log_stato(pratica["id"], None, "BOZZA", user, "Pratica creata")
    return pratica

@api_router.put("/pratiche/{pratica_id}")
async def aggiorna_pratica(pratica_id: str, data: PraticaUpdate, user: dict = Depends(require_role("user"))):
    pratica = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"]}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    if pratica["stato"] not in ("BOZZA", "INTEGRAZIONE_RICHIESTA"):
        raise HTTPException(status_code=400, detail="Pratica non modificabile in questo stato")
    updates: dict = {"updated_at": now_iso()}
    if data.dati_form is not None:
        updates["dati_form"] = data.dati_form
    if data.data_inizio and data.data_fine:
        if await _periodo_occupato(pratica["spazio_id"], data.data_inizio, data.data_fine, exclude_id=pratica_id):
            raise HTTPException(status_code=409, detail="Periodo non disponibile: lo spazio è già impegnato in queste date")
        spazio = await db.spazi.find_one({"id": pratica["spazio_id"]}, {"_id": 0})
        updates["data_inizio"] = data.data_inizio
        updates["data_fine"] = data.data_fine
        updates["importo"] = round(_giorni(data.data_inizio, data.data_fine) * spazio["canone_giornaliero"], 2)
    await db.pratiche.update_one({"id": pratica_id}, {"$set": updates})
    return await db.pratiche.find_one({"id": pratica_id}, {"_id": 0})

@api_router.post("/pratiche/{pratica_id}/documenti")
async def upload_documento(pratica_id: str, tipo: str = "documento", file: UploadFile = File(...),
                           user: dict = Depends(require_role("user"))):
    pratica = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"]}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    folder = UPLOAD_DIR / pratica_id
    folder.mkdir(exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    content = await file.read()
    (folder / safe_name).write_bytes(content)
    doc = {"id": str(uuid.uuid4()), "nome": file.filename, "tipo": tipo,
           "url": f"/api/uploads/{pratica_id}/{safe_name}", "uploaded_at": now_iso()}
    await db.pratiche.update_one({"id": pratica_id}, {"$push": {"documenti": doc}, "$set": {"updated_at": now_iso()}})
    return doc

@api_router.post("/pratiche/{pratica_id}/checkout")
async def checkout_mock(pratica_id: str, user: dict = Depends(require_role("user"))):
    pratica = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"]}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    tx = f"MOCK-{uuid.uuid4().hex[:10].upper()}"
    await db.pratiche.update_one({"id": pratica_id}, {"$set": {"pagata": True, "pagamento": {
        "metodo": "carta_mock", "transazione_id": tx,
        "importo": pratica["importo"], "data": now_iso()}, "updated_at": now_iso()}})
    return {"ok": True, "transazione_id": tx}

@api_router.post("/pratiche/{pratica_id}/invia")
async def invia_pratica(pratica_id: str, user: dict = Depends(require_role("user"))):
    pratica = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"]}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    if pratica["stato"] == "BOZZA":
        if not pratica["pagata"]:
            raise HTTPException(status_code=400, detail="Completa il pagamento prima di inviare")
        nuovo = "INVIATA"
        nota = "Pratica inviata dal richiedente"
    elif pratica["stato"] == "INTEGRAZIONE_RICHIESTA":
        nuovo = "IN_ISTRUTTORIA"
        nota = "Integrazione fornita dal richiedente"
    else:
        raise HTTPException(status_code=400, detail="Transizione non consentita")
    await db.pratiche.update_one({"id": pratica_id}, {"$set": {"stato": nuovo, "updated_at": now_iso()}})
    await log_stato(pratica_id, pratica["stato"], nuovo, user, nota)
    operatori = await db.users.find({"ruolo": "comune", "comune_id": pratica["comune_id"]}, {"_id": 0}).to_list(20)
    for op in operatori:
        await notifica(op["id"], "Nuova attività su pratica", f"Pratica '{pratica['spazio_nome']}' → {nuovo}", pratica_id)
    return {"ok": True, "stato": nuovo}

@api_router.get("/pratiche")
async def mie_pratiche(user: dict = Depends(get_current_user)):
    return await db.pratiche.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)

@api_router.delete("/pratiche/{pratica_id}")
async def elimina_pratica(pratica_id: str, user: dict = Depends(require_role("user"))):
    pratica = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"]}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    if pratica["stato"] != "BOZZA":
        raise HTTPException(status_code=400, detail="Solo le bozze possono essere eliminate")
    await db.pratiche.delete_one({"id": pratica_id})
    await db.log_stato.delete_many({"pratica_id": pratica_id})
    return {"ok": True}

@api_router.get("/pratiche/{pratica_id}")
async def get_pratica(pratica_id: str, user: dict = Depends(get_current_user)):
    pratica = await db.pratiche.find_one({"id": pratica_id}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    if user["ruolo"] == "user" and pratica["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    if user["ruolo"] == "comune" and pratica["comune_id"] != user.get("comune_id"):
        raise HTTPException(status_code=403, detail="Accesso negato")
    spazio = await db.spazi.find_one({"id": pratica["spazio_id"]}, {"_id": 0})
    comune = await db.comuni.find_one({"id": pratica["comune_id"]}, {"_id": 0})
    logs = await db.log_stato.find({"pratica_id": pratica_id}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    richiedente = pratica.get("richiedente")
    if not richiedente:
        u = await db.users.find_one({"id": pratica["user_id"]}, {"_id": 0, "password_hash": 0})
        richiedente = snapshot_richiedente(u) if u else {}
    prenotazione = None
    if pratica.get("prenotazione_id"):
        prenotazione = await db.prenotazioni.find_one({"id": pratica["prenotazione_id"]}, {"_id": 0})
    campagna = None
    if pratica.get("campagna_id"):
        campagna = await db.campagne.find_one({"id": pratica["campagna_id"]}, {"_id": 0})
    sog_ids = [a["soggetto_id"] for a in pratica.get("creativita", [])]
    sog_map = {}
    if sog_ids:
        soggetti = await db.soggetti.find({"id": {"$in": sog_ids}}, {"_id": 0}).to_list(100)
        sog_map = {s["id"]: s for s in soggetti}
    creativita_dettagli = [{"impianto_id": a["impianto_id"], "soggetto": sog_map.get(a["soggetto_id"])}
                           for a in pratica.get("creativita", [])]
    return {**pratica, "spazio": spazio, "comune": comune, "log_stato": logs,
            "richiedente": richiedente, "prenotazione": prenotazione,
            "campagna": campagna, "creativita_dettagli": creativita_dettagli}

# ---------- campagne (multi-spazio) ----------

@api_router.post("/campagne")
async def crea_campagna(data: CampagnaIn, user: dict = Depends(require_role("user"))):
    ids = list(dict.fromkeys(data.spazi_ids))
    if not ids:
        raise HTTPException(status_code=400, detail="Seleziona almeno uno spazio")
    spazi = await db.spazi.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)
    if len(spazi) != len(ids):
        raise HTTPException(status_code=404, detail="Uno o più spazi non trovati")
    non_disp = []
    for s in spazi:
        if await _periodo_occupato(s["id"], data.data_inizio, data.data_fine):
            non_disp.append(s["nome"])
    if non_disp:
        raise HTTPException(status_code=409, detail=f"Spazi non disponibili nel periodo: {', '.join(non_disp)}")
    giorni = _giorni(data.data_inizio, data.data_fine)
    campagna_id = str(uuid.uuid4())
    pratiche = []
    for s in spazi:
        tpl = await db.form_templates.find_one({"comune_id": s["comune_id"], "tipo": "OSP"}, {"_id": 0}) \
            or await db.form_templates.find_one({"comune_id": s["comune_id"]}, {"_id": 0}) or {"campi": []}
        pratica = {"id": str(uuid.uuid4()), "tipo": "OSP", "user_id": user["id"], "user_nome": user["nome"],
                   "spazio_id": s["id"], "spazio_nome": s["nome"], "comune_id": s["comune_id"],
                   "campagna_id": campagna_id, "campagna_nome": data.nome,
                   "richiedente": snapshot_richiedente(user),
                   "stato": "BOZZA", "dati_form": {**prefill_dati_form(tpl.get("campi", []), user),
                                                   "descrizione_contenuto": f"Campagna '{data.nome}'"},
                   "documenti": [], "data_inizio": data.data_inizio, "data_fine": data.data_fine,
                   "importo": round(giorni * s["canone_giornaliero"], 2), "pagata": False,
                   "created_at": now_iso(), "updated_at": now_iso()}
        await db.pratiche.insert_one({**pratica})
        await log_stato(pratica["id"], None, "BOZZA", user, f"Pratica creata dalla campagna '{data.nome}'")
        pratiche.append(pratica)
    campagna = {"id": campagna_id, "user_id": user["id"], "nome": data.nome,
                "data_inizio": data.data_inizio, "data_fine": data.data_fine,
                "spazi_ids": ids, "pratica_ids": [p["id"] for p in pratiche],
                "importo_totale": round(sum(p["importo"] for p in pratiche), 2),
                "created_at": now_iso()}
    await db.campagne.insert_one({**campagna})
    return {**campagna, "pratiche": pratiche}

async def _enrich_campagna(c: dict) -> dict:
    pratiche = await db.pratiche.find({"campagna_id": c["id"]}, {"_id": 0}).to_list(100)
    per_stato: dict = {}
    for p in pratiche:
        per_stato[p["stato"]] = per_stato.get(p["stato"], 0) + 1
    return {**c, "pratiche": pratiche, "per_stato": per_stato,
            "pagate": sum(1 for p in pratiche if p.get("pagata"))}

@api_router.get("/campagne")
async def mie_campagne(user: dict = Depends(require_role("user"))):
    camps = await db.campagne.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [await _enrich_campagna(c) for c in camps]

@api_router.get("/campagne/{campagna_id}")
async def get_campagna(campagna_id: str, user: dict = Depends(require_role("user"))):
    c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campagna non trovata")
    return await _enrich_campagna(c)

@api_router.put("/campagne/{campagna_id}/dati-form")
async def campagna_dati_form(campagna_id: str, data: CampagnaFormIn, user: dict = Depends(require_role("user"))):
    c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campagna non trovata")
    res = await db.pratiche.update_many(
        {"campagna_id": campagna_id, "id": {"$in": data.pratica_ids}, "stato": "BOZZA"},
        {"$set": {"dati_form": data.dati_form, "updated_at": now_iso()}})
    return {"ok": True, "aggiornate": res.modified_count}

@api_router.post("/campagne/{campagna_id}/checkout")
async def checkout_campagna(campagna_id: str, user: dict = Depends(require_role("user"))):
    c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campagna non trovata")
    tx = f"MOCK-{uuid.uuid4().hex[:10].upper()}"
    pratiche = await db.pratiche.find({"campagna_id": campagna_id, "pagata": False}, {"_id": 0}).to_list(100)
    for p in pratiche:
        await db.pratiche.update_one({"id": p["id"]}, {"$set": {
            "pagata": True,
            "pagamento": {"metodo": "carta_mock", "transazione_id": tx, "importo": p["importo"], "data": now_iso()},
            "updated_at": now_iso()}})
    return {"ok": True, "transazione_id": tx, "pratiche_pagate": len(pratiche),
            "importo_totale": c["importo_totale"]}

@api_router.post("/campagne/{campagna_id}/invia")
async def invia_campagna(campagna_id: str, user: dict = Depends(require_role("user"))):
    c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campagna non trovata")
    pratiche = await db.pratiche.find({"campagna_id": campagna_id, "stato": "BOZZA"}, {"_id": 0}).to_list(100)
    non_pagate = [p for p in pratiche if not p["pagata"]]
    if non_pagate:
        raise HTTPException(status_code=400, detail="Completa il pagamento prima di inviare")
    inviate = 0
    for p in pratiche:
        await db.pratiche.update_one({"id": p["id"]}, {"$set": {"stato": "INVIATA", "updated_at": now_iso()}})
        await log_stato(p["id"], "BOZZA", "INVIATA", user, f"Inviata dalla campagna '{c['nome']}'")
        operatori = await db.users.find({"ruolo": "comune", "comune_id": p["comune_id"]}, {"_id": 0}).to_list(20)
        for op in operatori:
            await notifica(op["id"], "Nuova pratica da campagna", f"Pratica '{p['spazio_nome']}' → INVIATA", p["id"])
        inviate += 1
    return {"ok": True, "inviate": inviate}

# ---------- chat ----------

@api_router.get("/pratiche/{pratica_id}/chat")
async def get_chat(pratica_id: str, user: dict = Depends(get_current_user)):
    return await db.chat.find({"pratica_id": pratica_id}, {"_id": 0}).sort("created_at", 1).to_list(500)

@api_router.post("/pratiche/{pratica_id}/chat")
async def post_chat(pratica_id: str, data: ChatIn, user: dict = Depends(get_current_user)):
    pratica = await db.pratiche.find_one({"id": pratica_id}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    msg = {"id": str(uuid.uuid4()), "pratica_id": pratica_id, "autore_id": user["id"],
           "autore_nome": user["nome"], "autore_ruolo": user["ruolo"], "testo": data.testo,
           "created_at": now_iso()}
    await db.chat.insert_one({**msg})
    if user["ruolo"] == "user":
        operatori = await db.users.find({"ruolo": "comune", "comune_id": pratica["comune_id"]}, {"_id": 0}).to_list(20)
        for op in operatori:
            await notifica(op["id"], "Nuovo messaggio", f"Messaggio sulla pratica '{pratica['spazio_nome']}'", pratica_id)
    else:
        await notifica(pratica["user_id"], "Nuovo messaggio dal Comune", f"Messaggio sulla pratica '{pratica['spazio_nome']}'", pratica_id)
    return msg

# ---------- notifiche ----------

@api_router.get("/notifiche")
async def get_notifiche(user: dict = Depends(get_current_user)):
    return await db.notifiche.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.post("/notifiche/leggi")
async def leggi_notifiche(user: dict = Depends(get_current_user)):
    await db.notifiche.update_many({"user_id": user["id"]}, {"$set": {"letta": True}})
    return {"ok": True}

# ---------- comune backoffice ----------

@api_router.get("/comune/profilo")
async def comune_profilo(user: dict = Depends(require_role("comune"))):
    return await db.comuni.find_one({"id": user["comune_id"]}, {"_id": 0})

@api_router.get("/comune/spazi")
async def comune_spazi(user: dict = Depends(require_role("comune"))):
    return await db.spazi.find({"comune_id": user["comune_id"]}, {"_id": 0}).to_list(200)

@api_router.post("/comune/spazi")
async def crea_spazio(data: SpazioIn, user: dict = Depends(require_comune_l3)):
    comune = await db.comuni.find_one({"id": user["comune_id"]}, {"_id": 0})
    spazio = {"id": str(uuid.uuid4()), "comune_id": comune["id"], "citta": comune["nome"],
              "regione": comune["regione"], **data.model_dump(),
              "tipologia": "Progetto Speciale", "formato": "Area su misura",
              "dimensioni": "Area su misura", "disponibile": True,
              "created_at": now_iso()}
    await db.spazi.insert_one({**spazio})
    return spazio

@api_router.put("/comune/spazi/{spazio_id}")
async def aggiorna_spazio(spazio_id: str, data: SpazioIn, user: dict = Depends(require_comune_l3)):
    res = await db.spazi.update_one({"id": spazio_id, "comune_id": user["comune_id"]},
                                    {"$set": {**data.model_dump(), "tipologia": "Progetto Speciale",
                                              "formato": "Area su misura", "dimensioni": "Area su misura"}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Spazio non trovato")
    return await db.spazi.find_one({"id": spazio_id}, {"_id": 0})

@api_router.delete("/comune/spazi/{spazio_id}")
async def elimina_spazio(spazio_id: str, user: dict = Depends(require_comune_l3)):
    res = await db.spazi.delete_one({"id": spazio_id, "comune_id": user["comune_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Spazio non trovato")
    return {"ok": True}

@api_router.get("/comune/form-templates")
async def comune_templates(user: dict = Depends(require_role("comune"))):
    tpls = await db.form_templates.find({"comune_id": user["comune_id"]}, {"_id": 0}).to_list(50)
    for t in tpls:
        t.setdefault("documenti_richiesti", DOC_DEFAULT)
    return tpls

@api_router.post("/comune/form-templates")
async def crea_template(data: TemplateIn, user: dict = Depends(require_comune_l3)):
    campi_unici = list({c.id: c for c in data.campi}.values())
    tpl = {"id": str(uuid.uuid4()), "comune_id": user["comune_id"], "nome": data.nome,
           "campi": [c.model_dump() for c in campi_unici],
           "documenti_richiesti": [d.model_dump() for d in data.documenti_richiesti],
           "updated_at": now_iso()}
    await db.form_templates.insert_one({**tpl})
    return tpl

@api_router.put("/comune/form-templates/{tid}")
async def salva_template(tid: str, data: TemplateIn, user: dict = Depends(require_comune_l3)):
    campi_unici = list({c.id: c for c in data.campi}.values())
    updates = {"nome": data.nome, "campi": [c.model_dump() for c in campi_unici],
               "documenti_richiesti": [d.model_dump() for d in data.documenti_richiesti],
               "updated_at": now_iso()}
    res = await db.form_templates.update_one({"id": tid, "comune_id": user["comune_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Modulo non trovato")
    return await db.form_templates.find_one({"id": tid}, {"_id": 0})

@api_router.delete("/comune/form-templates/{tid}")
async def elimina_template(tid: str, user: dict = Depends(require_comune_l3)):
    res = await db.form_templates.delete_one({"id": tid, "comune_id": user["comune_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Modulo non trovato")
    await db.spazi.update_many({"form_template_id": tid}, {"$set": {"form_template_id": None}})
    return {"ok": True}

@api_router.post("/comune/spazi/upload-foto")
async def upload_foto_spazio(file: UploadFile = File(...), user: dict = Depends(require_comune_l3)):
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp"):
        raise HTTPException(status_code=400, detail="Formato non supportato (JPG, PNG, WebP)")
    folder = UPLOAD_DIR / "spazi"
    folder.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex[:10]}.{ext}"
    (folder / name).write_bytes(await file.read())
    return {"url": f"/api/uploads/spazi/{name}"}

@api_router.get("/comune/report/spazi")
async def report_per_spazio(user: dict = Depends(require_role("comune"))):
    spazi = await db.spazi.find({"comune_id": user["comune_id"]}, {"_id": 0}).to_list(200)
    pratiche = await db.pratiche.find({"comune_id": user["comune_id"], "stato": {"$ne": "BOZZA"}}, {"_id": 0}).to_list(2000)
    result = []
    for s in spazi:
        mie = [p for p in pratiche if p["spazio_id"] == s["id"]]
        pagate = [p for p in mie if p.get("pagata")]
        result.append({"spazio_id": s["id"], "nome": s["nome"], "tipologia": s["tipologia"], "formato": s.get("formato", ""),
                       "incassato": round(sum(p["importo"] for p in pagate), 2),
                       "pratiche_pagate": len(pagate), "pratiche_totali": len(mie),
                       "storico": [{"data": p["created_at"][:10], "importo": p["importo"], "user_nome": p["user_nome"],
                                    "stato": p["stato"], "periodo": f"{p['data_inizio']} → {p['data_fine']}"}
                                   for p in sorted(mie, key=lambda x: x["created_at"], reverse=True)]})
    return sorted(result, key=lambda r: -r["incassato"])

@api_router.get("/comune/pratiche")
async def comune_pratiche(stato: Optional[str] = None, tipo: Optional[str] = None,
                          user: dict = Depends(require_role("comune"))):
    query: dict = {"comune_id": user["comune_id"],
                   "stato": {"$nin": ["BOZZA", "DA_COMPLETARE", "PRENOTAZIONE_SCADUTA"]},
                   "$or": [{"stato": {"$ne": "ANNULLATA"}}, {"annullata_da": "comune"}]}
    if stato:
        query["stato"] = stato
    if tipo:
        query["tipo"] = tipo
    return await db.pratiche.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)

TRANSIZIONI_COMUNE = {
    "presa_in_carico": {"da": ["INVIATA"], "a": "IN_ISTRUTTORIA"},
    "richiedi_integrazione": {"da": ["IN_ISTRUTTORIA"], "a": "INTEGRAZIONE_RICHIESTA"},
    "approva": {"da": ["IN_ISTRUTTORIA"], "a": "APPROVATA"},
    "rifiuta": {"da": ["IN_ISTRUTTORIA"], "a": "RIFIUTATA"},
    "annulla": {"da": ["IN_ISTRUTTORIA"], "a": "ANNULLATA"},
}

TRANSIZIONI_OOH = {
    "presa_in_carico": {"da": ["INVIATA"], "a": "IN_VERIFICA"},
    "richiedi_integrazione": {"da": ["IN_VERIFICA"], "a": "INTEGRAZIONE_RICHIESTA"},
    "approva": {"da": ["IN_VERIFICA"], "a": "APPROVATA"},
    "rifiuta": {"da": ["IN_VERIFICA"], "a": "RIFIUTATA"},
    "annulla": {"da": ["IN_VERIFICA"], "a": "ANNULLATA"},
}

LIVELLO_MIN_AZIONE = {"presa_in_carico": 1, "richiedi_integrazione": 1, "approva": 2, "rifiuta": 2, "annulla": 2}

@api_router.post("/comune/pratiche/{pratica_id}/transizione")
async def transizione(pratica_id: str, data: TransizioneIn, user: dict = Depends(require_role("comune"))):
    pratica = await db.pratiche.find_one({"id": pratica_id, "comune_id": user["comune_id"]}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    regola = (TRANSIZIONI_OOH if pratica.get("tipo") == "OOH" else TRANSIZIONI_COMUNE).get(data.azione)
    if not regola:
        raise HTTPException(status_code=400, detail="Azione non valida")
    comune_doc = await db.comuni.find_one({"id": user["comune_id"]}, {"_id": 0, "livelli_attivi": 1})
    livelli_attivi = (comune_doc or {}).get("livelli_attivi") or [1, 2, 3]
    max_lv = max(livelli_attivi)
    min_richiesto = min(LIVELLO_MIN_AZIONE[data.azione], max_lv)
    if user.get("livello", 1) < min_richiesto:
        raise HTTPException(status_code=403, detail=f"Azione riservata al livello L{min_richiesto} o superiore")
    if data.azione in ("richiedi_integrazione", "annulla") and not (data.nota or "").strip():
        raise HTTPException(status_code=400, detail="La motivazione è obbligatoria per questa azione")
    if pratica["stato"] not in regola["da"]:
        raise HTTPException(status_code=400, detail=f"Transizione non consentita da {pratica['stato']}")
    nuovo = regola["a"]
    updates = {"stato": nuovo, "updated_at": now_iso()}
    if nuovo == "APPROVATA":
        updates["numero_autorizzazione"] = f"AUT-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
        updates["data_approvazione"] = now_iso()
    if nuovo == "ANNULLATA":
        updates["annullata_da"] = "comune"
    if nuovo in ("ANNULLATA", "RIFIUTATA") and pratica.get("prenotazione_id"):
        await db.prenotazioni.update_one({"id": pratica["prenotazione_id"]}, {"$set": {"stato": "CANCELLED"}})
    await db.pratiche.update_one({"id": pratica_id}, {"$set": updates})
    await log_stato(pratica_id, pratica["stato"], nuovo, user, data.nota)
    labels = {"IN_ISTRUTTORIA": "La tua pratica è in istruttoria",
              "IN_VERIFICA": "La tua pratica è in verifica",
              "INTEGRAZIONE_RICHIESTA": "Richiesta integrazione documenti",
              "APPROVATA": "Pratica approvata! Autorizzazione disponibile",
              "RIFIUTATA": "Pratica rifiutata",
              "ANNULLATA": "Pratica annullata dal Comune"}
    await notifica(pratica["user_id"], labels[nuovo],
                   f"Pratica '{pratica['spazio_nome']}': {data.nota or labels[nuovo]}", pratica_id)
    return {"ok": True, "stato": nuovo}

@api_router.get("/comune/report")
async def comune_report(user: dict = Depends(require_role("comune"))):
    cid = user["comune_id"]
    pratiche = await db.pratiche.find({"comune_id": cid, "stato": {"$ne": "BOZZA"}}, {"_id": 0}).to_list(1000)
    per_stato: dict = {}
    incassi_mese: dict = {}
    incassi_totali = 0.0
    for p in pratiche:
        per_stato[p["stato"]] = per_stato.get(p["stato"], 0) + 1
        if p.get("pagata"):
            incassi_totali += p["importo"]
            mese = p["created_at"][:7]
            incassi_mese[mese] = incassi_mese.get(mese, 0) + p["importo"]
    spazi_count = await db.spazi.count_documents({"comune_id": cid})
    return {"pratiche_totali": len(pratiche), "per_stato": per_stato,
            "incassi_totali": round(incassi_totali, 2),
            "incassi_mese": [{"mese": k, "importo": round(v, 2)} for k, v in sorted(incassi_mese.items())],
            "spazi_totali": spazi_count,
            "approvate": per_stato.get("APPROVATA", 0), "rifiutate": per_stato.get("RIFIUTATA", 0)}

# ---------- PDF autorizzazione ----------

@api_router.get("/pratiche/{pratica_id}/autorizzazione")
async def pdf_autorizzazione(pratica_id: str, user: dict = Depends(get_current_user)):
    pratica = await db.pratiche.find_one({"id": pratica_id}, {"_id": 0})
    if not pratica or pratica["stato"] != "APPROVATA":
        raise HTTPException(status_code=404, detail="Autorizzazione non disponibile")
    if user["ruolo"] == "user" and pratica["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    comune = await db.comuni.find_one({"id": pratica["comune_id"]}, {"_id": 0})
    spazio = await db.spazi.find_one({"id": pratica["spazio_id"]}, {"_id": 0})
    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, h - 70, f"COMUNE DI {comune['nome'].upper()}")
    c.setFont("Helvetica", 11)
    c.drawString(50, h - 90, "Ufficio Pubblicità e Occupazione Suolo Pubblico")
    c.line(50, h - 105, w - 50, h - 105)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(50, h - 140, f"AUTORIZZAZIONE N. {pratica.get('numero_autorizzazione', 'N/D')}")
    c.setFont("Helvetica", 11)
    y = h - 180
    righe = [
        f"Richiedente: {pratica['user_nome']}",
        f"Spazio: {spazio['nome']} - {spazio['indirizzo']}",
        f"Tipologia: {spazio['tipologia']}",
        f"Periodo: dal {pratica['data_inizio'][:10]} al {pratica['data_fine'][:10]}",
        f"Importo corrisposto: EUR {pratica['importo']:.2f}",
        f"Data approvazione: {pratica.get('data_approvazione', '')[:10]}",
        "",
        "Si autorizza l'installazione pubblicitaria / occupazione del suolo pubblico",
        "come da istanza presentata, nel rispetto del regolamento comunale vigente.",
        "",
        "DOCUMENTO DEMO - NON VALIDO AI FINI LEGALI",
    ]
    for r in righe:
        c.drawString(50, y, r)
        y -= 22
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(50, 80, f"Generato da Outdoor Planner il {now_iso()[:10]}")
    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=autorizzazione_{pratica_id[:8]}.pdf"})

# ---------- superadmin ----------

@api_router.get("/admin/kpi")
async def admin_kpi(user: dict = Depends(require_role("superadmin"))):
    utenti = await db.users.count_documents({"ruolo": "user"})
    comuni = await db.comuni.count_documents({})
    spazi = await db.spazi.count_documents({})
    pratiche = await db.pratiche.find({"stato": {"$ne": "BOZZA"}}, {"_id": 0}).to_list(2000)
    per_stato: dict = {}
    revenue = 0.0
    per_comune: dict = {}
    for p in pratiche:
        per_stato[p["stato"]] = per_stato.get(p["stato"], 0) + 1
        if p.get("pagata"):
            revenue += p["importo"]
        per_comune[p["comune_id"]] = per_comune.get(p["comune_id"], 0) + 1
    comuni_docs = await db.comuni.find({}, {"_id": 0}).to_list(200)
    nomi = {c["id"]: c["nome"] for c in comuni_docs}
    held = await db.prenotazioni.count_documents({"stato": "HELD"})
    confirmed = await db.prenotazioni.count_documents({"stato": "CONFIRMED"})
    expired = await db.prenotazioni.count_documents({"stato": "EXPIRED"})
    campagne_ooh = await db.campagne.find({"tipo": "OOH"}, {"_id": 0, "pratica_ids": 1, "pacchetti_ids": 1, "id": 1}).to_list(1000)
    multicomune = 0
    for c in campagne_ooh:
        cids = await db.pratiche.distinct("comune_id", {"campagna_id": c["id"]})
        if len(cids) > 1:
            multicomune += 1
    return {"utenti": utenti, "comuni": comuni, "spazi": spazi,
            "zone": await db.zone.count_documents({}),
            "impianti": await db.impianti.count_documents({}),
            "pacchetti": await db.pacchetti.count_documents({}),
            "held": held, "confirmed": confirmed, "expired": expired,
            "conversione_hold": round(confirmed / (confirmed + expired) * 100, 1) if (confirmed + expired) else 0,
            "campagne_ooh": len(campagne_ooh), "campagne_multicomune": multicomune,
            "pratiche_totali": len(pratiche), "per_stato": per_stato,
            "revenue_totale": round(revenue, 2),
            "pratiche_per_comune": [{"comune": nomi.get(k, k), "count": v} for k, v in per_comune.items()]}

async def _calc_anomalie(match: dict):
    ora = datetime.now(timezone.utc)
    anomalie = []
    pratiche = await db.pratiche.find({**match, "stato": {"$in": ["INVIATA", "IN_ISTRUTTORIA"]}}, {"_id": 0}).to_list(1000)
    for p in pratiche:
        updated = datetime.fromisoformat(p["updated_at"])
        giorni = (ora - updated).days
        if p["stato"] == "INVIATA" and giorni >= 3:
            anomalie.append({"tipo": "PRESA_IN_CARICO_LENTA", "pratica_id": p["id"],
                             "descrizione": f"Pratica '{p['spazio_nome']}' inviata da {giorni} giorni senza presa in carico"})
        if p["stato"] == "IN_ISTRUTTORIA" and giorni >= 7:
            anomalie.append({"tipo": "ISTRUTTORIA_LENTA", "pratica_id": p["id"],
                             "descrizione": f"Pratica '{p['spazio_nome']}' in istruttoria da {giorni} giorni"})
    return anomalie

@api_router.get("/admin/anomalie")
async def admin_anomalie(user: dict = Depends(require_role("superadmin"))):
    return await _calc_anomalie({})

@api_router.get("/comune/anomalie")
async def comune_anomalie(user: dict = Depends(require_comune_l3)):
    return await _calc_anomalie({"comune_id": user["comune_id"]})

@api_router.post("/admin/upload-logo")
async def upload_logo(file: UploadFile = File(...), user: dict = Depends(require_role("superadmin"))):
    ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
    if ext not in ("png", "svg", "jpg", "jpeg", "webp"):
        raise HTTPException(status_code=400, detail="Formato non supportato (PNG, SVG)")
    folder = UPLOAD_DIR / "loghi"
    folder.mkdir(exist_ok=True)
    name = f"{uuid.uuid4().hex[:10]}.{ext}"
    (folder / name).write_bytes(await file.read())
    return {"url": f"/api/uploads/loghi/{name}"}

@api_router.get("/admin/comuni")
async def admin_comuni(user: dict = Depends(require_role("superadmin"))):
    comuni = await db.comuni.find({}, {"_id": 0}).to_list(200)
    pratiche = await db.pratiche.find({"stato": {"$ne": "BOZZA"}}, {"_id": 0}).to_list(5000)
    result = []
    for c in comuni:
        mie = [p for p in pratiche if p["comune_id"] == c["id"]]
        incasso = round(sum(p["importo"] for p in mie if p.get("pagata")), 2)
        result.append({**c,
                       "spazi_count": await db.spazi.count_documents({"comune_id": c["id"]}),
                       "spazi_attivi": await db.spazi.count_documents({"comune_id": c["id"], "disponibile": True}),
                       "zone_count": await db.zone.count_documents({"comune_id": c["id"]}),
                       "impianti_count": await db.impianti.count_documents({"comune_id": c["id"]}),
                       "pacchetti_count": await db.pacchetti.count_documents({"comune_id": c["id"]}),
                       "campagne_count": len(await db.pratiche.distinct("campagna_id", {"comune_id": c["id"], "campagna_id": {"$ne": None}})),
                       "pratiche_count": len(mie),
                       "approvate": sum(1 for p in mie if p["stato"] == "APPROVATA"),
                       "incasso_totale": incasso,
                       "incasso_piattaforma": round(incasso * 0.05, 2)})
    return result

@api_router.get("/admin/comuni/{comune_id}/report")
async def admin_report_comune(comune_id: str, user: dict = Depends(require_role("superadmin"))):
    comune = await db.comuni.find_one({"id": comune_id}, {"_id": 0})
    if not comune:
        raise HTTPException(status_code=404, detail="Comune non trovato")
    pratiche = await db.pratiche.find({"comune_id": comune_id, "stato": {"$ne": "BOZZA"}}, {"_id": 0}).to_list(2000)
    per_stato: dict = {}
    incassi_mese: dict = {}
    incasso = 0.0
    for p in pratiche:
        per_stato[p["stato"]] = per_stato.get(p["stato"], 0) + 1
        if p.get("pagata"):
            incasso += p["importo"]
            mese = p["created_at"][:7]
            incassi_mese[mese] = incassi_mese.get(mese, 0) + p["importo"]
    return {"comune": comune, "pratiche_totali": len(pratiche), "per_stato": per_stato,
            "incasso_totale": round(incasso, 2), "incasso_piattaforma": round(incasso * 0.05, 2),
            "incassi_mese": [{"mese": k, "importo": round(v, 2)} for k, v in sorted(incassi_mese.items())],
            "ultime_pratiche": [{"spazio_nome": p["spazio_nome"], "user_nome": p["user_nome"], "stato": p["stato"],
                                 "importo": p["importo"], "data": p["created_at"][:10]}
                                for p in sorted(pratiche, key=lambda x: x["created_at"], reverse=True)[:10]]}

@api_router.post("/admin/comuni")
async def onboard_comune(data: ComuneOnboardIn, user: dict = Depends(require_role("superadmin"))):
    livelli = sorted(set(data.livelli_attivi)) or [1]
    if any(l not in (1, 2, 3) for l in livelli):
        raise HTTPException(status_code=400, detail="Livelli ammessi: 1, 2, 3")
    if not data.utenze:
        raise HTTPException(status_code=400, detail="Aggiungi almeno un'utenza comunale")
    for u in data.utenze:
        if u.livello not in livelli:
            raise HTTPException(status_code=400, detail=f"L'utenza {u.email} usa il livello L{u.livello} non attivato per il Comune")
        if await db.users.find_one({"email": u.email.lower().strip()}):
            raise HTTPException(status_code=400, detail=f"Email già registrata: {u.email}")
    comune = {"id": str(uuid.uuid4()), "nome": data.nome, "regione": data.regione,
              "provincia": data.provincia, "lat": data.lat, "lng": data.lng, "logo_url": data.logo_url,
              "stato_onboarding": "ATTIVO", "livelli_attivi": livelli,
              "tariffe": [], "regole": "Regolamento comunale standard", "attivo": True, "created_at": now_iso()}
    await db.comuni.insert_one({**comune})
    utenti = []
    for u in data.utenze:
        doc = {"id": str(uuid.uuid4()), "email": u.email.lower().strip(), "nome": u.nome,
               "ruolo": "comune", "comune_id": comune["id"], "livello": u.livello, "attivo": True,
               "created_at": now_iso()}
        await db.users.insert_one({**doc, "password_hash": hash_password(u.password)})
        utenti.append(doc)
    return {"comune": comune, "utenti": utenti}

@api_router.get("/admin/comuni/{comune_id}/utenti")
async def utenti_comune(comune_id: str, user: dict = Depends(require_role("superadmin"))):
    return await db.users.find({"ruolo": "comune", "comune_id": comune_id},
                               {"_id": 0, "password_hash": 0}).sort("livello", 1).to_list(100)

@api_router.post("/admin/comuni/{comune_id}/utenti")
async def crea_utente_comune(comune_id: str, data: UtenzaIn, user: dict = Depends(require_role("superadmin"))):
    comune = await db.comuni.find_one({"id": comune_id}, {"_id": 0})
    if not comune:
        raise HTTPException(status_code=404, detail="Comune non trovato")
    if data.livello not in comune.get("livelli_attivi", [1, 2, 3]):
        raise HTTPException(status_code=400, detail=f"Livello L{data.livello} non attivo per questo Comune")
    if await db.users.find_one({"email": data.email.lower().strip()}):
        raise HTTPException(status_code=400, detail="Email già registrata")
    doc = {"id": str(uuid.uuid4()), "email": data.email.lower().strip(), "nome": data.nome,
           "ruolo": "comune", "comune_id": comune_id, "livello": data.livello, "attivo": True, "created_at": now_iso()}
    await db.users.insert_one({**doc, "password_hash": hash_password(data.password)})
    return doc

@api_router.patch("/admin/utenti/{utente_id}")
async def patch_utente(utente_id: str, body: dict, user: dict = Depends(require_role("superadmin"))):
    updates = {}
    if "attivo" in body:
        updates["attivo"] = bool(body["attivo"])
    if "livello" in body:
        if body["livello"] not in (1, 2, 3):
            raise HTTPException(status_code=400, detail="Livello non valido")
        updates["livello"] = body["livello"]
    if not updates:
        raise HTTPException(status_code=400, detail="Nessuna modifica")
    res = await db.users.update_one({"id": utente_id, "ruolo": "comune"}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return {"ok": True, **updates}

STATI_ONBOARDING = ["DA_CONFIGURARE", "IN_CONFIGURAZIONE", "ATTIVO", "SOSPESO", "DISATTIVATO"]

@api_router.patch("/admin/comuni/{comune_id}/stato")
async def stato_comune(comune_id: str, body: dict, user: dict = Depends(require_role("superadmin"))):
    stato = body.get("stato_onboarding")
    if stato not in STATI_ONBOARDING:
        raise HTTPException(status_code=400, detail=f"Stato non valido. Ammessi: {', '.join(STATI_ONBOARDING)}")
    res = await db.comuni.update_one({"id": comune_id}, {"$set": {"stato_onboarding": stato}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Comune non trovato")
    return {"ok": True, "stato_onboarding": stato}

@api_router.put("/admin/comuni/{comune_id}")
async def aggiorna_comune(comune_id: str, data: ComuneUpdateIn, user: dict = Depends(require_role("superadmin"))):
    comune = await db.comuni.find_one({"id": comune_id}, {"_id": 0})
    if not comune:
        raise HTTPException(status_code=404, detail="Comune non trovato")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.comuni.update_one({"id": comune_id}, {"$set": updates})
        spazi_updates = {}
        if "nome" in updates:
            spazi_updates["citta"] = updates["nome"]
        if "regione" in updates:
            spazi_updates["regione"] = updates["regione"]
        if spazi_updates:
            await db.spazi.update_many({"comune_id": comune_id}, {"$set": spazi_updates})
    return await db.comuni.find_one({"id": comune_id}, {"_id": 0})

@api_router.delete("/admin/comuni/{comune_id}")
async def elimina_comune(comune_id: str, user: dict = Depends(require_role("superadmin"))):
    comune = await db.comuni.find_one({"id": comune_id}, {"_id": 0})
    if not comune:
        raise HTTPException(status_code=404, detail="Comune non trovato")
    pratiche = await db.pratiche.find({"comune_id": comune_id}, {"_id": 0, "id": 1}).to_list(5000)
    pids = [p["id"] for p in pratiche]
    if pids:
        await db.log_stato.delete_many({"pratica_id": {"$in": pids}})
        await db.chat.delete_many({"pratica_id": {"$in": pids}})
        await db.pratiche.delete_many({"id": {"$in": pids}})
    spazi_res = await db.spazi.delete_many({"comune_id": comune_id})
    await db.form_templates.delete_many({"comune_id": comune_id})
    await db.zone.delete_many({"comune_id": comune_id})
    await db.impianti.delete_many({"comune_id": comune_id})
    await db.pacchetti.delete_many({"comune_id": comune_id})
    await db.prenotazioni.delete_many({"comune_id": comune_id})
    utenti_res = await db.users.delete_many({"ruolo": "comune", "comune_id": comune_id})
    await db.comuni.delete_one({"id": comune_id})
    return {"ok": True, "pratiche_eliminate": len(pids), "spazi_eliminati": spazi_res.deleted_count,
            "utenti_eliminati": utenti_res.deleted_count}

# ---------- app setup ----------

from ooh import build as build_ooh, snapshot_richiedente, prefill_dati_form
ooh_router, expire_holds = build_ooh(db, get_current_user, require_role, require_comune_l3,
                                     notifica, log_stato, now_iso, UPLOAD_DIR)
api_router.include_router(ooh_router)

app.include_router(api_router)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.pratiche.create_index("user_id")
    await db.pratiche.create_index("comune_id")
    await db.prenotazioni.create_index("stato")
    from seed import seed_all, ensure_livelli, ensure_catalogo
    await seed_all(db, hash_password)
    await ensure_livelli(db, hash_password)
    await ensure_catalogo(db)

    import asyncio
    async def _expire_loop():
        while True:
            try:
                await expire_holds()
            except Exception as e:
                logger.error(f"expire_holds error: {e}")
            await asyncio.sleep(60)
    asyncio.create_task(_expire_loop())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
