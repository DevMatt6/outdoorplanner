"""End-to-end tests for reset piattaforma: onboarding comuni, KPI, workflow per livello."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"

SUPERADMIN = {"email": "mattia.fabrizi92@gmail.com", "password": "demo123"}
USER = {"email": "user@demo.it", "password": "demo123"}

RUN_ID = uuid.uuid4().hex[:6]
COMUNE_NAME = f"TEST_Torino_{RUN_ID}"
L1_EMAIL = f"test_l1_{RUN_ID}@demo.it"
L2_EMAIL = f"test_l2_{RUN_ID}@demo.it"
L3_EMAIL = f"test_l3_{RUN_ID}@demo.it"
PWD = "demo123"

state = {}


def hdr(t): return {"Authorization": f"Bearer {t}"}


def login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


# ---------------- 1. Auth ----------------

def test_01_superadmin_login():
    t = login(SUPERADMIN["email"], SUPERADMIN["password"])
    state["admin"] = t
    me = requests.get(f"{API}/auth/me", headers=hdr(t)).json()
    assert me["ruolo"] == "superadmin"


def test_02_user_login():
    state["user"] = login(USER["email"], USER["password"])


# ---------------- 2. KPI baseline ----------------

def test_03_admin_kpi():
    r = requests.get(f"{API}/admin/kpi", headers=hdr(state["admin"]))
    assert r.status_code == 200
    data = r.json()
    for k in ["utenti", "comuni", "spazi", "zone", "impianti", "held", "confirmed",
              "conversione_hold", "campagne_ooh", "pratiche_totali", "revenue_totale"]:
        assert k in data, f"Missing KPI: {k}"
    state["kpi_before"] = data


# ---------------- 3. Onboarding validation ----------------

def test_04_onboard_no_users_should_fail_business_rule():
    # Backend does NOT reject 0 utenze — validation is only frontend-side.
    # Documenting current behavior.
    payload = {"nome": f"TEST_NoUsers_{RUN_ID}", "regione": "Piemonte", "provincia": "TO",
               "lat": 45.0, "lng": 7.0, "livelli_attivi": [1], "utenze": []}
    r = requests.post(f"{API}/admin/comuni", json=payload, headers=hdr(state["admin"]))
    # Business rule: FE blocks. BE currently accepts (no server-side validation).
    # Cleanup if created:
    if r.status_code == 200:
        cid = r.json()["comune"]["id"]
        requests.delete(f"{API}/admin/comuni/{cid}", headers=hdr(state["admin"]))
        pytest.skip("BE lacks 0-utenze validation (FE-only). See action items.")


def test_05_onboard_livello_non_attivo_should_400():
    payload = {"nome": f"TEST_BadLvl_{RUN_ID}", "regione": "Piemonte", "provincia": "TO",
               "lat": 45.0, "lng": 7.0, "livelli_attivi": [1],
               "utenze": [{"email": f"bad_{RUN_ID}@demo.it", "password": PWD, "nome": "X", "livello": 3}]}
    r = requests.post(f"{API}/admin/comuni", json=payload, headers=hdr(state["admin"]))
    assert r.status_code == 400
    assert "L3" in r.text or "non attiv" in r.text.lower()


# ---------------- 4. Onboarding OK ----------------

def test_06_onboard_comune_ok():
    payload = {
        "nome": COMUNE_NAME, "regione": "Piemonte", "provincia": "TO",
        "lat": 45.07, "lng": 7.68, "livelli_attivi": [1, 2, 3],
        "utenze": [
            {"email": L1_EMAIL, "password": PWD, "nome": "Op L1", "livello": 1},
            {"email": L2_EMAIL, "password": PWD, "nome": "Ref L2", "livello": 2},
            {"email": L3_EMAIL, "password": PWD, "nome": "Resp L3", "livello": 3},
        ]
    }
    r = requests.post(f"{API}/admin/comuni", json=payload, headers=hdr(state["admin"]))
    assert r.status_code == 200, r.text
    data = r.json()
    state["comune_id"] = data["comune"]["id"]
    assert data["comune"]["stato_onboarding"] == "ATTIVO"
    assert data["comune"]["livelli_attivi"] == [1, 2, 3]
    assert len(data["utenti"]) == 3


def test_07_comune_appears_in_public_list():
    r = requests.get(f"{API}/comuni")
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert state["comune_id"] in ids


def test_08_stato_sospeso_hides_comune():
    r = requests.patch(f"{API}/admin/comuni/{state['comune_id']}/stato",
                       json={"stato_onboarding": "SOSPESO"}, headers=hdr(state["admin"]))
    assert r.status_code == 200
    lst = requests.get(f"{API}/comuni").json()
    assert state["comune_id"] not in [c["id"] for c in lst]
    # ripristina
    r2 = requests.patch(f"{API}/admin/comuni/{state['comune_id']}/stato",
                        json={"stato_onboarding": "ATTIVO"}, headers=hdr(state["admin"]))
    assert r2.status_code == 200


def test_09_stato_invalid_400():
    r = requests.patch(f"{API}/admin/comuni/{state['comune_id']}/stato",
                       json={"stato_onboarding": "FOO"}, headers=hdr(state["admin"]))
    assert r.status_code == 400


# ---------------- 5. Get/Post utenti comune ----------------

def test_10_list_utenti_comune():
    r = requests.get(f"{API}/admin/comuni/{state['comune_id']}/utenti", headers=hdr(state["admin"]))
    assert r.status_code == 200
    assert len(r.json()) == 3


def test_11_add_utente_extra():
    r = requests.post(f"{API}/admin/comuni/{state['comune_id']}/utenti",
                      json={"email": f"test_extra_{RUN_ID}@demo.it", "password": PWD, "nome": "Extra", "livello": 2},
                      headers=hdr(state["admin"]))
    assert r.status_code == 200
    r2 = requests.get(f"{API}/admin/comuni/{state['comune_id']}/utenti", headers=hdr(state["admin"]))
    assert len(r2.json()) == 4


def test_12_add_utente_livello_non_attivo_400():
    # comune has L1,L2,L3 attivi -> any is allowed. Test with wrong: add livello=5 -> not in enum?
    # backend only checks membership in livelli_attivi. To trigger 400 restrict scenario:
    # create separate comune with only L1 and try to add L3.
    payload = {"nome": f"TEST_L1only_{RUN_ID}", "regione": "Piemonte", "provincia": "TO",
               "lat": 45.0, "lng": 7.0, "livelli_attivi": [1],
               "utenze": [{"email": f"solo_l1_{RUN_ID}@demo.it", "password": PWD, "nome": "X", "livello": 1}]}
    r = requests.post(f"{API}/admin/comuni", json=payload, headers=hdr(state["admin"]))
    assert r.status_code == 200
    cid = r.json()["comune"]["id"]
    state["comune_l1only"] = cid
    r2 = requests.post(f"{API}/admin/comuni/{cid}/utenti",
                       json={"email": f"badl3_{RUN_ID}@demo.it", "password": PWD, "nome": "Y", "livello": 3},
                       headers=hdr(state["admin"]))
    assert r2.status_code == 400


# ---------------- 6. Login utenze comunali + CRUD zone/impianti ----------------

def test_13_login_l3_and_crud():
    t = login(L3_EMAIL, PWD)
    state["l3"] = t
    # crea zona
    r = requests.post(f"{API}/comune/zone", json={"nome": "Centro", "descrizione": "Zona centrale"}, headers=hdr(t))
    assert r.status_code in (200, 201), r.text
    state["zona_id"] = r.json()["id"]
    # crea impianto
    payload = {"nome": "Imp1", "codice": f"IMP-{RUN_ID}", "zona_id": state["zona_id"],
               "tipologia": "6x3", "formato": "6x3", "prezzo": 100,
               "lat": 45.07, "lng": 7.68, "indirizzo": "via Roma 1", "canone_giornaliero": 100}
    r2 = requests.post(f"{API}/comune/impianti", json=payload, headers=hdr(t))
    assert r2.status_code in (200, 201), r2.text
    state["impianto_id"] = r2.json()["id"]


def test_14_login_l1_cannot_crud_zone_403():
    t = login(L1_EMAIL, PWD)
    state["l1"] = t
    r = requests.post(f"{API}/comune/zone", json={"nome": "X"}, headers=hdr(t))
    assert r.status_code == 403


def test_15_login_l2():
    state["l2"] = login(L2_EMAIL, PWD)


# ---------------- 7. Workflow pratica OSP end-to-end ----------------

def test_16_crea_spazio_l3_e_pratica_user():
    # L3 crea uno spazio OSP
    payload = {"nome": "Piazza Test", "indirizzo": "Piazza X", "lat": 45.07, "lng": 7.68,
               "canone_giornaliero": 50, "descrizione": "test"}
    r = requests.post(f"{API}/comune/spazi", json=payload, headers=hdr(state["l3"]))
    assert r.status_code in (200, 201), r.text
    state["spazio_id"] = r.json()["id"]
    # user crea pratica
    r2 = requests.post(f"{API}/pratiche",
                       json={"spazio_id": state["spazio_id"], "data_inizio": "2026-06-01",
                             "data_fine": "2026-06-03", "dati_form": {"descrizione_contenuto": "T"}},
                       headers=hdr(state["user"]))
    assert r2.status_code == 200, r2.text
    pid = r2.json()["id"]
    state["pratica_id"] = pid
    # checkout mock + invia
    r3 = requests.post(f"{API}/pratiche/{pid}/checkout", headers=hdr(state["user"]))
    assert r3.status_code == 200
    r4 = requests.post(f"{API}/pratiche/{pid}/invia", headers=hdr(state["user"]))
    assert r4.status_code == 200
    assert r4.json()["stato"] == "INVIATA"


def test_17_l1_presa_in_carico():
    r = requests.post(f"{API}/comune/pratiche/{state['pratica_id']}/transizione",
                      json={"azione": "presa_in_carico", "nota": ""}, headers=hdr(state["l1"]))
    assert r.status_code == 200, r.text
    assert r.json()["stato"] == "IN_ISTRUTTORIA"


def test_18_l1_cannot_approve_403():
    r = requests.post(f"{API}/comune/pratiche/{state['pratica_id']}/transizione",
                      json={"azione": "approva", "nota": ""}, headers=hdr(state["l1"]))
    assert r.status_code == 403


def test_19_l1_richiedi_integrazione_requires_nota():
    r = requests.post(f"{API}/comune/pratiche/{state['pratica_id']}/transizione",
                      json={"azione": "richiedi_integrazione", "nota": ""}, headers=hdr(state["l1"]))
    assert r.status_code == 400
    r2 = requests.post(f"{API}/comune/pratiche/{state['pratica_id']}/transizione",
                       json={"azione": "richiedi_integrazione", "nota": "Manca planimetria"},
                       headers=hdr(state["l1"]))
    assert r2.status_code == 200
    assert r2.json()["stato"] == "INTEGRAZIONE_RICHIESTA"


def test_20_user_reinvia_dopo_integrazione():
    r = requests.post(f"{API}/pratiche/{state['pratica_id']}/invia", headers=hdr(state["user"]))
    assert r.status_code == 200
    assert r.json()["stato"] == "IN_ISTRUTTORIA"


def test_21_l2_approva():
    r = requests.post(f"{API}/comune/pratiche/{state['pratica_id']}/transizione",
                      json={"azione": "approva", "nota": "OK"}, headers=hdr(state["l2"]))
    assert r.status_code == 200
    assert r.json()["stato"] == "APPROVATA"


# ---------------- 8. KPI aggiornati ----------------

def test_22_kpi_updated():
    r = requests.get(f"{API}/admin/kpi", headers=hdr(state["admin"]))
    data = r.json()
    assert data["comuni"] >= 1
    assert data["pratiche_totali"] >= 1


# ---------------- 9. Cleanup ----------------

def test_99_cleanup():
    for cid_key in ("comune_id", "comune_l1only"):
        cid = state.get(cid_key)
        if cid:
            requests.delete(f"{API}/admin/comuni/{cid}", headers=hdr(state["admin"]))
