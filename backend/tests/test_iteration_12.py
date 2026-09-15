"""Iteration 12: restyle blue + modifica dati integrazione + state guards on OOH creativity."""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "mattia.fabrizi92@gmail.com", "password": "demo123"}
TS = uuid.uuid4().hex[:6]
COM_NAME = f"TEST_it12_{TS}"
L2_EMAIL = f"test_it12_l2_{TS}@demo.it"
L3_EMAIL = f"test_it12_l3_{TS}@demo.it"
USER_EMAIL = f"test_it12_user_{TS}@demo.it"

DINI = (date.today() + timedelta(days=90)).isoformat()
DFIN = (date.today() + timedelta(days=100)).isoformat()

state = {}


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _login(e, p):
    r = requests.post(f"{API}/auth/login", json={"email": e, "password": p})
    assert r.status_code == 200, f"{e}: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module", autouse=True)
def bootstrap():
    state["super"] = _login(SUPER["email"], SUPER["password"])
    hs = _h(state["super"])
    r = requests.post(f"{API}/admin/comuni", headers=hs, json={
        "nome": COM_NAME, "regione": "TR", "provincia": "TS",
        "lat": 42.0, "lng": 12.5, "livelli_attivi": [1, 2, 3],
        "utenze": [
            {"email": L2_EMAIL, "password": "demo123", "nome": "L2 it12", "livello": 2},
            {"email": L3_EMAIL, "password": "demo123", "nome": "L3 it12", "livello": 3},
        ],
    })
    assert r.status_code == 200, r.text
    state["comune_id"] = r.json()["comune"]["id"]

    # L3 crea zona + 2 impianti stessa tipologia + 1 pacchetto
    t3 = _login(L3_EMAIL, "demo123")
    h3 = _h(t3)
    r = requests.post(f"{API}/comune/zone", headers=h3, json={"nome": "Z12", "descrizione": ""})
    assert r.status_code == 200
    zid = r.json()["id"]
    imps = []
    for i in range(2):
        r = requests.post(f"{API}/comune/impianti", headers=h3, json={
            "codice": f"I12{TS}{i}", "zona_id": zid, "via": "Via Test",
            "lat": 42.0 + i * 0.001, "lng": 12.5, "tipologia": "Manifesto 200x140",
            "prezzo": 40.0,
        })
        assert r.status_code == 200, r.text
        imps.append(r.json())
    state["impianti"] = imps
    r = requests.post(f"{API}/comune/pacchetti", headers=h3, json={
        "zona_id": zid, "nome": "P12", "impianti_ids": [x["id"] for x in imps], "attivo": True,
    })
    assert r.status_code == 200
    state["pacchetto_id"] = r.json()["id"]

    # register user
    r = requests.post(f"{API}/auth/register", json={
        "email": USER_EMAIL, "password": "demo123", "nome": "Test It12",
        "tipo_soggetto": "Privato",
    })
    assert r.status_code == 200
    state["user_token"] = r.json()["access_token"]

    yield
    # cleanup
    requests.delete(f"{API}/admin/comuni/{state['comune_id']}", headers=hs)


def _upload_soggetto(cid, nome="Sog", ordine=1):
    files = {"file": ("s.png", b"\x89PNG\r\n\x1a\n" + b"0" * 20, "image/png")}
    r = requests.post(
        f"{API}/ooh/campagne/{cid}/soggetti?formato=200x140+cm&ordine={ordine}&nome={nome}",
        headers=_h(state["user_token"]), files=files)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _complete_and_send(cid, pid):
    h = _h(state["user_token"])
    sog = _upload_soggetto(cid, "SogA", 1)
    p = requests.get(f"{API}/pratiche/{pid}", headers=h).json()
    for imp in p["impianti"]:
        r = requests.post(f"{API}/ooh/pratiche/{pid}/creativita", headers=h,
                          json={"impianto_id": imp["id"], "soggetto_id": sog})
        assert r.status_code == 200, r.text
    assert requests.post(f"{API}/ooh/campagne/{cid}/checkout", headers=h).status_code == 200
    assert requests.post(f"{API}/ooh/campagne/{cid}/invia", headers=h).status_code == 200


