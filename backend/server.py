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
    if user.get("livello", 1) < 3:
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
    tipologia: str
    formato: str = ""
    indirizzo: str
    lat: float
    lng: float
    canone_giornaliero: float
    dimensioni: str = ""
    descrizione: str = ""
    disponibile: bool = True
    foto_url: str = ""

class CampoTemplate(BaseModel):
    id: str
    label: str
    tipo: str = "text"
    opzioni: List[str] = []
    required: bool = False
    condizione: Optional[dict] = None

class TemplateIn(BaseModel):
    nome: str
    campi: List[CampoTemplate]

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
    comune_id: str
    dati_form: dict


class ComuneOnboardIn(BaseModel):
    nome: str
    regione: str
    provincia: str
    lat: float
    lng: float
    referente_email: str
    referente_password: str
    referente_nome: str

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

@api_router.post("/auth/spid")
async def spid_mock():
    email = "spid.demo@demo.it"
    doc = await db.users.find_one({"email": email})
    if not doc:
        user = {"id": str(uuid.uuid4()), "email": email, "nome": "Mario Rossi (SPID)", "ruolo": "user",
                "comune_id": None, "created_at": now_iso()}
        await db.users.insert_one({**user, "password_hash": hash_password(str(uuid.uuid4()))})
    else:
        user = {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
    token = create_access_token(user["id"], email, "user")
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
    return await db.comuni.find({}, {"_id": 0}).to_list(200)

@api_router.get("/spazi")
async def list_spazi(regione: Optional[str] = None, citta: Optional[str] = None,
                     tipologia: Optional[str] = None, formato: Optional[str] = None,
                     prezzo_max: Optional[float] = None,
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
    if prezzo_max is not None:
        query["canone_giornaliero"] = {"$lte": prezzo_max}
    if disponibile is not None:
        query["disponibile"] = disponibile
    if q:
        query["$or"] = [{"nome": {"$regex": q, "$options": "i"}},
                        {"indirizzo": {"$regex": q, "$options": "i"}},
                        {"citta": {"$regex": q, "$options": "i"}}]
    return await db.spazi.find(query, {"_id": 0}).to_list(500)

@api_router.get("/spazi/disponibili")
async def spazi_disponibili(data_inizio: str, data_fine: str, regione: Optional[str] = None,
                            citta: Optional[str] = None, tipologia: Optional[str] = None,
                            formato: Optional[str] = None):
    query: dict = {"disponibile": True}
    if regione:
        query["regione"] = regione
    if citta:
        query["citta"] = citta
    if tipologia:
        query["tipologia"] = tipologia
    if formato:
        query["formato"] = formato
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
    return tpl or {"comune_id": comune_id, "nome": "Modulo standard", "campi": []}

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
    pratica = {"id": str(uuid.uuid4()), "user_id": user["id"], "user_nome": user["nome"],
               "spazio_id": spazio["id"], "spazio_nome": spazio["nome"], "comune_id": spazio["comune_id"],
               "stato": "BOZZA", "dati_form": data.dati_form, "documenti": [],
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
    return {**pratica, "spazio": spazio, "comune": comune, "log_stato": logs}

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
        pratica = {"id": str(uuid.uuid4()), "user_id": user["id"], "user_nome": user["nome"],
                   "spazio_id": s["id"], "spazio_nome": s["nome"], "comune_id": s["comune_id"],
                   "campagna_id": campagna_id, "campagna_nome": data.nome,
                   "stato": "BOZZA", "dati_form": {"descrizione_contenuto": f"Campagna '{data.nome}'"},
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
        {"campagna_id": campagna_id, "comune_id": data.comune_id, "stato": "BOZZA"},
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

@api_router.put("/comune/profilo")
async def aggiorna_profilo(data: ComuneProfiloIn, user: dict = Depends(require_comune_l3)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.comuni.update_one({"id": user["comune_id"]}, {"$set": updates})
    return await db.comuni.find_one({"id": user["comune_id"]}, {"_id": 0})

@api_router.get("/comune/spazi")
async def comune_spazi(user: dict = Depends(require_role("comune"))):
    return await db.spazi.find({"comune_id": user["comune_id"]}, {"_id": 0}).to_list(200)

@api_router.post("/comune/spazi")
async def crea_spazio(data: SpazioIn, user: dict = Depends(require_comune_l3)):
    comune = await db.comuni.find_one({"id": user["comune_id"]}, {"_id": 0})
    spazio = {"id": str(uuid.uuid4()), "comune_id": comune["id"], "citta": comune["nome"],
              "regione": comune["regione"], **data.model_dump(), "dimensioni": data.formato,
              "created_at": now_iso()}
    await db.spazi.insert_one({**spazio})
    return spazio

@api_router.put("/comune/spazi/{spazio_id}")
async def aggiorna_spazio(spazio_id: str, data: SpazioIn, user: dict = Depends(require_comune_l3)):
    res = await db.spazi.update_one({"id": spazio_id, "comune_id": user["comune_id"]}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Spazio non trovato")
    return await db.spazi.find_one({"id": spazio_id}, {"_id": 0})

@api_router.delete("/comune/spazi/{spazio_id}")
async def elimina_spazio(spazio_id: str, user: dict = Depends(require_comune_l3)):
    res = await db.spazi.delete_one({"id": spazio_id, "comune_id": user["comune_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Spazio non trovato")
    return {"ok": True}

@api_router.get("/comune/form-template")
async def comune_template(user: dict = Depends(require_role("comune"))):
    tpl = await db.form_templates.find_one({"comune_id": user["comune_id"]}, {"_id": 0})
    return tpl or {"comune_id": user["comune_id"], "nome": "Modulo standard", "campi": []}

@api_router.put("/comune/form-template")
async def salva_template(data: TemplateIn, user: dict = Depends(require_comune_l3)):
    campi_unici = list({c.id: c for c in data.campi}.values())
    tpl = {"comune_id": user["comune_id"], "nome": data.nome,
           "campi": [c.model_dump() for c in campi_unici], "updated_at": now_iso()}
    await db.form_templates.update_one({"comune_id": user["comune_id"]}, {"$set": tpl}, upsert=True)
    return tpl

@api_router.get("/comune/pratiche")
async def comune_pratiche(stato: Optional[str] = None, user: dict = Depends(require_role("comune"))):
    query: dict = {"comune_id": user["comune_id"], "stato": {"$ne": "BOZZA"}}
    if stato:
        query["stato"] = stato
    return await db.pratiche.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)

TRANSIZIONI_COMUNE = {
    "presa_in_carico": {"da": ["INVIATA"], "a": "IN_ISTRUTTORIA"},
    "richiedi_integrazione": {"da": ["IN_ISTRUTTORIA"], "a": "INTEGRAZIONE_RICHIESTA"},
    "approva": {"da": ["IN_ISTRUTTORIA"], "a": "APPROVATA"},
    "rifiuta": {"da": ["IN_ISTRUTTORIA"], "a": "RIFIUTATA"},
}

LIVELLO_MIN_AZIONE = {"presa_in_carico": 1, "richiedi_integrazione": 1, "approva": 2, "rifiuta": 2}

@api_router.post("/comune/pratiche/{pratica_id}/transizione")
async def transizione(pratica_id: str, data: TransizioneIn, user: dict = Depends(require_role("comune"))):
    pratica = await db.pratiche.find_one({"id": pratica_id, "comune_id": user["comune_id"]}, {"_id": 0})
    if not pratica:
        raise HTTPException(status_code=404, detail="Pratica non trovata")
    regola = TRANSIZIONI_COMUNE.get(data.azione)
    if not regola:
        raise HTTPException(status_code=400, detail="Azione non valida")
    if user.get("livello", 1) < LIVELLO_MIN_AZIONE[data.azione]:
        raise HTTPException(status_code=403, detail=f"Azione riservata al livello L{LIVELLO_MIN_AZIONE[data.azione]} o superiore")
    if pratica["stato"] not in regola["da"]:
        raise HTTPException(status_code=400, detail=f"Transizione non consentita da {pratica['stato']}")
    nuovo = regola["a"]
    updates = {"stato": nuovo, "updated_at": now_iso()}
    if nuovo == "APPROVATA":
        updates["numero_autorizzazione"] = f"AUT-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
        updates["data_approvazione"] = now_iso()
    await db.pratiche.update_one({"id": pratica_id}, {"$set": updates})
    await log_stato(pratica_id, pratica["stato"], nuovo, user, data.nota)
    labels = {"IN_ISTRUTTORIA": "La tua pratica è in istruttoria",
              "INTEGRAZIONE_RICHIESTA": "Richiesta integrazione documenti",
              "APPROVATA": "Pratica approvata! Autorizzazione disponibile",
              "RIFIUTATA": "Pratica rifiutata"}
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
    return {"utenti": utenti, "comuni": comuni, "spazi": spazi,
            "pratiche_totali": len(pratiche), "per_stato": per_stato,
            "revenue_totale": round(revenue, 2),
            "pratiche_per_comune": [{"comune": nomi.get(k, k), "count": v} for k, v in per_comune.items()]}

@api_router.get("/admin/anomalie")
async def admin_anomalie(user: dict = Depends(require_role("superadmin"))):
    ora = datetime.now(timezone.utc)
    anomalie = []
    pratiche = await db.pratiche.find({"stato": {"$in": ["INVIATA", "IN_ISTRUTTORIA"]}}, {"_id": 0}).to_list(1000)
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

@api_router.get("/admin/comuni")
async def admin_comuni(user: dict = Depends(require_role("superadmin"))):
    comuni = await db.comuni.find({}, {"_id": 0}).to_list(200)
    result = []
    for c in comuni:
        spazi = await db.spazi.count_documents({"comune_id": c["id"]})
        pratiche = await db.pratiche.count_documents({"comune_id": c["id"], "stato": {"$ne": "BOZZA"}})
        result.append({**c, "spazi_count": spazi, "pratiche_count": pratiche})
    return result

@api_router.post("/admin/comuni")
async def onboard_comune(data: ComuneOnboardIn, user: dict = Depends(require_role("superadmin"))):
    email = data.referente_email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email referente già registrata")
    comune = {"id": str(uuid.uuid4()), "nome": data.nome, "regione": data.regione,
              "provincia": data.provincia, "lat": data.lat, "lng": data.lng,
              "tariffe": [{"tipologia": "Billboard", "canone_giornaliero": 50},
                          {"tipologia": "Suolo pubblico", "canone_giornaliero": 30}],
              "regole": "Regolamento comunale standard", "attivo": True, "created_at": now_iso()}
    await db.comuni.insert_one({**comune})
    referente = {"id": str(uuid.uuid4()), "email": email, "nome": data.referente_nome,
                 "ruolo": "comune", "comune_id": comune["id"], "livello": 3, "created_at": now_iso()}
    await db.users.insert_one({**referente, "password_hash": hash_password(data.referente_password)})
    return {"comune": comune, "referente": referente}

# ---------- app setup ----------

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
    from seed import seed_all, ensure_livelli, ensure_catalogo
    await seed_all(db, hash_password)
    await ensure_livelli(db, hash_password)
    await ensure_catalogo(db)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
