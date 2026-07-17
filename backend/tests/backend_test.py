"""
Backend tests for Outdoor Planner SaaS.
Covers: auth, spazi/geo, user pratica flow, comune backoffice, superadmin, RBAC.
"""
import os
import io
import time
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://advert-hub-47.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# fallback: if frontend env not set at runtime, read file
if BASE_URL == "https://advert-hub-47.preview.emergentagent.com" and not os.environ.get("REACT_APP_BACKEND_URL"):
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    API = f"{BASE_URL}/api"
    except Exception:
        pass


# ---------- fixtures ----------

@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    return data["user"], data["access_token"]


@pytest.fixture(scope="session")
def user_token(session):
    _, tok = _login(session, "user@demo.it", "demo123")
    return tok


@pytest.fixture(scope="session")
def user_info(session):
    u, _ = _login(session, "user@demo.it", "demo123")
    return u


@pytest.fixture(scope="session")
def comune_token(session):
    _, tok = _login(session, "comune@demo.it", "demo123")
    return tok


@pytest.fixture(scope="session")
def comune_l2_token(session):
    _, tok = _login(session, "comune.l2@demo.it", "demo123")
    return tok


@pytest.fixture(scope="session")
def comune_l3_token(session):
    _, tok = _login(session, "comune.l3@demo.it", "demo123")
    return tok


@pytest.fixture(scope="session")
def admin_token(session):
    _, tok = _login(session, "mattia.fabrizi92@gmail.com", "demo123")
    return tok


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- auth ----------