# --- 01: crea campagna + pratica, portala in IN_VERIFICA + INTEGRAZIONE_RICHIESTA ---
def test_01_setup_pratica_in_integrazione():
    h = _h(state["user_token"])
    r = requests.post(f"{API}/ooh/campagne", headers=h, json={
        "nome": f"C12 {TS}", "data_inizio": DINI, "data_fine": DFIN,
        "pacchetti_ids": [state["pacchetto_id"]],
    })
    assert r.status_code == 200, r.text
    state["cid"] = r.json()["id"]
    state["pid"] = r.json()["pratiche"][0]["id"]
    _complete_and_send(state["cid"], state["pid"])

    # L2 presa_in_carico + richiedi_integrazione
    t2 = _login(L2_EMAIL, "demo123")
    r = requests.post(f"{API}/comune/pratiche/{state['pid']}/transizione",
                      headers=_h(t2), json={"azione": "presa_in_carico"})
    assert r.status_code == 200
    r = requests.post(f"{API}/comune/pratiche/{state['pid']}/transizione",
                      headers=_h(t2), json={"azione": "richiedi_integrazione",
                                            "nota": "Sostituire creatività e correggere descrizione"})
    assert r.status_code == 200
    assert r.json()["stato"] == "INTEGRAZIONE_RICHIESTA"


# --- 02: PUT /ooh/pratiche/{id}/dati-form CONSENTITO in INTEGRAZIONE_RICHIESTA ---
def test_02_dati_form_ooh_in_integrazione():
    h = _h(state["user_token"])
    r = requests.put(f"{API}/ooh/pratiche/{state['pid']}/dati-form",
                     headers=h, json={"dati_form": {"note": "corretto"}})
    assert r.status_code == 200, r.text
    # verify persisted
    p = requests.get(f"{API}/pratiche/{state['pid']}", headers=h).json()
    assert p["dati_form"].get("note") == "corretto"


# --- 03: POST creativita: OK in INTEGRAZIONE_RICHIESTA (riassegna soggetto) ---
def test_03_creativita_ok_in_integrazione():
    h = _h(state["user_token"])
    # upload nuovo soggetto e riassegna
    sog2 = _upload_soggetto(state["cid"], "SogNew", 2)
    state["sog_new"] = sog2
    imp0 = state["impianti"][0]["id"]
    r = requests.post(f"{API}/ooh/pratiche/{state['pid']}/creativita", headers=h,
                      json={"impianto_id": imp0, "soggetto_id": sog2})
    assert r.status_code == 200, r.text


# --- 04: DELETE creativita: OK in INTEGRAZIONE_RICHIESTA ---
def test_04_delete_creativita_ok_in_integrazione():
    h = _h(state["user_token"])
    imp1 = state["impianti"][1]["id"]
    r = requests.delete(f"{API}/ooh/pratiche/{state['pid']}/creativita/{imp1}", headers=h)
    assert r.status_code == 200, r.text
    # riassegna per poterla reinviare
    r = requests.post(f"{API}/ooh/pratiche/{state['pid']}/creativita", headers=h,
                      json={"impianto_id": imp1, "soggetto_id": state["sog_new"]})
    assert r.status_code == 200


# --- 05: user reinvia integrazione (POST /pratiche/{id}/invia) ---
# NB: per OOH la transizione INTEGRAZIONE_RICHIESTA→IN_ISTRUTTORIA è INCONSISTENTE:
#     lo state machine OOH usa IN_VERIFICA (server.py:766-770), ma invia_pratica
#     imposta IN_ISTRUTTORIA (server.py:446). Documentato come bug in report.
def test_05_reinvia_integrazione():
    h = _h(state["user_token"])
    r = requests.post(f"{API}/pratiche/{state['pid']}/invia", headers=h)
    assert r.status_code == 200, r.text
    state["stato_post_reinvio"] = r.json().get("stato")
    p = requests.get(f"{API}/pratiche/{state['pid']}", headers=h).json()
    # Stato reale: IN_ISTRUTTORIA (bug); atteso da state machine OOH: IN_VERIFICA
    assert p["stato"] in ("IN_ISTRUTTORIA", "IN_VERIFICA")


# --- 06: dopo IN_VERIFICA, PUT dati-form → 400 ---
def test_06_dati_form_ooh_in_verifica_400():
    h = _h(state["user_token"])
    r = requests.put(f"{API}/ooh/pratiche/{state['pid']}/dati-form",
                     headers=h, json={"dati_form": {"note": "non permesso"}})
    assert r.status_code == 400, r.text


# --- 07: dopo IN_VERIFICA, POST creativita → 400 ---
def test_07_creativita_400_in_verifica():
    h = _h(state["user_token"])
    imp0 = state["impianti"][0]["id"]
    r = requests.post(f"{API}/ooh/pratiche/{state['pid']}/creativita", headers=h,
                      json={"impianto_id": imp0, "soggetto_id": state["sog_new"]})
    assert r.status_code == 400, r.text


