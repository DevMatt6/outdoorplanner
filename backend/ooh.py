"""Modulo Campagne OOH: zone, impianti, pacchetti, prenotazioni 24h, creatività."""
import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from campaign_planning import CatalogPlanning, CampaignBrief, check_selection, period_days, period_cost

logger = logging.getLogger(__name__)

HOLD_HOURS = float(os.environ.get("HOLD_HOURS", "24"))

TIPOLOGIE_OOH = [
    {"id": "cartacee", "categoria": "Affissioni Stradali Comunali – Cartacee",
     "tipi": ["Manifesto 200x140", "Manifesto 100x140", "Manifesto 70x100"]},
    {"id": "dooh", "categoria": "DOOH – Digital Out-of-Home",
     "tipi": ["Maxi Ledwall Stradale", "Mupi Digitale / Totem Smart", "Schermo su Edicola/Chiosco", "Impianto Digitale Temporaneo – SCIA"]},
    {"id": "maxi", "categoria": "Maxi Affissioni Stradali Stabili",
     "tipi": ["Poster Maxi 6x3", "Mega Poster Stradale >18mq"]},
]
TIPO_TO_CATEGORIA = {t: c["id"] for c in TIPOLOGIE_OOH for t in c["tipi"]}

FORMATO_PER_TIPO = {
    "Manifesto 200x140": "200x140 cm", "Manifesto 100x140": "100x140 cm", "Manifesto 70x100": "70x100 cm",
    "Maxi Ledwall Stradale": "Ledwall 6x3 m", "Mupi Digitale / Totem Smart": "Mupi 120x180 cm",
    "Schermo su Edicola/Chiosco": 'Schermo 55"', "Impianto Digitale Temporaneo – SCIA": "Ledwall 4x3 m",
    "Poster Maxi 6x3": "6x3 m", "Mega Poster Stradale >18mq": "12x6 m",
}

STATI_OOH_ATTIVI = ["INVIATA", "IN_VERIFICA", "INTEGRAZIONE_RICHIESTA", "APPROVATA"]

CAMPI_ANAGRAFICI = ["nome", "email", "tipo_soggetto", "ragione_sociale", "partita_iva", "codice_fiscale", "pec", "telefono"]

def snapshot_richiedente(user: dict) -> dict:
    return {k: user.get(k) for k in CAMPI_ANAGRAFICI if user.get(k)}

def prefill_dati_form(campi: list, user: dict) -> dict:
    return {c["id"]: user[c["id"]] for c in campi if c.get("id") in CAMPI_ANAGRAFICI and user.get(c["id"])}


class ZonaIn(BaseModel):
    nome: str
    descrizione: str = ""
    quartiere: str = ""
    polygon: List[List[float]] = []


class ImpiantoIn(CatalogPlanning):
    codice: str
    zona_id: str
    via: str = ""
    lat: float
    lng: float
    tipologia: str
    prezzo: float
    foto_url: str = ""
    foto_urls: List[str] = []
    giorni_minimi: int = 1
    note: str = ""
    attivo: bool = True


class PacchettoIn(BaseModel):
    zona_id: str
    nome: str
    descrizione: str = ""
    impianti_ids: List[str] = []
    form_template_id: Optional[str] = None
    attivo: bool = True


class CampagnaOOHIn(BaseModel):
    nome: str
    data_inizio: str
    data_fine: str
    pacchetti_ids: List[str]
    impianti_sel: Dict[str, List[str]] = {}
    brief: Optional[CampaignBrief] = None


class DatiFormIn(BaseModel):
    dati_form: dict


class CreativitaAssegnaIn(BaseModel):
    impianto_id: str
    soggetto_id: str


def _giorni(inizio: str, fine: str) -> int:
    d1 = datetime.fromisoformat(inizio)
    d2 = datetime.fromisoformat(fine)
    return max((d2 - d1).days + 1, 1)


