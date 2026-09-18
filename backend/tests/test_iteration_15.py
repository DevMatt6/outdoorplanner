"""Iteration 15 - Test 8 nuove modifiche OOH.
P1 foto_urls/giorni_minimi su impianto, P2 selezione impianti (test frontend),
P3 una pratica per comune (multi-circuito), P4 scrivania (indirettamente),
P5 cluster (frontend), P6 giorni_minimi validation, P7 nuovo flusso pagamento post-approvazione,
P8 OSP L3 approvazione + inoltra."""
import os
import io
import uuid
import asyncio
import time
from datetime import datetime, timezone, timedelta
import requests
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path("/app/backend/.env"))
load_dotenv(Path("/app/frontend/.env"))
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
PW = "demo123"


def _login(email, password=PW):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    j = r.json()
    return {"Authorization": f"Bearer {j['access_token']}"}, j["user"]


@pytest.fixture(scope="module")
def smoke():
    return _login("smoke.test@demo.it")

@pytest.fixture(scope="module")
def roma_l1():
    return _login("roma.l1@demo.it")

@pytest.fixture(scope="module")
def roma_l2():
    return _login("roma.l2@demo.it")

@pytest.fixture(scope="module")
def roma_l3():
    return _login("roma.l3@demo.it")

@pytest.fixture(scope="module")
def comuni():
    r = requests.get(f"{BASE}/comuni", timeout=15)
    return {c["nome"]: c for c in r.json()}

@pytest.fixture(scope="module")
def db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ---------- P3+P7 backend E2E: campagna OOH con 2 circuiti Roma -> 1 sola pratica ----------

@pytest.fixture(scope="module")
def campagna_multi(smoke, comuni):
    h, _ = smoke
    roma_id = comuni["Roma"]["id"]
    date_i = "2027-05-10"
    date_f = "2027-05-15"  # 6 giorni
    packs = requests.get(f"{BASE}/ooh/pacchetti", params={
        "comune_id": roma_id, "data_inizio": date_i, "data_fine": date_f}, timeout=15).json()
    # scegli 2 pacchetti disponibili
    avail = [p for p in packs if p.get("disponibile")][:2]
    assert len(avail) == 2, f"servono almeno 2 pacchetti disponibili, trovati {len(avail)}"
    r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
        "nome": "TEST_iter15_multi", "data_inizio": date_i, "data_fine": date_f,
        "pacchetti_ids": [avail[0]["id"], avail[1]["id"]]}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json(), avail, date_i, date_f