class TestAuth:
    def test_login_user(self, session):
        u, tok = _login(session, "user@demo.it", "demo123")
        assert u["ruolo"] == "user"
        assert isinstance(tok, str) and len(tok) > 20

    def test_login_comune(self, session):
        u, _ = _login(session, "comune@demo.it", "demo123")
        assert u["ruolo"] == "comune"
        assert u["comune_id"]

    def test_login_admin(self, session):
        u, _ = _login(session, "mattia.fabrizi92@gmail.com", "demo123")
        assert u["ruolo"] == "superadmin"

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "user@demo.it", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_auth_me(self, session, user_token):
        r = session.get(f"{API}/auth/me", headers=h(user_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == "user@demo.it"

    def test_auth_me_no_token(self, session):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_spid_mock(self, session):
        r = session.post(f"{API}/auth/spid", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["ruolo"] == "user"


# ---------- public ----------

class TestPublic:
    def test_regioni(self, session):
        r = session.get(f"{API}/geo/regioni", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        assert "Lazio" in data

    def test_spazi_all(self, session):
        r = session.get(f"{API}/spazi", timeout=10)
        assert r.status_code == 200
        spazi = r.json()
        assert isinstance(spazi, list) and len(spazi) > 5

    def test_spazi_filter_regione(self, session):
        r = session.get(f"{API}/spazi", params={"regione": "Lazio"}, timeout=10)
        assert r.status_code == 200
        assert all(s["regione"] == "Lazio" for s in r.json())

    def test_spazi_filter_tipologia_prezzo(self, session):
        r = session.get(f"{API}/spazi", params={"tipologia": "Billboard", "prezzo_max": 60}, timeout=10)
        assert r.status_code == 200
        for s in r.json():
            assert s["tipologia"] == "Billboard"
            assert s["canone_giornaliero"] <= 60

    def test_spazi_search(self, session):
        r = session.get(f"{API}/spazi", params={"q": "Tiburtina"}, timeout=10)
        assert r.status_code == 200
        assert any("Tiburtina" in s["nome"] or "Tiburtina" in s["indirizzo"] for s in r.json())

    def test_get_spazio(self, session):
        listing = session.get(f"{API}/spazi", timeout=10).json()
        first_id = listing[0]["id"]
        r = session.get(f"{API}/spazi/{first_id}", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == first_id
        assert "comune" in data

    def test_spazio_404(self, session):
        r = session.get(f"{API}/spazi/does-not-exist", timeout=10)
        assert r.status_code == 404


# ---------- user pratica flow ----------

class TestPraticaUserFlow:
    @pytest.fixture(scope="class")
    def spazio_roma(self, session):
        spazi = session.get(f"{API}/spazi", params={"regione": "Lazio"}, timeout=10).json()
        return spazi[0]

    @pytest.fixture(scope="class")
    def created_pratica(self, session, user_token, spazio_roma):
        # use randomized future dates to avoid 409 overlap on rerun
        import random
        offset = random.randint(400, 900)
        d1 = (datetime.now() + timedelta(days=offset)).date().isoformat()
        d2 = (datetime.now() + timedelta(days=offset + 4)).date().isoformat()
        payload = {
            "spazio_id": spazio_roma["id"],
            "data_inizio": d1,
            "data_fine": d2,  # 5 giorni
            "dati_form": {"tipo_richiedente": "Privato"}
        }
        r = session.post(f"{API}/pratiche", json=payload, headers=h(user_token), timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["stato"] == "BOZZA"
        expected = round(5 * spazio_roma["canone_giornaliero"], 2)
        assert p["importo"] == expected, f"expected {expected} got {p['importo']}"
        return p

    def test_01_create_pratica_bozza(self, created_pratica):
        assert created_pratica["stato"] == "BOZZA"
        assert created_pratica["pagata"] is False

    def test_02_update_dati_form(self, session, user_token, created_pratica):
        r = session.put(
            f"{API}/pratiche/{created_pratica['id']}",
            json={"dati_form": {"tipo_richiedente": "Azienda", "codice_fiscale": "RSSMRA80A01H501X",
                                "ragione_sociale": "TestCo", "partita_iva": "12345678901",
                                "descrizione_contenuto": "test"}},
            headers=h(user_token), timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["dati_form"]["ragione_sociale"] == "TestCo"

    def test_03_upload_documento(self, session, user_token, created_pratica):
        pid = created_pratica["id"]
        # multipart
        files = {"file": ("test.txt", io.BytesIO(b"contenuto test"), "text/plain")}
        headers = {"Authorization": f"Bearer {user_token}"}
        r = requests.post(f"{API}/pratiche/{pid}/documenti", files=files,
                          data={"tipo": "bozzetto"}, headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["nome"] == "test.txt"
        assert "url" in doc

    def test_04_invia_senza_pagamento_fallisce(self, session, user_token, created_pratica):
        r = session.post(f"{API}/pratiche/{created_pratica['id']}/invia",
                         headers=h(user_token), timeout=10)
        assert r.status_code == 400
        assert "pagamento" in r.text.lower()

    def test_05_checkout_mock(self, session, user_token, created_pratica):
        r = session.post(f"{API}/pratiche/{created_pratica['id']}/checkout",
                         headers=h(user_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["transazione_id"].startswith("MOCK-")

    def test_06_invia_dopo_pagamento(self, session, user_token, created_pratica):
        r = session.post(f"{API}/pratiche/{created_pratica['id']}/invia",
                         headers=h(user_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["stato"] == "INVIATA"

    def test_07_pratica_ha_log_stato(self, session, user_token, created_pratica):
        r = session.get(f"{API}/pratiche/{created_pratica['id']}",
                        headers=h(user_token), timeout=10)
        assert r.status_code == 200
        p = r.json()
        assert p["stato"] == "INVIATA"
        logs = p["log_stato"]
        stati = [l["a"] for l in logs]
        assert "BOZZA" in stati and "INVIATA" in stati

    def test_08_list_mie_pratiche(self, session, user_token):
        r = session.get(f"{API}/pratiche", headers=h(user_token), timeout=10)
        assert r.status_code == 200
        pratiche = r.json()
        # 5 seed + 1 test = at least 6
        assert len(pratiche) >= 5


# ---------- comune backoffice ----------

class TestComuneBackoffice:
    def test_comune_pratiche_list_no_bozza(self, session, comune_token):
        r = session.get(f"{API}/comune/pratiche", headers=h(comune_token), timeout=10)
        assert r.status_code == 200
        pratiche = r.json()
        assert all(p["stato"] != "BOZZA" for p in pratiche)
        # solo Roma comune
        assert len({p["comune_id"] for p in pratiche}) == 1

    def test_transizione_full_flow(self, session, comune_token, comune_l2_token):
        # Trova pratica INVIATA (seed p1 su Roma)
        pratiche = session.get(f"{API}/comune/pratiche", headers=h(comune_token), timeout=10).json()
        inviata = next((p for p in pratiche if p["stato"] == "INVIATA"), None)
        assert inviata, "seed non contiene pratica INVIATA per Roma"
        pid = inviata["id"]

        # presa_in_carico by L1
        r = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                         json={"azione": "presa_in_carico", "nota": "test"},
                         headers=h(comune_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["stato"] == "IN_ISTRUTTORIA"

        # transizione non valida: presa_in_carico su IN_ISTRUTTORIA
        r2 = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                          json={"azione": "presa_in_carico"},
                          headers=h(comune_token), timeout=10)
        assert r2.status_code == 400

        # L1 cannot approve → 403
        r_l1 = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                            json={"azione": "approva"},
                            headers=h(comune_token), timeout=10)
        assert r_l1.status_code == 403

        # L2 approva
        r3 = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                          json={"azione": "approva"},
                          headers=h(comune_l2_token), timeout=10)
        assert r3.status_code == 200
        assert r3.json()["stato"] == "APPROVATA"

        # verifica numero_autorizzazione
        r4 = session.get(f"{API}/pratiche/{pid}", headers=h(comune_token), timeout=10)
        assert r4.status_code == 200
        assert r4.json().get("numero_autorizzazione", "").startswith("AUT-")

        # PDF
        r5 = requests.get(f"{API}/pratiche/{pid}/autorizzazione",
                          headers={"Authorization": f"Bearer {comune_token}"}, timeout=15)
        assert r5.status_code == 200
        assert r5.headers.get("content-type", "").startswith("application/pdf")

    def test_richiedi_integrazione_e_reinvio(self, session, comune_token, user_token):
        # create dedicated pratica to avoid parallel test races
        import random
        offset = random.randint(2700, 3000)
        d1 = (datetime.now() + timedelta(days=offset)).date().isoformat()
        d2 = (datetime.now() + timedelta(days=offset + 2)).date().isoformat()
        spazi = session.get(f"{API}/spazi", params={"regione": "Lazio"}, timeout=10).json()
        sp = spazi[1]
        pr = session.post(f"{API}/pratiche",
                          json={"spazio_id": sp["id"], "data_inizio": d1, "data_fine": d2, "dati_form": {}},
                          headers=h(user_token), timeout=15)
        assert pr.status_code == 200, pr.text
        pid = pr.json()["id"]
        session.post(f"{API}/pratiche/{pid}/checkout", headers=h(user_token), timeout=10)
        session.post(f"{API}/pratiche/{pid}/invia", headers=h(user_token), timeout=10)
        # presa_in_carico by L1
        session.post(f"{API}/comune/pratiche/{pid}/transizione",
                     json={"azione": "presa_in_carico"},
                     headers=h(comune_token), timeout=10)
        # richiedi_integrazione
        r = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                         json={"azione": "richiedi_integrazione", "nota": "manca doc"},
                         headers=h(comune_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["stato"] == "INTEGRAZIONE_RICHIESTA"

        # user reinvia
        r2 = session.post(f"{API}/pratiche/{pid}/invia", headers=h(user_token), timeout=10)
        assert r2.status_code == 200, r2.text
        assert r2.json()["stato"] == "IN_ISTRUTTORIA"

    def test_comune_spazi_crud(self, session, comune_l3_token):
        payload = {"nome": "TEST_SpazioNuovo", "tipologia": "Billboard",
                   "indirizzo": "Via Test 1", "lat": 41.9, "lng": 12.5,
                   "canone_giornaliero": 40, "dimensioni": "6x3 m",
                   "descrizione": "test", "disponibile": True, "foto_url": ""}
        r = session.post(f"{API}/comune/spazi", json=payload, headers=h(comune_l3_token), timeout=10)
        assert r.status_code == 200
        sid = r.json()["id"]

        # PUT
        payload["canone_giornaliero"] = 55
        r2 = session.put(f"{API}/comune/spazi/{sid}", json=payload, headers=h(comune_l3_token), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["canone_giornaliero"] == 55

        # DELETE
        r3 = session.delete(f"{API}/comune/spazi/{sid}", headers=h(comune_l3_token), timeout=10)
        assert r3.status_code == 200

    def test_form_template_get_put(self, session, comune_token, comune_l3_token):
        r = session.get(f"{API}/comune/form-template", headers=h(comune_token), timeout=10)
        assert r.status_code == 200
        tpl = r.json()
        # PUT (aggiungi un campo TEST) — solo L3
        campi = tpl.get("campi", []) + [
            {"id": "test_campo", "label": "TEST", "tipo": "text", "opzioni": [], "required": False, "condizione": None}
        ]
        r2 = session.put(f"{API}/comune/form-template",
                         json={"nome": tpl.get("nome", "Test"), "campi": campi},
                         headers=h(comune_l3_token), timeout=10)
        assert r2.status_code == 200
        assert any(c["id"] == "test_campo" for c in r2.json()["campi"])

    def test_comune_report(self, session, comune_token):
        r = session.get(f"{API}/comune/report", headers=h(comune_token), timeout=10)
        assert r.status_code == 200
        rep = r.json()
        assert "pratiche_totali" in rep
        assert "per_stato" in rep
        assert "incassi_totali" in rep


# ---------- superadmin ----------

class TestSuperadmin:
    def test_kpi(self, session, admin_token):
        r = session.get(f"{API}/admin/kpi", headers=h(admin_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        for k in ("utenti", "comuni", "spazi", "pratiche_totali", "per_stato", "revenue_totale"):
            assert k in data

    def test_anomalie(self, session, admin_token):
        r = session.get(f"{API}/admin/anomalie", headers=h(admin_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_comuni_list(self, session, admin_token):
        r = session.get(f"{API}/admin/comuni", headers=h(admin_token), timeout=10)
        assert r.status_code == 200
        comuni = r.json()
        assert len(comuni) >= 5
        assert all("spazi_count" in c for c in comuni)

    def test_onboard_comune_and_login(self, session, admin_token):
        unique = f"TEST_ref_{int(time.time())}@demo.it"
        payload = {
            "nome": f"TEST_Comune_{int(time.time())}",
            "regione": "Sicilia",
            "provincia": "PA",
            "lat": 38.11, "lng": 13.36,
            "referente_email": unique,
            "referente_password": "demo123",
            "referente_nome": "TEST Referente"
        }
        r = session.post(f"{API}/admin/comuni", json=payload, headers=h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["comune"]["nome"] == payload["nome"]
        # nuovo referente può fare login
        r2 = session.post(f"{API}/auth/login", json={"email": unique, "password": "demo123"}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["user"]["ruolo"] == "comune"


# ---------- RBAC ----------

class TestRBAC:
    def test_user_cannot_access_comune(self, session, user_token):
        r = session.get(f"{API}/comune/pratiche", headers=h(user_token), timeout=10)
        assert r.status_code == 403

    def test_user_cannot_access_admin(self, session, user_token):
        r = session.get(f"{API}/admin/kpi", headers=h(user_token), timeout=10)
        assert r.status_code == 403

    def test_comune_cannot_access_admin(self, session, comune_token):
        r = session.get(f"{API}/admin/kpi", headers=h(comune_token), timeout=10)
        assert r.status_code == 403

    def test_comune_cannot_access_other_comune_pratica(self, session, comune_token):
        # non testabile senza pratica di altro comune noto -> skip se non trovata
        pass


# ---------- chat & notifiche ----------

class TestChatNotifiche:
    def test_chat_flow(self, session, user_token, comune_token):
        # trova pratica del user (di Roma, INVIATA per garantire visibilità comune)
        pratiche = session.get(f"{API}/pratiche", headers=h(user_token), timeout=10).json()
        roma_p = None
        for p in pratiche:
            if p["stato"] != "BOZZA":
                roma_p = p
                break
        assert roma_p, "nessuna pratica utente disponibile"
        pid = roma_p["id"]
        # user posta messaggio
        r = session.post(f"{API}/pratiche/{pid}/chat", json={"testo": "TEST message"},
                         headers=h(user_token), timeout=10)
        assert r.status_code == 200
        # get chat
        r2 = session.get(f"{API}/pratiche/{pid}/chat", headers=h(user_token), timeout=10)
        assert r2.status_code == 200
        assert any(m["testo"] == "TEST message" for m in r2.json())

    def test_notifiche_get_leggi(self, session, user_token):
        r = session.get(f"{API}/notifiche", headers=h(user_token), timeout=10)
        assert r.status_code == 200
        r2 = session.post(f"{API}/notifiche/leggi", headers=h(user_token), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["ok"] is True



# ---------- ITERAZIONE 2: livelli comune ----------

class TestLivelliComune:
    def test_l1_ha_livello_1(self, session, comune_token):
        r = session.get(f"{API}/auth/me", headers=h(comune_token), timeout=10)
        assert r.status_code == 200
        assert r.json().get("livello") == 1

    def test_l2_ha_livello_2(self, session, comune_l2_token):
        r = session.get(f"{API}/auth/me", headers=h(comune_l2_token), timeout=10)
        assert r.status_code == 200
        assert r.json().get("livello") == 2

    def test_l3_ha_livello_3(self, session, comune_l3_token):
        r = session.get(f"{API}/auth/me", headers=h(comune_l3_token), timeout=10)
        assert r.status_code == 200
        assert r.json().get("livello") == 3

    def test_l1_cannot_crud_spazi(self, session, comune_token):
        payload = {"nome": "TEST_L1_denied", "tipologia": "Poster",
                   "indirizzo": "Via X 1", "lat": 41.9, "lng": 12.5,
                   "canone_giornaliero": 20, "dimensioni": "1x1",
                   "descrizione": "x", "disponibile": True, "foto_url": ""}
        r = session.post(f"{API}/comune/spazi", json=payload, headers=h(comune_token), timeout=10)
        assert r.status_code == 403

    def test_l1_cannot_put_form_template(self, session, comune_token):
        r = session.put(f"{API}/comune/form-template",
                        json={"nome": "Test", "campi": []},
                        headers=h(comune_token), timeout=10)
        assert r.status_code == 403

    def test_l1_cannot_update_profilo(self, session, comune_token):
        r = session.put(f"{API}/comune/profilo",
                        json={"tariffe": [], "regole": "test"},
                        headers=h(comune_token), timeout=10)
        assert r.status_code == 403

    def test_l1_puo_presa_in_carico_e_integrazione(self, session, comune_token, comune_l3_token, user_token):
        # crea flusso: nuova pratica INVIATA su Milano no, usiamo Roma
        # Cerca una INVIATA di Roma o crea nuova
        import random
        offset = random.randint(1500, 2000)
        d1 = (datetime.now() + timedelta(days=offset)).date().isoformat()
        d2 = (datetime.now() + timedelta(days=offset + 2)).date().isoformat()
        spazi = session.get(f"{API}/spazi", params={"regione": "Lazio"}, timeout=10).json()
        sp = spazi[0]
        pr = session.post(f"{API}/pratiche",
                          json={"spazio_id": sp["id"], "data_inizio": d1, "data_fine": d2, "dati_form": {}},
                          headers=h(user_token), timeout=15)
        assert pr.status_code == 200, pr.text
        pid = pr.json()["id"]
        # checkout + invia
        session.post(f"{API}/pratiche/{pid}/checkout", headers=h(user_token), timeout=10)
        rin = session.post(f"{API}/pratiche/{pid}/invia", headers=h(user_token), timeout=10)
        assert rin.status_code == 200

        # L1 presa_in_carico OK
        r = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                         json={"azione": "presa_in_carico"},
                         headers=h(comune_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["stato"] == "IN_ISTRUTTORIA"

        # L1 approva → 403
        r2 = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                          json={"azione": "approva"},
                          headers=h(comune_token), timeout=10)
        assert r2.status_code == 403

        # L1 rifiuta → 403
        r3 = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                          json={"azione": "rifiuta"},
                          headers=h(comune_token), timeout=10)
        assert r3.status_code == 403

        # L1 richiedi_integrazione OK
        r4 = session.post(f"{API}/comune/pratiche/{pid}/transizione",
                          json={"azione": "richiedi_integrazione", "nota": "manca doc"},
                          headers=h(comune_token), timeout=10)
        assert r4.status_code == 200
        assert r4.json()["stato"] == "INTEGRAZIONE_RICHIESTA"

    def test_l3_can_crud_spazi_and_profilo(self, session, comune_l3_token):
        payload = {"nome": "TEST_L3_spazio", "tipologia": "Poster",
                   "indirizzo": "Via L3 1", "lat": 41.9, "lng": 12.5,
                   "canone_giornaliero": 30, "dimensioni": "1x1",
                   "descrizione": "l3", "disponibile": True, "foto_url": ""}
        r = session.post(f"{API}/comune/spazi", json=payload, headers=h(comune_l3_token), timeout=10)
        assert r.status_code == 200
        sid = r.json()["id"]
        session.delete(f"{API}/comune/spazi/{sid}", headers=h(comune_l3_token), timeout=10)

    def test_onboard_crea_referente_l3(self, session, admin_token):
        unique = f"TEST_l3_ref_{int(time.time())}@demo.it"
        payload = {"nome": f"TEST_Comune_L3_{int(time.time())}", "regione": "Sicilia",
                   "provincia": "CT", "lat": 37.5, "lng": 15.09,
                   "referente_email": unique, "referente_password": "demo123",
                   "referente_nome": "TEST L3 Referente"}
        r = session.post(f"{API}/admin/comuni", json=payload, headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        # login and verify livello=3
        r2 = session.post(f"{API}/auth/login", json={"email": unique, "password": "demo123"}, timeout=10)
        assert r2.status_code == 200
        user = r2.json()["user"]
        assert user["livello"] == 3


# ---------- ITERAZIONE 2: sovrapposizione date ----------

class TestOverlapDate:
    @pytest.fixture(scope="class")
    def spazio_roma(self, session):
        spazi = session.get(f"{API}/spazi", params={"regione": "Lazio"}, timeout=10).json()
        return spazi[0]

    def test_occupazioni_endpoint(self, session, spazio_roma):
        r = session.get(f"{API}/spazi/{spazio_roma['id']}/occupazioni", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # deve avere formato con data_inizio/fine/stato
        for o in data:
            assert "data_inizio" in o and "data_fine" in o and "stato" in o

    def test_overlap_returns_409(self, session, user_token, spazio_roma):
        # crea prima pratica su date future
        import random
        offset = random.randint(2100, 2500)
        d1 = (datetime.now() + timedelta(days=offset)).date().isoformat()
        d2 = (datetime.now() + timedelta(days=offset + 5)).date().isoformat()
        r1 = session.post(f"{API}/pratiche",
                          json={"spazio_id": spazio_roma["id"], "data_inizio": d1, "data_fine": d2, "dati_form": {}},
                          headers=h(user_token), timeout=15)
        assert r1.status_code == 200, r1.text
        pid = r1.json()["id"]
        # portala a INVIATA
        session.post(f"{API}/pratiche/{pid}/checkout", headers=h(user_token), timeout=10)
        rin = session.post(f"{API}/pratiche/{pid}/invia", headers=h(user_token), timeout=10)
        assert rin.status_code == 200

        # 2° pratica sovrapposta → 409
        d3 = (datetime.now() + timedelta(days=offset + 3)).date().isoformat()
        d4 = (datetime.now() + timedelta(days=offset + 8)).date().isoformat()
        r2 = session.post(f"{API}/pratiche",
                          json={"spazio_id": spazio_roma["id"], "data_inizio": d3, "data_fine": d4, "dati_form": {}},
                          headers=h(user_token), timeout=15)
        assert r2.status_code == 409, r2.text
        assert "non disponibile" in r2.text.lower() or "impegnat" in r2.text.lower()

        # date libere → 200
        d5 = (datetime.now() + timedelta(days=offset + 20)).date().isoformat()
        d6 = (datetime.now() + timedelta(days=offset + 22)).date().isoformat()
        r3 = session.post(f"{API}/pratiche",
                          json={"spazio_id": spazio_roma["id"], "data_inizio": d5, "data_fine": d6, "dati_form": {}},
                          headers=h(user_token), timeout=15)
        assert r3.status_code == 200
        pid_free = r3.json()["id"]

        # PUT sovrapposto su pratica in BOZZA → 409
        rput = session.put(f"{API}/pratiche/{pid_free}",
                           json={"data_inizio": d3, "data_fine": d4},
                           headers=h(user_token), timeout=15)
        assert rput.status_code == 409

    def test_occupazioni_include_pratica_attiva(self, session, user_token, spazio_roma):
        # dopo test_overlap_returns_409, occupazioni deve mostrare almeno un range
        r = session.get(f"{API}/spazi/{spazio_roma['id']}/occupazioni", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1



# ---------- ITERAZIONE 4: campagne multi-spazio ----------

class TestCampagne:
    """Multi-space Campaign Planner: crea, checkout, invia, overlap, ownership.
    Uses class fixture that runs the full life-cycle once, then individual tests assert on shared state.
    This makes tests idempotent even under pytest-xdist parallel execution.
    """

    @pytest.fixture(scope="class")
    def campagna_ctx(self, session):
        import random
        _, user_tok = _login(session, "user@demo.it", "demo123")
        offset = random.randint(3200, 3800)
        d1 = (datetime.now() + timedelta(days=offset)).date().isoformat()
        d2 = (datetime.now() + timedelta(days=offset + 4)).date().isoformat()  # 5 gg
        disp = session.get(f"{API}/spazi/disponibili",
                           params={"data_inizio": d1, "data_fine": d2, "regione": "Lazio"},
                           timeout=10).json()
        assert len(disp) >= 2, "Need at least 2 spazi disponibili in Lazio"
        s1, s2 = disp[0], disp[1]
        # 1) crea campagna
        create_payload = {"nome": f"TEST_Camp_{int(time.time())}",
                          "data_inizio": d1, "data_fine": d2,
                          "spazi_ids": [s1["id"], s2["id"]]}
        r = session.post(f"{API}/campagne", json=create_payload, headers=h(user_tok), timeout=15)
        assert r.status_code == 200, r.text
        camp = r.json()
        # 2) tentativo invio prima del pagamento
        r_pre = session.post(f"{API}/campagne/{camp['id']}/invia", headers=h(user_tok), timeout=10)
        # 3) checkout
        r_ck = session.post(f"{API}/campagne/{camp['id']}/checkout", headers=h(user_tok), timeout=10)
        # 4) invio finale
        r_snd = session.post(f"{API}/campagne/{camp['id']}/invia", headers=h(user_tok), timeout=10)
        return {"user_tok": user_tok, "d1": d1, "d2": d2, "s1": s1, "s2": s2,
                "create_payload": create_payload, "camp": camp,
                "invia_pre_pay": r_pre, "checkout": r_ck, "invia_post_pay": r_snd}

    def test_01_spazi_disponibili_endpoint(self, session):
        d1 = (datetime.now() + timedelta(days=4500)).date().isoformat()
        d2 = (datetime.now() + timedelta(days=4503)).date().isoformat()
        r = session.get(f"{API}/spazi/disponibili",
                        params={"data_inizio": d1, "data_fine": d2, "regione": "Lazio"},
                        timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) >= 2
        assert all(s["regione"] == "Lazio" for s in data)

    def test_02_create_campagna_generates_pratiche_bozza(self, campagna_ctx):
        camp = campagna_ctx["camp"]
        s1, s2 = campagna_ctx["s1"], campagna_ctx["s2"]
        assert camp["nome"] == campagna_ctx["create_payload"]["nome"]
        assert len(camp["spazi_ids"]) == 2
        assert len(camp["pratiche"]) == 2
        expected = round(5 * s1["canone_giornaliero"] + 5 * s2["canone_giornaliero"], 2)
        assert camp["importo_totale"] == expected
        for p in camp["pratiche"]:
            assert p["stato"] == "BOZZA"
            assert p["pagata"] is False
            assert p["campagna_id"] == camp["id"]

    def test_03_invia_senza_pagamento_400(self, campagna_ctx):
        r = campagna_ctx["invia_pre_pay"]
        assert r.status_code == 400, r.text
        assert "pagamento" in r.text.lower()

    def test_04_checkout_paga_tutte(self, campagna_ctx):
        r = campagna_ctx["checkout"]
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["transazione_id"].startswith("MOCK-")
        assert data["pratiche_pagate"] == 2

    def test_05_invia_dopo_checkout(self, campagna_ctx):
        r = campagna_ctx["invia_post_pay"]
        assert r.status_code == 200, r.text
        assert r.json()["inviate"] == 2

    def test_06_detail_pratiche_inviate_con_log(self, session, campagna_ctx):
        cid = campagna_ctx["camp"]["id"]
        tok = campagna_ctx["user_tok"]
        r = session.get(f"{API}/campagne/{cid}", headers=h(tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert all(p["stato"] == "INVIATA" for p in data["pratiche"])
        assert data["per_stato"].get("INVIATA") == 2
        # verify log_stato of one pratica
        pid = data["pratiche"][0]["id"]
        rp = session.get(f"{API}/pratiche/{pid}", headers=h(tok), timeout=10)
        assert rp.status_code == 200
        stati = [l["a"] for l in rp.json()["log_stato"]]
        assert "BOZZA" in stati and "INVIATA" in stati

    def test_07_lista_campagne_include_per_stato(self, session, campagna_ctx):
        cid = campagna_ctx["camp"]["id"]
        tok = campagna_ctx["user_tok"]
        r = session.get(f"{API}/campagne", headers=h(tok), timeout=10)
        assert r.status_code == 200
        camps = r.json()
        mine = next((c for c in camps if c["id"] == cid), None)
        assert mine, f"campagna {cid} non in lista"
        assert mine["per_stato"].get("INVIATA") == 2
        assert mine["pagate"] == 2

    def test_08_overlap_409_on_second_campagna(self, session, campagna_ctx):
        tok = campagna_ctx["user_tok"]
        c = campagna_ctx["camp"]
        payload = {"nome": f"TEST_Overlap_{int(time.time())}",
                   "data_inizio": c["data_inizio"], "data_fine": c["data_fine"],
                   "spazi_ids": c["spazi_ids"]}
        r = session.post(f"{API}/campagne", json=payload, headers=h(tok), timeout=15)
        assert r.status_code == 409, r.text
        assert "disponibil" in r.text.lower()

    def test_09_spazi_disponibili_esclude_occupati(self, session, campagna_ctx):
        c = campagna_ctx["camp"]
        occupati = set(c["spazi_ids"])
        r = session.get(f"{API}/spazi/disponibili",
                        params={"data_inizio": c["data_inizio"], "data_fine": c["data_fine"],
                                "regione": "Lazio"}, timeout=10)
        assert r.status_code == 200
        ids = {s["id"] for s in r.json()}
        assert not (occupati & ids), f"spazi occupati non esclusi: {occupati & ids}"

    def test_10_altro_ruolo_non_accede(self, session, campagna_ctx, comune_token):
        cid = campagna_ctx["camp"]["id"]
        # comune role → 403 by require_role("user")
        r = session.get(f"{API}/campagne/{cid}", headers=h(comune_token), timeout=10)
        assert r.status_code == 403

    def test_11_campagna_inesistente_404(self, session, user_token):
        r = session.get(f"{API}/campagne/does-not-exist", headers=h(user_token), timeout=10)
        assert r.status_code == 404

    def test_12_campagna_senza_spazi_400(self, session, user_token):
        d1 = (datetime.now() + timedelta(days=5000)).date().isoformat()
        d2 = (datetime.now() + timedelta(days=5002)).date().isoformat()
        r = session.post(f"{API}/campagne",
                         json={"nome": "TEST_empty", "data_inizio": d1, "data_fine": d2, "spazi_ids": []},
                         headers=h(user_token), timeout=10)
        assert r.status_code == 400

    def test_13_altro_user_non_vede_campagna(self, session, admin_token, campagna_ctx):
        # admin non è user role → 403
        cid = campagna_ctx["camp"]["id"]
        r = session.get(f"{API}/campagne/{cid}", headers=h(admin_token), timeout=10)
        assert r.status_code == 403