def build(db, get_current_user, require_role, require_comune_l3, notifica, log_stato, now_iso, upload_dir, save_upload):
    router = APIRouter()

    # ---------- scadenza hold ----------

    async def expire_holds():
        now = now_iso()
        expired = await db.prenotazioni.find({"stato": "HELD", "hold_expires_at": {"$lt": now}}, {"_id": 0}).to_list(200)
        for pren in expired:
            await db.prenotazioni.update_one({"id": pren["id"]}, {"$set": {"stato": "EXPIRED", "expired_at": now}})
            await db.pratiche.update_many({"prenotazione_id": pren["id"], "stato": "DA_COMPLETARE"},
                                          {"$set": {"stato": "PRENOTAZIONE_SCADUTA", "updated_at": now}})
            camp = await db.campagne.find_one({"id": pren["campagna_id"]}, {"_id": 0})
            if camp and camp.get("stato") == "HOLD":
                attive = await db.prenotazioni.count_documents({"campagna_id": camp["id"], "stato": "HELD"})
                if attive == 0:
                    await db.campagne.update_one({"id": camp["id"]}, {"$set": {"stato": "SCADUTA"}})
                await notifica(camp["user_id"], "Prenotazione scaduta",
                               f"Il blocco di 24 ore per la campagna '{camp['nome']}' è scaduto: gli impianti sono stati liberati.")
        # scadenza pagamento post-approvazione: 24h dall'approvazione
        da_pagare = await db.pratiche.find({"stato": "APPROVATA", "pagata": False,
                                            "payment_due_at": {"$lt": now}}, {"_id": 0}).to_list(200)
        for p in da_pagare:
            await db.pratiche.update_one({"id": p["id"]}, {"$set": {"stato": "PAGAMENTO_SCADUTO", "updated_at": now}})
            if p.get("prenotazione_id"):
                await db.prenotazioni.update_one({"id": p["prenotazione_id"]}, {"$set": {"stato": "CANCELLED"}})
            await notifica(p["user_id"], "Pagamento scaduto",
                           f"Non hai pagato entro 24 ore: la prenotazione '{p['spazio_nome']}' è decaduta e gli impianti sono stati liberati.")
        return len(expired) + len(da_pagare)

    # ---------- disponibilità ----------

    def _derive_impianto(data: ImpiantoIn) -> dict:
        formato = FORMATO_PER_TIPO.get(data.tipologia, "")
        return {**data.model_dump(), "formato": formato, "dimensioni": formato,
                "indirizzo": data.via, "categoria": TIPO_TO_CATEGORIA.get(data.tipologia, "cartacee")}

    async def _vie_zona(zona_id: str) -> List[str]:
        vie = await db.impianti.distinct("via", {"zona_id": zona_id, "via": {"$nin": ["", None]}})
        return sorted(vie)

    async def _prezzo_pacchetto(p: dict) -> float:
        impianti = await db.impianti.find({"id": {"$in": p.get("impianti_ids", [])}}, {"_id": 0, "prezzo": 1}).to_list(200)
        return round(sum(i.get("prezzo", 0) for i in impianti), 2)

    async def _impianti_bloccati(impianti_ids: List[str], inizio: str, fine: str) -> dict:
        """ritorna {impianto_id: 'occupato'|'opzionato'}"""
        now = now_iso()
        rows = await db.prenotazioni.find(
            {"stato": {"$in": ["HELD", "OPTIONED", "CONFIRMED"]}, "impianti_ids": {"$in": impianti_ids},
             "data_inizio": {"$lte": fine}, "data_fine": {"$gte": inizio}}, {"_id": 0}).to_list(500)
        busy = {}
        for r in rows:
            if r["stato"] == "HELD" and r.get("hold_expires_at", "") <= now:
                continue
            label = "occupato" if r["stato"] == "CONFIRMED" else "opzionato"
            for iid in set(r["impianti_ids"]) & set(impianti_ids):
                if busy.get(iid) != "occupato":
                    busy[iid] = label
        return busy

    # ---------- public ----------

    @router.get("/ooh/tipologie")
    async def tipologie():
        return TIPOLOGIE_OOH

    @router.get("/ooh/zone")
    async def zone_pubbliche(comune_id: str):
        zone = await db.zone.find({"comune_id": comune_id}, {"_id": 0}).to_list(100)
        for z in zone:
            z["impianti_count"] = await db.impianti.count_documents({"zona_id": z["id"], "attivo": True})
            z["pacchetti_count"] = await db.pacchetti.count_documents({"zona_id": z["id"], "attivo": True})
            z["vie"] = await _vie_zona(z["id"])
        return zone

    @router.get("/ooh/pacchetti")
    async def pacchetti_pubblici(comune_id: Optional[str] = None, zona_id: Optional[str] = None,
                                 data_inizio: Optional[str] = None, data_fine: Optional[str] = None):
        await expire_holds()
        q: dict = {"attivo": True}
        if comune_id:
            q["comune_id"] = comune_id
        if zona_id:
            q["zona_id"] = zona_id
        pacchetti = await db.pacchetti.find(q, {"_id": 0}).to_list(200)
        result = []
        for p in pacchetti:
            impianti = await db.impianti.find({"id": {"$in": p["impianti_ids"]}}, {"_id": 0}).to_list(100)
            busy = {}
            if data_inizio and data_fine:
                busy = await _impianti_bloccati(p["impianti_ids"], data_inizio, data_fine)
            for i in impianti:
                i["stato_disponibilita"] = busy.get(i["id"], "libero")
                i["occupato"] = i["id"] in busy
            liberi = [i for i in impianti if not i["occupato"]]
            disponibile = len(liberi) > 0
            zona = await db.zone.find_one({"id": p["zona_id"]}, {"_id": 0, "nome": 1, "quartiere": 1})
            prezzo = round(sum(i.get("prezzo", 0) for i in impianti), 2)
            result.append({**p, "impianti": impianti, "disponibile": disponibile, "prezzo_giornaliero": prezzo,
                           "impianti_liberi": len(liberi),
                           "zona_nome": zona["nome"] if zona else "", "n_impianti": len(impianti)})
        return result

    # ---------- campagne OOH ----------

    @router.post("/ooh/campagne")
    async def crea_campagna_ooh(data: CampagnaOOHIn, user: dict = Depends(require_role("user"))):
        await expire_holds()
        ids = list(dict.fromkeys(data.pacchetti_ids))
        if not ids:
            raise HTTPException(status_code=400, detail="Seleziona almeno un pacchetto")
        pacchetti = await db.pacchetti.find({"id": {"$in": ids}, "attivo": True}, {"_id": 0}).to_list(len(ids))
        if len(pacchetti) != len(ids):
            raise HTTPException(status_code=404, detail="Uno o più pacchetti non trovati")
        sel_map = {}
        for p in pacchetti:
            provided = (data.impianti_sel or {}).get(p["id"])
            if provided is not None and (not provided or not set(provided) <= set(p["impianti_ids"])):
                raise HTTPException(400, "Selezione impianti vuota o non appartenente al circuito")
            richiesti = list(dict.fromkeys(provided or []))
            busy = await _impianti_bloccati(richiesti or p["impianti_ids"], data.data_inizio, data.data_fine)
            if richiesti:
                if set(busy) & set(richiesti):
                    raise HTTPException(status_code=409, detail=f"Alcuni impianti selezionati nel circuito '{p['nome']}' non sono più disponibili")
                sel_map[p["id"]] = richiesti
            else:
                liberi = [i for i in p["impianti_ids"] if i not in busy]
                if not liberi:
                    raise HTTPException(status_code=409, detail=f"Il circuito '{p['nome']}' non è disponibile nel periodo selezionato")
                sel_map[p["id"]] = liberi
        giorni = period_days(data.data_inizio, data.data_fine)
        tutti_sel_ids = [i for ids_ in sel_map.values() for i in ids_]
        if len(set(tutti_sel_ids)) != len(tutti_sel_ids):
            raise HTTPException(400, "Lo stesso impianto non può essere selezionato in più circuiti")
        selected_items = await db.impianti.find({"id": {"$in": tutti_sel_ids}, "attivo": True}, {"_id": 0}).to_list(1000)
        if len(selected_items) != len(tutti_sel_ids):
            raise HTTPException(409, "Uno degli impianti non è più attivo")
        check_selection(data.brief, selected_items, "OOH", giorni)
        min_docs = await db.impianti.find({"id": {"$in": tutti_sel_ids}}, {"_id": 0, "codice": 1, "giorni_minimi": 1}).to_list(300)
        violati = [d for d in min_docs if giorni < (d.get("giorni_minimi") or 1)]
        if violati:
            mx = max((d.get("giorni_minimi") or 1) for d in violati)
            raise HTTPException(status_code=400, detail=f"Periodo troppo breve: gli impianti {', '.join(d['codice'] for d in violati[:4])} richiedono almeno {mx} giorni di prenotazione")
        campagna_id = str(uuid.uuid4())
        hold_created = now_iso()
        # raggruppa i circuiti per comune: una pratica e una prenotazione per comune
        per_comune: dict = {}
        for p in pacchetti:
            per_comune.setdefault(p["comune_id"], []).append(p)
        pratiche, prenotazioni = [], []
        for cid, pacs in per_comune.items():
            impianti_ids = [i for p in pacs for i in sel_map[p["id"]]]
            pren = {"id": str(uuid.uuid4()), "campagna_id": campagna_id,
                    "pacchetto_id": pacs[0]["id"], "pacchetti_ids": [p["id"] for p in pacs],
                    "comune_id": cid, "impianti_ids": impianti_ids,
                    "data_inizio": data.data_inizio, "data_fine": data.data_fine,
                    "stato": "OPTIONED", "hold_created_at": hold_created,
                    "user_id": user["id"]}
            await db.prenotazioni.insert_one({**pren})
            prenotazioni.append((cid, pacs, pren))
        # verifica atomica post-insert
        for cid, pacs, pren in prenotazioni:
            conflitti = await db.prenotazioni.find(
                {"id": {"$ne": pren["id"]}, "campagna_id": {"$ne": campagna_id},
                 "stato": {"$in": ["HELD", "OPTIONED", "CONFIRMED"]}, "impianti_ids": {"$in": pren["impianti_ids"]},
                 "data_inizio": {"$lte": pren["data_fine"]}, "data_fine": {"$gte": pren["data_inizio"]},
                 "hold_created_at": {"$lt": hold_created}}, {"_id": 0}).to_list(10)
            conflitti = [c for c in conflitti if c["stato"] != "HELD" or c.get("hold_expires_at", "") > now_iso()]
            if conflitti:
                await db.prenotazioni.delete_many({"campagna_id": campagna_id})
                raise HTTPException(status_code=409, detail="Un altro utente ha appena prenotato uno degli impianti selezionati")
        for cid, pacs, pren in prenotazioni:
            comune = await db.comuni.find_one({"id": cid}, {"_id": 0, "nome": 1})
            circuiti = []
            for p in pacs:
                zona = await db.zone.find_one({"id": p["zona_id"]}, {"_id": 0, "nome": 1})
                circuiti.append({"id": p["id"], "nome": p["nome"], "zona_nome": zona["nome"] if zona else "",
                                 "impianti_ids": sel_map[p["id"]]})
            impianti = await db.impianti.find({"id": {"$in": pren["impianti_ids"]}}, {"_id": 0}).to_list(200)
            circuito_di = {i: c["nome"] for c in circuiti for i in c["impianti_ids"]}
            nome_comune = comune["nome"] if comune else ""
            pratica = {"id": str(uuid.uuid4()), "tipo": "OOH", "user_id": user["id"], "user_nome": user["nome"],
                       "comune_id": cid, "campagna_id": campagna_id, "campagna_nome": data.nome,
                       "zona_id": pacs[0]["zona_id"], "zona_nome": ", ".join(sorted({c["zona_nome"] for c in circuiti})),
                       "pacchetto_id": pacs[0]["id"], "pacchetto_nome": " + ".join(c["nome"] for c in circuiti),
                       "circuiti": circuiti,
                       "spazio_id": pacs[0]["id"],
                       "spazio_nome": f"{nome_comune} — {len(circuiti)} circuiti" if len(circuiti) > 1 else f"{circuiti[0]['nome']} ({nome_comune})",
                       "impianti": [{"id": i["id"], "codice": i["codice"], "via": i.get("via", ""),
                                     "tipologia": i["tipologia"], "formato": i.get("formato", ""),
                                     "circuito_nome": circuito_di.get(i["id"], ""),
                                     "foto_url": i.get("foto_url", ""), "lat": i["lat"], "lng": i["lng"]} for i in impianti],
                       "stato": "DA_COMPLETARE", "dati_form": {}, "documenti": [], "creativita": [],
                       "richiedente": snapshot_richiedente(user),
                       "data_inizio": data.data_inizio, "data_fine": data.data_fine,
                       "importo": sum(period_cost(i.get("prezzo", 0), giorni) for i in impianti) / 100, "pagata": False,
                       "prenotazione_id": pren["id"], "created_at": now_iso(), "updated_at": now_iso()}
            tpl = await _template_pratica(pratica)
            pratica["dati_form"] = prefill_dati_form(tpl.get("campi", []), user)
            await db.pratiche.insert_one({**pratica})
            await db.prenotazioni.update_one({"id": pren["id"]}, {"$set": {"pratica_id": pratica["id"]}})
            await log_stato(pratica["id"], None, "DA_COMPLETARE", user, f"Pratica generata dalla campagna OOH '{data.nome}'")
            pratiche.append(pratica)
        campagna = {"id": campagna_id, "tipo": "OOH", "user_id": user["id"], "nome": data.nome,
                    "data_inizio": data.data_inizio, "data_fine": data.data_fine,
                    "brief": data.brief.model_dump() if data.brief else None,
                    "pacchetti_ids": ids, "pratica_ids": [p["id"] for p in pratiche],
                    "importo_totale": round(sum(p["importo"] for p in pratiche), 2),
                    "stato": "IN_COMPLETAMENTO", "created_at": now_iso()}
        await db.campagne.insert_one({**campagna})
        await notifica(user["id"], "Impianti opzionati",
                       f"Campagna '{data.nome}': gli impianti selezionati sono stati opzionati. Completa e invia le pratiche ai Comuni; il pagamento sarà richiesto dopo l'approvazione.")
        return {**campagna, "pratiche": pratiche}

    async def _checklist(pratica: dict) -> dict:
        tpl = await _template_pratica(pratica)
        campi_req = [c for c in tpl.get("campi", []) if c.get("required")]
        moduli_ok = all(pratica.get("dati_form", {}).get(c["id"]) not in (None, "") for c in campi_req)
        docs_req = [d for d in tpl.get("documenti_richiesti", []) if d.get("required")]
        tipi_doc = {d["tipo"] for d in pratica.get("documenti", [])}
        documenti_ok = all(d["id"] in tipi_doc for d in docs_req)
        assegnate = {a["impianto_id"] for a in pratica.get("creativita", [])}
        creativita_ok = all(i["id"] in assegnate for i in pratica.get("impianti", []))
        return {"moduli_ok": moduli_ok, "documenti_ok": documenti_ok,
                "creativita_ok": creativita_ok}

    async def _template_pratica(pratica: dict) -> dict:
        tpl = None
        pacchetto = await db.pacchetti.find_one({"id": pratica.get("pacchetto_id")}, {"_id": 0})
        if pacchetto and pacchetto.get("form_template_id"):
            tpl = await db.form_templates.find_one({"id": pacchetto["form_template_id"]}, {"_id": 0})
        if not tpl:
            tpl = await db.form_templates.find_one({"comune_id": pratica["comune_id"], "tipo": "OOH"}, {"_id": 0})
        if not tpl:
            tpl = await db.form_templates.find_one({"comune_id": pratica["comune_id"]}, {"_id": 0})
        if tpl:
            tpl.setdefault("documenti_richiesti", [])
            return tpl
        return {"nome": "Modulo standard", "campi": [], "documenti_richiesti": []}

    async def _enrich_campagna_ooh(c: dict) -> dict:
        pratiche = await db.pratiche.find({"campagna_id": c["id"]}, {"_id": 0}).to_list(50)
        out = []
        for p in pratiche:
            out.append({**p, "checklist": await _checklist(p)})
        return {**c, "pratiche": out}

    @router.get("/ooh/campagne/{campagna_id}")
    async def get_campagna_ooh(campagna_id: str, user: dict = Depends(require_role("user"))):
        await expire_holds()
        c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Campagna non trovata")
        return await _enrich_campagna_ooh(c)

    @router.get("/ooh/pratiche/{pratica_id}/template")
    async def template_pratica_ooh(pratica_id: str, user: dict = Depends(get_current_user)):
        pratica = await db.pratiche.find_one({"id": pratica_id}, {"_id": 0})
        if not pratica:
            raise HTTPException(status_code=404, detail="Pratica non trovata")
        return await _template_pratica(pratica)

    @router.put("/ooh/pratiche/{pratica_id}/dati-form")
    async def dati_form_ooh(pratica_id: str, data: DatiFormIn, user: dict = Depends(require_role("user"))):
        pratica = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"], "tipo": "OOH"}, {"_id": 0})
        if not pratica:
            raise HTTPException(status_code=404, detail="Pratica non trovata")
        if pratica["stato"] not in ("DA_COMPLETARE", "INTEGRAZIONE_RICHIESTA"):
            raise HTTPException(status_code=400, detail="Pratica non modificabile in questo stato")
        await db.pratiche.update_one({"id": pratica_id}, {"$set": {"dati_form": data.dati_form, "updated_at": now_iso()}})
        return {"ok": True}

    @router.post("/ooh/campagne/{campagna_id}/checkout")
    async def checkout_ooh(campagna_id: str, user: dict = Depends(require_role("user"))):
        await expire_holds()
        c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Campagna non trovata")
        da_pagare = await db.pratiche.find({"campagna_id": campagna_id, "stato": "APPROVATA", "pagata": False}, {"_id": 0}).to_list(50)
        if not da_pagare:
            raise HTTPException(status_code=400, detail="Nessuna pratica approvata in attesa di pagamento")
        tx = f"MOCK-{uuid.uuid4().hex[:10].upper()}"
        for p in da_pagare:
            await db.pratiche.update_one({"id": p["id"]}, {"$set": {
                "pagata": True, "pagamento": {"metodo": "carta_mock", "transazione_id": tx, "data": now_iso()},
                "updated_at": now_iso()}})
            if p.get("prenotazione_id"):
                await db.prenotazioni.update_one({"id": p["prenotazione_id"]}, {"$set": {"stato": "CONFIRMED", "confirmed_at": now_iso()}})
        await notifica(user["id"], "Pagamento registrato", f"Pagamento della campagna '{c['nome']}' completato ({tx}): impianti confermati")
        return {"ok": True, "transazione_id": tx, "pagate": len(da_pagare)}

    @router.post("/ooh/pratiche/{pratica_id}/paga")
    async def paga_pratica_ooh(pratica_id: str, user: dict = Depends(require_role("user"))):
        await expire_holds()
        p = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"]}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail="Pratica non trovata")
        if p["stato"] != "APPROVATA" or p.get("pagata"):
            raise HTTPException(status_code=400, detail="Il pagamento è disponibile solo dopo l'approvazione del Comune")
        tx = f"MOCK-{uuid.uuid4().hex[:10].upper()}"
        await db.pratiche.update_one({"id": pratica_id}, {"$set": {
            "pagata": True, "pagamento": {"metodo": "carta_mock", "transazione_id": tx, "data": now_iso()},
            "updated_at": now_iso()}})
        if p.get("prenotazione_id"):
            await db.prenotazioni.update_one({"id": p["prenotazione_id"]}, {"$set": {"stato": "CONFIRMED", "confirmed_at": now_iso()}})
        await notifica(user["id"], "Pagamento registrato", f"Pagamento di '{p['spazio_nome']}' completato ({tx}): impianti confermati")
        return {"ok": True, "transazione_id": tx}

    @router.post("/ooh/campagne/{campagna_id}/invia")
    async def invia_ooh(campagna_id: str, user: dict = Depends(require_role("user"))):
        await expire_holds()
        c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Campagna non trovata")
        if c.get("stato") == "SCADUTA":
            raise HTTPException(status_code=400, detail="La prenotazione è scaduta: crea una nuova campagna")
        pratiche = await db.pratiche.find({"campagna_id": campagna_id, "stato": "DA_COMPLETARE"}, {"_id": 0}).to_list(50)
        if not pratiche:
            raise HTTPException(status_code=400, detail="Nessuna pratica da inviare")
        for p in pratiche:
            ck = await _checklist(p)
            if not all(ck.values()):
                mancano = [{"moduli_ok": "moduli", "documenti_ok": "documentazione",
                            "creativita_ok": "creatività"}[k] for k, v in ck.items() if not v]
                raise HTTPException(status_code=400, detail=f"'{p['pacchetto_nome']}': completa {', '.join(mancano)}")
        for p in pratiche:
            await db.pratiche.update_one({"id": p["id"]}, {"$set": {"stato": "INVIATA", "updated_at": now_iso()}})
            await log_stato(p["id"], "DA_COMPLETARE", "INVIATA", user, f"Inviata dalla campagna OOH '{c['nome']}'")
            operatori = await db.users.find({"ruolo": "comune", "comune_id": p["comune_id"]}, {"_id": 0}).to_list(20)
            for op in operatori:
                await notifica(op["id"], "Nuova pratica Campagna OOH", f"Pratica '{p['spazio_nome']}' → INVIATA", p["id"])
        await db.campagne.update_one({"id": campagna_id}, {"$set": {"stato": "INVIATA"}})
        await notifica(user["id"], "Campagna inviata", f"Le pratiche della campagna '{c['nome']}' sono state inviate ai Comuni: il pagamento sarà richiesto dopo l'approvazione (24 ore di tempo).")
        return {"ok": True, "inviate": len(pratiche)}

    @router.post("/ooh/campagne/{campagna_id}/annulla")
    async def annulla_ooh(campagna_id: str, user: dict = Depends(require_role("user"))):
        c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Campagna non trovata")
        if c.get("stato") not in ("HOLD", "IN_COMPLETAMENTO"):
            raise HTTPException(status_code=400, detail="Solo le campagne in completamento possono essere annullate")
        await db.prenotazioni.update_many({"campagna_id": campagna_id, "stato": {"$in": ["HELD", "OPTIONED"]}}, {"$set": {"stato": "CANCELLED"}})
        await db.pratiche.update_many({"campagna_id": campagna_id, "stato": "DA_COMPLETARE"},
                                      {"$set": {"stato": "ANNULLATA", "updated_at": now_iso()}})
        await db.campagne.update_one({"id": campagna_id}, {"$set": {"stato": "ANNULLATA"}})
        await notifica(user["id"], "Campagna annullata", f"La campagna '{c['nome']}' è stata annullata: gli impianti sono stati liberati.")
        return {"ok": True}

    # ---------- soggetti creativi ----------

    @router.get("/ooh/campagne/{campagna_id}/formati")
    async def formati_campagna(campagna_id: str, user: dict = Depends(require_role("user"))):
        c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Campagna non trovata")
        pratiche = await db.pratiche.find({"campagna_id": campagna_id}, {"_id": 0, "impianti": 1}).to_list(50)
        formati = {}
        for p in pratiche:
            for i in p.get("impianti", []):
                f = i.get("formato", "")
                if not f:
                    continue
                formati.setdefault(f, {"formato": f, "n_impianti": 0, "tipologie": set()})
                formati[f]["n_impianti"] += 1
                formati[f]["tipologie"].add(i["tipologia"])
        return [{**v, "tipologie": sorted(v["tipologie"])} for v in formati.values()]

    @router.post("/ooh/campagne/{campagna_id}/soggetti")
    async def crea_soggetto(campagna_id: str, formato: str, ordine: int = 1, nome: str = "",
                            file: UploadFile = File(...), user: dict = Depends(require_role("user"))):
        c = await db.campagne.find_one({"id": campagna_id, "user_id": user["id"]}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Campagna non trovata")
        pratiche = await db.pratiche.find({"campagna_id": campagna_id}, {"_id": 0, "impianti": 1}).to_list(50)
        formati_validi = {i.get("formato") for p in pratiche for i in p.get("impianti", [])}
        if formato not in formati_validi:
            raise HTTPException(status_code=400, detail=f"Formato '{formato}' non presente tra gli impianti della campagna")
        ext = (file.filename or "img").rsplit(".", 1)[-1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp", "pdf", "mp4", "gif"):
            raise HTTPException(status_code=400, detail="Formato file non supportato (JPG, PNG, PDF, MP4, GIF)")
        name = f"{uuid.uuid4().hex[:10]}.{ext}"
        await save_upload(f"creativita/{name}", await file.read())
        sog = {"id": str(uuid.uuid4()), "campagna_id": campagna_id, "user_id": user["id"],
               "formato": formato, "ordine": ordine, "nome": nome or f"Soggetto {ordine} — {formato}",
               "file_nome": file.filename, "file_url": f"/api/uploads/creativita/{name}",
               "digitale": ext in ("mp4", "gif"), "created_at": now_iso()}
        await db.soggetti.insert_one({**sog})
        return sog

    @router.get("/ooh/campagne/{campagna_id}/soggetti")
    async def lista_soggetti(campagna_id: str, user: dict = Depends(require_role("user"))):
        return await db.soggetti.find({"campagna_id": campagna_id, "user_id": user["id"]}, {"_id": 0}).sort("ordine", 1).to_list(200)

    @router.delete("/ooh/soggetti/{soggetto_id}")
    async def elimina_soggetto(soggetto_id: str, user: dict = Depends(require_role("user"))):
        sog = await db.soggetti.find_one({"id": soggetto_id, "user_id": user["id"]}, {"_id": 0})
        if not sog:
            raise HTTPException(status_code=404, detail="Soggetto non trovato")
        await db.soggetti.delete_one({"id": soggetto_id})
        pratiche = await db.pratiche.find({"campagna_id": sog["campagna_id"]}, {"_id": 0, "id": 1, "creativita": 1}).to_list(50)
        for p in pratiche:
            nuove = [a for a in p.get("creativita", []) if a.get("soggetto_id") != soggetto_id]
            if len(nuove) != len(p.get("creativita", [])):
                await db.pratiche.update_one({"id": p["id"]}, {"$set": {"creativita": nuove, "updated_at": now_iso()}})
        return {"ok": True}

    @router.post("/ooh/pratiche/{pratica_id}/creativita")
    async def assegna_creativita(pratica_id: str, data: CreativitaAssegnaIn, user: dict = Depends(require_role("user"))):
        pratica = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"], "tipo": "OOH"}, {"_id": 0})
        if not pratica:
            raise HTTPException(status_code=404, detail="Pratica non trovata")
        if pratica["stato"] not in ("DA_COMPLETARE", "INTEGRAZIONE_RICHIESTA"):
            raise HTTPException(status_code=400, detail="Creatività modificabili solo in fase di completamento o integrazione")
        sog = await db.soggetti.find_one({"id": data.soggetto_id, "user_id": user["id"]}, {"_id": 0})
        if not sog:
            raise HTTPException(status_code=404, detail="Soggetto creativo non trovato")
        impianto = next((i for i in pratica.get("impianti", []) if i["id"] == data.impianto_id), None)
        if not impianto:
            raise HTTPException(status_code=404, detail="Impianto non presente nella pratica")
        if sog["formato"] != impianto.get("formato"):
            raise HTTPException(status_code=400, detail=f"Il soggetto è per formato '{sog['formato']}': non compatibile con l'impianto '{impianto['codice']}' ({impianto.get('formato')})")
        assoc = [a for a in pratica.get("creativita", []) if a["impianto_id"] != data.impianto_id]
        assoc.append({"impianto_id": data.impianto_id, "soggetto_id": sog["id"], "creativita_nome": sog["nome"]})
        await db.pratiche.update_one({"id": pratica_id}, {"$set": {"creativita": assoc, "updated_at": now_iso()}})
        return {"ok": True, "creativita": assoc}

    @router.delete("/ooh/pratiche/{pratica_id}/creativita/{impianto_id}")
    async def rimuovi_creativita(pratica_id: str, impianto_id: str, user: dict = Depends(require_role("user"))):
        pratica = await db.pratiche.find_one({"id": pratica_id, "user_id": user["id"]}, {"_id": 0})
        if not pratica:
            raise HTTPException(status_code=404, detail="Pratica non trovata")
        if pratica["stato"] not in ("DA_COMPLETARE", "INTEGRAZIONE_RICHIESTA"):
            raise HTTPException(status_code=400, detail="Creatività modificabili solo in fase di completamento o integrazione")
        assoc = [a for a in pratica.get("creativita", []) if a["impianto_id"] != impianto_id]
        await db.pratiche.update_one({"id": pratica_id}, {"$set": {"creativita": assoc, "updated_at": now_iso()}})
        return {"ok": True}

    # ---------- backoffice comune: zone, impianti, pacchetti ----------

    @router.post("/comune/zone")
    async def crea_zona(data: ZonaIn, user: dict = Depends(require_comune_l3)):
        zona = {"id": str(uuid.uuid4()), "comune_id": user["comune_id"], **data.model_dump(), "created_at": now_iso()}
        await db.zone.insert_one({**zona})
        return zona

    @router.get("/comune/zone")
    async def comune_zone(user: dict = Depends(require_role("comune"))):
        zone = await db.zone.find({"comune_id": user["comune_id"]}, {"_id": 0}).to_list(100)
        for z in zone:
            z["impianti_count"] = await db.impianti.count_documents({"zona_id": z["id"]})
            z["pacchetti_count"] = await db.pacchetti.count_documents({"zona_id": z["id"]})
            z["vie"] = await _vie_zona(z["id"])
        return zone

    @router.put("/comune/zone/{zona_id}")
    async def aggiorna_zona(zona_id: str, data: ZonaIn, user: dict = Depends(require_comune_l3)):
        res = await db.zone.update_one({"id": zona_id, "comune_id": user["comune_id"]}, {"$set": data.model_dump()})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Zona non trovata")
        return await db.zone.find_one({"id": zona_id}, {"_id": 0})

    @router.delete("/comune/zone/{zona_id}")
    async def elimina_zona(zona_id: str, user: dict = Depends(require_comune_l3)):
        if await db.pacchetti.count_documents({"zona_id": zona_id}) > 0:
            raise HTTPException(status_code=400, detail="Elimina prima i pacchetti della zona")
        res = await db.zone.delete_one({"id": zona_id, "comune_id": user["comune_id"]})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Zona non trovata")
        await db.impianti.update_many({"zona_id": zona_id}, {"$set": {"zona_id": None}})
        return {"ok": True}

    @router.get("/comune/impianti")
    async def comune_impianti(user: dict = Depends(require_role("comune"))):
        return await db.impianti.find({"comune_id": user["comune_id"]}, {"_id": 0}).to_list(500)

    @router.post("/comune/impianti")
    async def crea_impianto(data: ImpiantoIn, user: dict = Depends(require_comune_l3)):
        imp = {"id": str(uuid.uuid4()), "comune_id": user["comune_id"], **_derive_impianto(data), "created_at": now_iso()}
        await db.impianti.insert_one({**imp})
        return imp

    @router.put("/comune/impianti/{impianto_id}")
    async def aggiorna_impianto(impianto_id: str, data: ImpiantoIn, user: dict = Depends(require_comune_l3)):
        res = await db.impianti.update_one({"id": impianto_id, "comune_id": user["comune_id"]}, {"$set": _derive_impianto(data)})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Impianto non trovato")
        return await db.impianti.find_one({"id": impianto_id}, {"_id": 0})

    @router.delete("/comune/impianti/{impianto_id}")
    async def elimina_impianto(impianto_id: str, user: dict = Depends(require_comune_l3)):
        res = await db.impianti.delete_one({"id": impianto_id, "comune_id": user["comune_id"]})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Impianto non trovato")
        await db.pacchetti.update_many({"comune_id": user["comune_id"]}, {"$pull": {"impianti_ids": impianto_id}})
        return {"ok": True}

    @router.get("/comune/pacchetti")
    async def comune_pacchetti(user: dict = Depends(require_role("comune"))):
        pacchetti = await db.pacchetti.find({"comune_id": user["comune_id"]}, {"_id": 0}).to_list(200)
        zone = {z["id"]: z["nome"] for z in await db.zone.find({"comune_id": user["comune_id"]}, {"_id": 0}).to_list(100)}
        out = []
        for p in pacchetti:
            prezzo = await _prezzo_pacchetto(p)
            out.append({**p, "zona_nome": zone.get(p["zona_id"], ""), "n_impianti": len(p["impianti_ids"]),
                        "prezzo_giornaliero": prezzo})
        return out

    @router.post("/comune/pacchetti")
    async def crea_pacchetto(data: PacchettoIn, user: dict = Depends(require_comune_l3)):
        pac = {"id": str(uuid.uuid4()), "comune_id": user["comune_id"], **data.model_dump(), "created_at": now_iso()}
        await db.pacchetti.insert_one({**pac})
        return pac

    @router.put("/comune/pacchetti/{pacchetto_id}")
    async def aggiorna_pacchetto(pacchetto_id: str, data: PacchettoIn, user: dict = Depends(require_comune_l3)):
        res = await db.pacchetti.update_one({"id": pacchetto_id, "comune_id": user["comune_id"]}, {"$set": data.model_dump()})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Pacchetto non trovato")
        return await db.pacchetti.find_one({"id": pacchetto_id}, {"_id": 0})

    @router.delete("/comune/pacchetti/{pacchetto_id}")
    async def elimina_pacchetto(pacchetto_id: str, user: dict = Depends(require_comune_l3)):
        res = await db.pacchetti.delete_one({"id": pacchetto_id, "comune_id": user["comune_id"]})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Pacchetto non trovato")
        return {"ok": True}

    @router.get("/comune/report/ooh")
    async def report_ooh(user: dict = Depends(require_role("comune"))):
        cid = user["comune_id"]
        pacchetti = await db.pacchetti.find({"comune_id": cid}, {"_id": 0}).to_list(200)
        zone = {z["id"]: z["nome"] for z in await db.zone.find({"comune_id": cid}, {"_id": 0}).to_list(100)}
        pratiche = await db.pratiche.find({"comune_id": cid, "tipo": "OOH"}, {"_id": 0}).to_list(2000)
        held = await db.prenotazioni.count_documents({"comune_id": cid, "stato": "HELD"})
        confirmed = await db.prenotazioni.count_documents({"comune_id": cid, "stato": "CONFIRMED"})
        expired = await db.prenotazioni.count_documents({"comune_id": cid, "stato": "EXPIRED"})
        rows = []
        for p in pacchetti:
            mie = [x for x in pratiche if x.get("pacchetto_id") == p["id"]]
            pagate = [x for x in mie if x.get("pagata") and x["stato"] not in ("ANNULLATA", "PRENOTAZIONE_SCADUTA")]
            rows.append({"pacchetto_id": p["id"], "nome": p["nome"], "zona": zone.get(p["zona_id"], ""),
                         "n_impianti": len(p["impianti_ids"]), "prezzo_giornaliero": await _prezzo_pacchetto(p),
                         "pratiche": len(mie), "incassato": round(sum(x["importo"] for x in pagate), 2)})
        return {"pacchetti": sorted(rows, key=lambda r: -r["incassato"]),
                "prenotazioni": {"HELD": held, "CONFIRMED": confirmed, "EXPIRED": expired},
                "conversione": round(confirmed / (confirmed + expired) * 100, 1) if (confirmed + expired) else 0}

    return router, expire_holds, pacchetti_pubblici