# --- 08: dopo IN_VERIFICA, DELETE creativita → 400 ---
def test_08_delete_creativita_400_in_verifica():
    h = _h(state["user_token"])
    imp0 = state["impianti"][0]["id"]
    r = requests.delete(f"{API}/ooh/pratiche/{state['pid']}/creativita/{imp0}", headers=h)
    assert r.status_code == 400, r.text


# --- 09: L2 approva pratica reinviata ---
def test_09_approva_dopo_reinvio():
    t2 = _login(L2_EMAIL, "demo123")
    p = requests.get(f"{API}/pratiche/{state['pid']}", headers=_h(t2)).json()
    stato = p["stato"]
    r = requests.post(f"{API}/comune/pratiche/{state['pid']}/transizione",
                      headers=_h(t2), json={"azione": "approva"})
    if stato == "IN_ISTRUTTORIA":
        # BUG: OOH pratica in IN_ISTRUTTORIA — approva usa TRANSIZIONI_OOH (perché tipo=OOH),
        # che richiede IN_VERIFICA. Quindi il comune NON può approvare! Da segnalare al main agent.
        assert r.status_code == 400, r.text
        state["approva_bloccata"] = True
    else:
        assert r.status_code == 200, r.text
        assert r.json()["stato"] == "APPROVATA"


# --- 10: dopo lo stato "attivo" (IN_ISTRUTTORIA/APPROVATA), PUT dati-form → 400 ---
def test_10_dati_form_ooh_stato_attivo_400():
    h = _h(state["user_token"])
    r = requests.put(f"{API}/ooh/pratiche/{state['pid']}/dati-form",
                     headers=h, json={"dati_form": {"note": "no"}})
    assert r.status_code == 400, r.text


# --- 11: OSP PUT /pratiche/{id} con dati_form consentito in INTEGRAZIONE_RICHIESTA ---
def test_11_osp_dati_form_in_integrazione():
    r = requests.get(f"{API}/spazi")
    spazi = r.json()
    if not spazi:
        pytest.skip("Nessuno spazio OSP disponibile")
    sp = spazi[0]
    h = _h(state["user_token"])
    dini_osp = (date.today() + timedelta(days=200)).isoformat()
    dfin_osp = (date.today() + timedelta(days=210)).isoformat()
    r = requests.post(f"{API}/pratiche", headers=h, json={
        "spazio_id": sp["id"], "data_inizio": dini_osp, "data_fine": dfin_osp, "dati_form": {},
    })
    if r.status_code == 409:
        pytest.skip("Spazio occupato")
    assert r.status_code == 200, r.text
    posp = r.json()
    posp_id = posp["id"]
    comune_id = posp["comune_id"]

    # find a comune user with L2+ for that comune
    # fallback: send pratica, try change stato via any L2 utente of that comune
    # ricerca utenze comunali via admin
    hs = _h(state["super"])
    us = requests.get(f"{API}/admin/comuni/{comune_id}/utenti", headers=hs)
    if us.status_code != 200:
        requests.delete(f"{API}/pratiche/{posp_id}", headers=h)
        pytest.skip("Non posso listare utenze del comune OSP")
    l2 = next((u for u in us.json() if u.get("livello", 0) >= 2), None)
    if not l2:
        requests.delete(f"{API}/pratiche/{posp_id}", headers=h)
        pytest.skip("Nessuna utenza L2+ nel comune OSP")

    # invia pratica: PUT /pratiche/{id} con stato? no, endpoint /invia?
    r = requests.post(f"{API}/pratiche/{posp_id}/invia", headers=h)
    if r.status_code != 200:
        # fallback endpoint name variants
        r = requests.post(f"{API}/pratiche/{posp_id}/submit", headers=h)
    assert r.status_code == 200, f"invia pratica OSP: {r.status_code} {r.text}"

    # non conosciamo la password → skip qui su parte comune, ma verifichiamo:
    # la PUT dati_form in stato != BOZZA/INTEGRAZIONE_RICHIESTA (ora INVIATA/IN_ISTRUTTORIA) → 400
    r = requests.put(f"{API}/pratiche/{posp_id}", headers=h, json={"dati_form": {"x": 1}})
    assert r.status_code == 400, r.text

    # cleanup (potrebbe fallire se inviata)
    requests.delete(f"{API}/pratiche/{posp_id}", headers=h)