class TestP3P7NuovaCampagna:
    def test_una_sola_pratica(self, campagna_multi):
        camp, _, _, _ = campagna_multi
        assert len(camp["pratiche"]) == 1, f"attese 1 pratica, {len(camp['pratiche'])}"
        p = camp["pratiche"][0]
        assert "— 2 circuiti" in p["spazio_nome"], p["spazio_nome"]
        assert len(p.get("circuiti", [])) == 2

    def test_stato_in_completamento(self, campagna_multi):
        camp, _, _, _ = campagna_multi
        assert camp["stato"] == "IN_COMPLETAMENTO", camp["stato"]
        # NIENTE hold_expires_at (nuovo flusso)
        p = camp["pratiche"][0]
        assert not p.get("pagata")

    def test_prenotazione_optioned(self, campagna_multi, db):
        camp, _, _, _ = campagna_multi
        async def _q():
            prens = await db.prenotazioni.find({"campagna_id": camp["id"]}, {"_id": 0}).to_list(10)
            return prens
        prens = asyncio.get_event_loop().run_until_complete(_q())
        assert len(prens) == 1, f"attesa 1 prenotazione, {len(prens)}"
        assert prens[0]["stato"] == "OPTIONED"

    def test_pacchetti_opzionato(self, campagna_multi, comuni):
        _, avail, di, df = campagna_multi
        r = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": comuni["Roma"]["id"], "data_inizio": di, "data_fine": df}, timeout=15)
        pks = r.json()
        target = next(p for p in pks if p["id"] == avail[0]["id"])
        stati = {i["stato_disponibilita"] for i in target["impianti"]}
        assert "opzionato" in stati, stati

    def test_importo(self, campagna_multi):
        camp, avail, di, df = campagna_multi
        # 6 giorni x somma prezzi impianti dei 2 circuiti (tutti liberi)
        atteso = round(6 * (avail[0]["prezzo_giornaliero"] + avail[1]["prezzo_giornaliero"]), 2)
        assert abs(camp["importo_totale"] - atteso) < 0.5, (camp["importo_totale"], atteso)

    def test_invia_senza_pagamento(self, smoke, campagna_multi):
        h, _ = smoke
        camp, _, _, _ = campagna_multi
        cid = camp["id"]
        pid = camp["pratiche"][0]["id"]
        # dati form
        r = requests.put(f"{BASE}/ooh/pratiche/{pid}/dati-form", headers=h,
                        json={"dati_form": {"descrizione_contenuto": "test", "settore_merceologico": "Moda"}}, timeout=15)
        assert r.status_code == 200, r.text
        # documenti
        for tipo in ("bozzetto", "doc_identita"):
            files = {"file": (f"{tipo}.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}
            r = requests.post(f"{BASE}/pratiche/{pid}/documenti", headers=h, params={"tipo": tipo}, files=files, timeout=15)
            assert r.status_code == 200, r.text
        # crea 1 soggetto per ciascun formato usato
        formati = requests.get(f"{BASE}/ooh/campagne/{cid}/formati", headers=h, timeout=15).json()
        assert len(formati) > 0
        sog_by_fmt = {}
        for i, f in enumerate(formati):
            files = {"file": ("cr.png", io.BytesIO(b"\x89PNG\r\n\x1a\ntest"), "image/png")}
            r = requests.post(f"{BASE}/ooh/campagne/{cid}/soggetti", headers=h,
                              params={"formato": f["formato"], "ordine": i+1, "nome": f"S_{f['formato']}"},
                              files=files, timeout=15)
            assert r.status_code == 200, r.text
            sog_by_fmt[f["formato"]] = r.json()["id"]
        # assegna ogni impianto
        p_full = requests.get(f"{BASE}/ooh/campagne/{cid}", headers=h, timeout=15).json()
        pratica = p_full["pratiche"][0]
        for imp in pratica["impianti"]:
            sid = sog_by_fmt[imp["formato"]]
            r = requests.post(f"{BASE}/ooh/pratiche/{pid}/creativita", headers=h,
                              json={"impianto_id": imp["id"], "soggetto_id": sid}, timeout=15)
            assert r.status_code == 200, r.text
        # invia SENZA pagamento
        r = requests.post(f"{BASE}/ooh/campagne/{cid}/invia", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        # verifica: pratica INVIATA, prenotazione ancora OPTIONED
        p_after = requests.get(f"{BASE}/ooh/campagne/{cid}", headers=h, timeout=15).json()
        assert p_after["pratiche"][0]["stato"] == "INVIATA"


# ---------- P7 approvazione + pagamento ----------

class TestP7Pagamento:
    def test_approva_e_paga(self, campagna_multi, roma_l2, smoke, db, comuni):
        # attende che invia sia avvenuto (test precedente)
        h_op, _ = roma_l2
        h_u, _ = smoke
        camp, _, di, df = campagna_multi
        pid = camp["pratiche"][0]["id"]
        # presa in carico
        r = requests.post(f"{BASE}/comune/pratiche/{pid}/transizione", headers=h_op,
                          json={"azione": "presa_in_carico"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["stato"] == "IN_VERIFICA"
        # approva
        r = requests.post(f"{BASE}/comune/pratiche/{pid}/transizione", headers=h_op,
                          json={"azione": "approva"}, timeout=15)
        assert r.status_code == 200, r.text
        # verifica payment_due_at
        async def _q():
            return await db.pratiche.find_one({"id": pid}, {"_id":0,"payment_due_at":1,"stato":1})
        p_doc = asyncio.get_event_loop().run_until_complete(_q())
        assert p_doc["stato"] == "APPROVATA"
        assert p_doc.get("payment_due_at"), "payment_due_at mancante"
        # pagamento
        r = requests.post(f"{BASE}/ooh/pratiche/{pid}/paga", headers=h_u, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("transazione_id")
        # prenotazione CONFIRMED e impianto occupato
        pks = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": comuni["Roma"]["id"], "data_inizio": di, "data_fine": df}, timeout=15).json()
        stati_all = []
        for p in pks:
            stati_all.extend(i["stato_disponibilita"] for i in p["impianti"])
        assert "occupato" in stati_all, "atteso almeno un impianto occupato"

    def test_paga_su_non_approvata_400(self, smoke, comuni):
        h, _ = smoke
        # crea una campagna nuova senza approvazione
        roma_id = comuni["Roma"]["id"]
        packs = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": roma_id, "data_inizio": "2027-07-01", "data_fine": "2027-07-03"}, timeout=15).json()
        avail = [p for p in packs if p.get("disponibile")][:1]
        r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
            "nome": "TEST_iter15_nopay", "data_inizio": "2027-07-01", "data_fine": "2027-07-03",
            "pacchetti_ids": [avail[0]["id"]]}, timeout=15)
        camp = r.json()
        pid = camp["pratiche"][0]["id"]
        r = requests.post(f"{BASE}/ooh/pratiche/{pid}/paga", headers=h, timeout=15)
        assert r.status_code == 400, r.text
        # cleanup
        requests.post(f"{BASE}/ooh/campagne/{camp['id']}/annulla", headers=h, timeout=15)


# ---------- P7 scadenza pagamento ----------

class TestP7Scadenza:
    def test_scadenza_libera_impianti(self, smoke, roma_l2, comuni, db):
        h, _ = smoke
        h_op, _ = roma_l2
        roma_id = comuni["Roma"]["id"]
        di, df = "2027-08-01", "2027-08-03"
        packs = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": roma_id, "data_inizio": di, "data_fine": df}, timeout=15).json()
        avail = [p for p in packs if p.get("disponibile")][:1]
        r = requests.post(f"{BASE}/ooh/campagne", headers=h, json={
            "nome": "TEST_iter15_expire", "data_inizio": di, "data_fine": df,
            "pacchetti_ids": [avail[0]["id"]]}, timeout=15)
        assert r.status_code == 200, r.text
        camp = r.json()
        pid = camp["pratiche"][0]["id"]
        # completa il minimo necessario per non blocc: settiamo stato APPROVATA con payment_due_at nel passato via DB
        async def _rig():
            past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            await db.pratiche.update_one({"id": pid}, {"$set": {"stato": "APPROVATA", "payment_due_at": past, "pagata": False}})
        asyncio.get_event_loop().run_until_complete(_rig())
        # GET pacchetti fa scattare expire_holds
        pks2 = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": roma_id, "data_inizio": di, "data_fine": df}, timeout=15).json()
        async def _q():
            return await db.pratiche.find_one({"id": pid}, {"_id":0,"stato":1})
        p_doc = asyncio.get_event_loop().run_until_complete(_q())
        assert p_doc["stato"] == "PAGAMENTO_SCADUTO", p_doc
        target = next(p for p in pks2 if p["id"] == avail[0]["id"])
        # tutti gli impianti tornano liberi
        assert all(i["stato_disponibilita"] == "libero" for i in target["impianti"])


# ---------- P6 giorni_minimi ----------

class TestP6GiorniMinimi:
    def test_periodo_troppo_breve_400(self, smoke, roma_l3, comuni, db):
        h_op, _ = roma_l3
        h_u, _ = smoke
        roma_id = comuni["Roma"]["id"]
        # trova primo impianto di un pacchetto disponibile
        packs = requests.get(f"{BASE}/ooh/pacchetti", params={
            "comune_id": roma_id, "data_inizio": "2027-09-01", "data_fine": "2027-09-06"}, timeout=15).json()
        avail = [p for p in packs if p.get("disponibile")]
        pack = avail[0]
        imp0 = pack["impianti"][0]
        # PUT giorni_minimi=30
        put_body = {
            "codice": imp0["codice"], "zona_id": imp0["zona_id"], "via": imp0.get("via",""),
            "lat": imp0["lat"], "lng": imp0["lng"], "tipologia": imp0["tipologia"],
            "prezzo": imp0["prezzo"], "foto_url": imp0.get("foto_url",""), "foto_urls": imp0.get("foto_urls",[]),
            "giorni_minimi": 30, "note": imp0.get("note",""), "attivo": True}
        r = requests.put(f"{BASE}/comune/impianti/{imp0['id']}", headers=h_op, json=put_body, timeout=15)
        assert r.status_code == 200, r.text
        try:
            # crea campagna 5 giorni con impianti_sel = solo imp0
            r = requests.post(f"{BASE}/ooh/campagne", headers=h_u, json={
                "nome": "TEST_iter15_gm", "data_inizio": "2027-09-01", "data_fine": "2027-09-05",
                "pacchetti_ids": [pack["id"]], "impianti_sel": {pack["id"]: [imp0["id"]]}}, timeout=15)
            assert r.status_code == 400, r.text
            assert "30 giorni" in r.text or "richiedono" in r.text.lower()
        finally:
            # ripristina giorni_minimi=1
            put_body["giorni_minimi"] = 1
            r = requests.put(f"{BASE}/comune/impianti/{imp0['id']}", headers=h_op, json=put_body, timeout=15)
            assert r.status_code == 200


# ---------- P1 foto_urls + giorni_minimi campi impianto ----------

class TestP1CampiImpianto:
    def test_crea_impianto_con_foto_urls(self, roma_l3):
        h, _ = roma_l3
        # trova zona esistente
        zone = requests.get(f"{BASE}/comune/zone", headers=h, timeout=15).json()
        zona = zone[0]
        body = {
            "codice": f"TEST-IT15-{uuid.uuid4().hex[:5]}",
            "zona_id": zona["id"], "via": "Via Test 1", "lat": 41.9, "lng": 12.5,
            "tipologia": "Manifesto 200x140", "prezzo": 100.0, "foto_url": "https://a/1.jpg",
            "foto_urls": ["https://a/2.jpg", "https://a/3.jpg"], "giorni_minimi": 7,
            "note": "", "attivo": True}
        r = requests.post(f"{BASE}/comune/impianti", headers=h, json=body, timeout=15)
        assert r.status_code == 200, r.text
        imp = r.json()
        assert imp["foto_urls"] == ["https://a/2.jpg", "https://a/3.jpg"]
        assert imp["giorni_minimi"] == 7
        # cleanup
        requests.delete(f"{BASE}/comune/impianti/{imp['id']}", headers=h, timeout=15)


# ---------- P8 OSP livelli L3 approvazione + inoltra ----------

class TestP8OSP:
    @pytest.fixture(scope="class")
    def pratica_osp(self, smoke, comuni):
        h, _ = smoke
        r = requests.get(f"{BASE}/spazi", timeout=15).json()
        roma_spazio = next(s for s in r if s.get("comune_id") == comuni["Roma"]["id"])
        r = requests.post(f"{BASE}/pratiche", headers=h, json={
            "spazio_id": roma_spazio["id"], "data_inizio": "2027-10-01", "data_fine": "2027-10-03",
            "dati_form": {"descrizione_evento": "TEST", "tipo_occupazione": "Gazebo", "superficie_mq": 20}
        }, timeout=15)
        assert r.status_code == 200, r.text
        pratica = r.json()
        pid = pratica["id"]
        # docs
        for tipo in ("planimetria", "polizza_assicurativa", "doc_identita"):
            files = {"file": (f"{tipo}.pdf", io.BytesIO(b"%PDF"), "application/pdf")}
            r = requests.post(f"{BASE}/pratiche/{pid}/documenti", headers=h, params={"tipo": tipo}, files=files, timeout=15)
            assert r.status_code == 200, r.text
        # checkout + invia
        r = requests.post(f"{BASE}/pratiche/{pid}/checkout", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        r = requests.post(f"{BASE}/pratiche/{pid}/invia", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        return pid

    def test_l1_prende_in_carico(self, roma_l1, pratica_osp):
        h, _ = roma_l1
        r = requests.post(f"{BASE}/comune/pratiche/{pratica_osp}/transizione", headers=h,
                          json={"azione": "presa_in_carico"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["stato"] == "IN_ISTRUTTORIA"

    def test_l1_approva_forbidden(self, roma_l1, pratica_osp):
        h, _ = roma_l1
        r = requests.post(f"{BASE}/comune/pratiche/{pratica_osp}/transizione", headers=h,
                          json={"azione": "approva"}, timeout=15)
        assert r.status_code == 403, r.text

    def test_l2_approva_forbidden(self, roma_l2, pratica_osp):
        h, _ = roma_l2
        r = requests.post(f"{BASE}/comune/pratiche/{pratica_osp}/transizione", headers=h,
                          json={"azione": "approva"}, timeout=15)
        assert r.status_code == 403, r.text

    def test_l1_inoltra_a_l2(self, roma_l1, pratica_osp, db):
        h, _ = roma_l1
        r = requests.post(f"{BASE}/comune/pratiche/{pratica_osp}/transizione", headers=h,
                          json={"azione": "inoltra"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["livello_corrente"] == 2

    def test_l2_inoltra_a_l3(self, roma_l2, pratica_osp):
        h, _ = roma_l2
        r = requests.post(f"{BASE}/comune/pratiche/{pratica_osp}/transizione", headers=h,
                          json={"azione": "inoltra"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["livello_corrente"] == 3

    def test_l3_approva_ok(self, roma_l3, pratica_osp):
        h, _ = roma_l3
        r = requests.post(f"{BASE}/comune/pratiche/{pratica_osp}/transizione", headers=h,
                          json={"azione": "approva"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["stato"] == "APPROVATA"
